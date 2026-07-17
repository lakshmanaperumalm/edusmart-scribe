import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { openaiChat, openaiJSON } from "./openai.server";
import { enforceAiRateLimit } from "./rate-limit.server";


// ---------------- Notes generation ----------------
const NotesSchema = {
  name: "notes",
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      content: { type: "string", description: "Detailed markdown notes with examples" },
      key_points: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 10 },
      flashcards: {
        type: "array",
        minItems: 5,
        maxItems: 12,
        items: {
          type: "object",
          properties: {
            q: { type: "string" },
            a: { type: "string" },
          },
          required: ["q", "a"],
        },
      },
    },
    required: ["summary", "content", "key_points", "flashcards"],
  },
} as const;

type NotesResult = {
  summary: string;
  content: string;
  key_points: string[];
  flashcards: { q: string; a: string }[];
};

export const generateNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { topic: string; level: "beginner" | "intermediate" | "advanced" }) =>
    z
      .object({ topic: z.string().min(2).max(200), level: z.enum(["beginner", "intermediate", "advanced"]) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await enforceAiRateLimit(context.userId, "notes");
    const result = await openaiJSON<NotesResult>({

      messages: [
        {
          role: "system",
          content:
            "You are an expert tutor. Generate clear, accurate study material as JSON. Use markdown in 'content' (headings, lists, code blocks where helpful). Tailor depth to the requested level.",
        },
        {
          role: "user",
          content: `Topic: ${data.topic}\nLevel: ${data.level}\nProduce summary, detailed notes, key points, and flashcards.`,
        },
      ],
      schema: NotesSchema,
    });

    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("notes")
      .insert({
        user_id: userId,
        topic: data.topic,
        level: data.level,
        summary: result.summary,
        content: result.content,
        key_points: result.key_points,
        flashcards: result.flashcards,
      })
      .select()
      .single();
    if (error) { console.error("[ai] db error", error); throw new Error("Could not save your data. Please try again."); }
    await supabase.from("performance_events").insert({
      user_id: userId,
      topic: data.topic,
      event_type: "notes_generated",
    });
    return row;
  });

// ---------------- Quiz generation ----------------
const QuizSchema = {
  name: "quiz",
  schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: 5,
        maxItems: 15,
        items: {
          type: "object",
          properties: {
            q: { type: "string" },
            choices: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
            answer_index: { type: "integer", minimum: 0, maximum: 3 },
            explanation: { type: "string" },
            subtopic: { type: "string" },
          },
          required: ["q", "choices", "answer_index", "explanation", "subtopic"],
        },
      },
    },
    required: ["questions"],
  },
} as const;

type QuizQ = { q: string; choices: string[]; answer_index: number; explanation: string; subtopic: string };

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      subject: string;
      topic: string;
      difficulty: "easy" | "medium" | "hard";
      count: number;
    }) =>
      z
        .object({
          subject: z.string().min(2).max(80),
          topic: z.string().min(2).max(120),
          difficulty: z.enum(["easy", "medium", "hard"]),
          count: z.number().int().min(5).max(15),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await enforceAiRateLimit(context.userId, "quiz");
    const result = await openaiJSON<{ questions: QuizQ[] }>({

      messages: [
        {
          role: "system",
          content:
            "You generate high-quality multiple-choice quizzes. Each question must have exactly 4 distinct, plausible choices, one correct answer (0-indexed), an explanation, and a tagged subtopic.",
        },
        {
          role: "user",
          content: `Subject: ${data.subject}\nTopic: ${data.topic}\nDifficulty: ${data.difficulty}\nCount: ${data.count}\nReturn JSON.`,
        },
      ],
      schema: QuizSchema,
    });

    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("quizzes")
      .insert({
        owner_id: userId,
        title: `${data.topic} (${data.difficulty})`,
        subject: data.subject,
        topic: data.topic,
        difficulty: data.difficulty,
        questions: result.questions,
      })
      .select()
      .single();
    if (error) { console.error("[ai] db error", error); throw new Error("Could not save your data. Please try again."); }
    return row;
  });

// ---------------- Quiz evaluation ----------------
export const submitQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { quizId: string; answers: number[]; durationSeconds: number }) =>
    z
      .object({
        quizId: z.string().uuid(),
        answers: z.array(z.number().int()),
        durationSeconds: z.number().int().min(0).max(60 * 60 * 4),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await enforceAiRateLimit(userId, "quiz_submit");
    const { data: quiz, error } = await supabase

      .from("quizzes")
      .select("id, subject, topic, difficulty, questions")
      .eq("id", data.quizId)
      .single();
    if (error || !quiz) throw new Error("Quiz not found");

    const questions = (quiz.questions as unknown as QuizQ[]) ?? [];
    let score = 0;
    const wrongSubtopics: Record<string, number> = {};
    const perQ = questions.map((q, i) => {
      const correct = data.answers[i] === q.answer_index;
      if (correct) score += 1;
      else wrongSubtopics[q.subtopic] = (wrongSubtopics[q.subtopic] ?? 0) + 1;
      return { i, correct, given: data.answers[i], answer: q.answer_index };
    });
    const weakTopics = Object.entries(wrongSubtopics)
      .sort((a, b) => b[1] - a[1])
      .map(([topic, count]) => ({ topic, count }));

    let feedback = "Great job!";
    try {
      feedback = await openaiChat({
        messages: [
          {
            role: "system",
            content:
              "You are a kind, concise tutor. In 3-5 sentences, give the student feedback based on their quiz result. Mention which subtopics to revise.",
          },
          {
            role: "user",
            content: `Subject: ${quiz.subject}, Topic: ${quiz.topic}, Score: ${score}/${questions.length}. Weak subtopics: ${JSON.stringify(weakTopics)}.`,
          },
        ],
        temperature: 0.6,
      });
    } catch {
      // ignore feedback errors
    }

    const { data: attempt, error: aerr } = await supabaseAdmin
      .from("quiz_attempts")
      .insert({
        user_id: userId,
        quiz_id: data.quizId,
        score,
        total: questions.length,
        answers: perQ,
        weak_topics: weakTopics,
        feedback,
        duration_seconds: data.durationSeconds,
      })
      .select()
      .single();
    if (aerr) { console.error("[ai] db error", aerr); throw new Error("Could not save your quiz attempt. Please try again."); }

    await supabase.from("performance_events").insert({
      user_id: userId,
      subject: quiz.subject,
      topic: quiz.topic,
      event_type: "quiz_attempt",
      accuracy: questions.length ? score / questions.length : 0,
      duration_seconds: data.durationSeconds,
    });

    // Award XP and badges
    const xpGained = Math.round((score / Math.max(1, questions.length)) * 100);
    const { data: prof } = await supabase
      .from("profiles")
      .select("xp")
      .eq("user_id", userId)
      .single();
    await supabaseAdmin
      .from("profiles")
      .update({ xp: (prof?.xp ?? 0) + xpGained, last_active: new Date().toISOString().slice(0, 10) })
      .eq("user_id", userId);

    // First quiz badge
    const { data: badge } = await supabase.from("badges").select("id").eq("code", "first_quiz").single();
    if (badge) {
      await supabaseAdmin.from("user_badges").insert({ user_id: userId, badge_id: badge.id });
    }

    return { attempt, perQ, weakTopics, feedback, xpGained };
  });

// ---------------- Study plan ----------------
const PlanSchema = {
  name: "plan",
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      days: {
        type: "array",
        minItems: 7,
        maxItems: 7,
        items: {
          type: "object",
          properties: {
            day: { type: "string" },
            focus: { type: "string" },
            tasks: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
            estimate_minutes: { type: "integer", minimum: 15, maximum: 240 },
          },
          required: ["day", "focus", "tasks", "estimate_minutes"],
        },
      },
    },
    required: ["title", "days"],
  },
} as const;

type PlanResult = {
  title: string;
  days: { day: string; focus: string; tasks: string[]; estimate_minutes: number }[];
};

export const generateStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { goal: string }) => z.object({ goal: z.string().min(3).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await enforceAiRateLimit(userId, "study_plan");

    const [{ data: prof }, { data: events }] = await Promise.all([
      supabase
        .from("profiles")
        .select("learning_style, interests, goals")
        .eq("user_id", userId)
        .single(),
      supabase
        .from("performance_events")
        .select("subject, topic, accuracy, event_type, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const ctxStr = JSON.stringify({ profile: prof, recent: events });

    const result = await openaiJSON<PlanResult>({
      messages: [
        {
          role: "system",
          content:
            "You design personalized 7-day study plans. Use the student's learning style and weak topics. Days labeled Mon..Sun. Tasks are concrete and tailored.",
        },
        { role: "user", content: `Goal: ${data.goal}\nContext: ${ctxStr}\nReturn JSON.` },
      ],
      schema: PlanSchema,
    });

    // Deactivate previous plans, then insert new
    await supabase.from("study_plans").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
    const { data: row, error } = await supabase
      .from("study_plans")
      .insert({ user_id: userId, title: result.title, goal: data.goal, days: result.days })
      .select()
      .single();
    if (error) { console.error("[ai] db error", error); throw new Error("Could not save your data. Please try again."); }

    const { data: badge } = await supabase.from("badges").select("id").eq("code", "plan_made").single();
    if (badge) await supabaseAdmin.from("user_badges").insert({ user_id: userId, badge_id: badge.id });

    return row;
  });

// ---------------- Chat (doubt-solving tutor) ----------------
export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; message: string }) =>
    z.object({ threadId: z.string().uuid(), message: z.string().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await enforceAiRateLimit(userId, "chat", { limit: 60 });



    // Verify thread ownership
    const { data: thread } = await supabase
      .from("chat_threads")
      .select("id, title")
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .single();
    if (!thread) throw new Error("Thread not found");

    // Save user message
    const { error: userInsErr } = await supabase.from("chat_messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "user",
      content: data.message,
    });
    if (userInsErr) { console.error("[ai] db error", userInsErr); throw new Error("Could not save your message. Please try again."); }

    // Load history (last 20)
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(20);

    const { data: prof } = await supabase
      .from("profiles")
      .select("learning_style, display_name")
      .eq("user_id", userId)
      .single();

    const today = new Date().toISOString().slice(0, 10);
    const sys = `You are RAW, an expert personal tutor for the student ${prof?.display_name ?? "the student"}.

Today's date is ${today}.

Core rules — follow strictly:
1. ACCURACY FIRST. Only state facts you are confident are correct. If you are unsure, say "I'm not 100% sure" and explain what you do know rather than guessing.
2. NEVER fabricate dates, statistics, names, formulas, citations, code APIs, or historical events. If you don't know, say so.
3. If a question depends on information after your knowledge cutoff or on real-time data (news, prices, scores, current events), explicitly tell the student you may be out of date and recommend they verify from an up-to-date source.
4. Think step-by-step. For math/science/code, show the reasoning, then the final answer. Double-check arithmetic and logic before presenting the answer.
5. Ask a brief clarifying question if the student's question is ambiguous.
6. Use clean markdown: short paragraphs, bullet lists, code blocks for code, and LaTeX-style $...$ for math when helpful.
7. Adapt explanations to the student's learning style: ${prof?.learning_style ?? "balanced"}.
8. Be concise. No filler. No repeating the question back.`;

    const reply = await openaiChat({
      messages: [
        { role: "system", content: sys },
        ...((history ?? []) as { role: "user" | "assistant" | "system"; content: string }[]),
      ],
      model: "google/gemini-2.5-pro",
      temperature: 0.3,
    });

    const { data: aMsg, error: aErr } = await supabase
      .from("chat_messages")
      .insert({ thread_id: data.threadId, user_id: userId, role: "assistant", content: reply })
      .select()
      .single();
    if (aErr) { console.error("[ai] db error", aErr); throw new Error("Could not save the response. Please try again."); }

    // Auto-title if first reply
    if ((history?.length ?? 0) <= 1 && thread.title === "New conversation") {
      const title = data.message.slice(0, 60).replace(/\s+/g, " ").trim();
      await supabase.from("chat_threads").update({ title }).eq("id", data.threadId);
    } else {
      await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", data.threadId);
    }

    return { reply: aMsg };
  });

// ---------------- Onboarding ----------------
export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    displayName: string | null;
    learningStyle: "visual" | "audio" | "reading_writing" | "practical";
    interests: string[];
    goals: string[];
  }) => z.object({
    displayName: z.string().max(80).nullable(),
    learningStyle: z.enum(["visual", "audio", "reading_writing", "practical"]),
    interests: z.array(z.string().max(60)).max(20),
    goals: z.array(z.string().max(200)).max(10),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin.from("profiles").update({
      display_name: data.displayName,
      learning_style: data.learningStyle,
      interests: data.interests,
      goals: data.goals,
      onboarded: true,
    }).eq("user_id", userId);
    if (error) {
      console.error("[onboarding] db error", error);
      throw new Error("Could not save your profile. Please try again.");
    }
    return { ok: true };
  });

// ---------------- Voice Tutor (lightweight, no persistence) ----------------
export const askVoiceTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { question: string }) =>
    z.object({ question: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await enforceAiRateLimit(userId, "voice", { limit: 60 });

    const { data: prof } = await supabase
      .from("profiles")
      .select("learning_style, display_name")
      .eq("user_id", userId)
      .single();

    const sys = `You are RAW, a friendly AI voice tutor for ${prof?.display_name ?? "the student"}.

You are speaking out loud — so respond in natural spoken language:
- 2-4 short sentences max (this will be read aloud)
- No markdown, no bullet points, no code blocks, no LaTeX
- No headings, no numbered lists — just plain conversational prose
- Spell out symbols (say "plus" not "+", "equals" not "=")
- If the question is complex, give a clear summary and offer to go deeper
- Be warm, encouraging, and clear
- If unsure, say so honestly. Never fabricate facts, dates, or formulas.
- Adapt to learning style: ${prof?.learning_style ?? "balanced"}`;

    const reply = await openaiChat({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: data.question },
      ],
      model: "google/gemini-2.5-flash",
      temperature: 0.4,
    });

    return { reply };
  });

// ---------------- Deep Notes Generator ----------------
const DeepNotesSchema = {
  name: "deep_notes",
  schema: {
    type: "object",
    properties: {
      overview: { type: "string" },
      chapters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            introduction: { type: "string" },
            definitions: {
              type: "array",
              items: {
                type: "object",
                properties: { term: { type: "string" }, definition: { type: "string" } },
              },
            },
            concepts: {
              type: "array",
              items: {
                type: "object",
                properties: { heading: { type: "string" }, body: { type: "string" } },
              },
            },
            examples: {
              type: "array",
              items: {
                type: "object",
                properties: { title: { type: "string" }, body: { type: "string" } },
              },
            },
            diagrams: {
              type: "array",
              items: {
                type: "object",
                properties: { caption: { type: "string" }, description: { type: "string" } },
              },
            },
            key_points: { type: "array", items: { type: "string" } },
            tables: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  headers: { type: "array", items: { type: "string" } },
                  rows: { type: "array", items: { type: "array", items: { type: "string" } } },
                },
              },
            },
            formulas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  formula: { type: "string" },
                  explanation: { type: "string" },
                },
              },
            },
            summary: { type: "string" },
            interview_qs: {
              type: "array",
              items: {
                type: "object",
                properties: { q: { type: "string" }, a: { type: "string" } },
              },
            },
            mcqs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  q: { type: "string" },
                  choices: { type: "array", items: { type: "string" } },
                  answer_index: { type: "integer" },
                  explanation: { type: "string" },
                },
              },
            },
            revision: { type: "array", items: { type: "string" } },
          },
          required: ["id", "title", "summary"],
        },
      },
      edges: {
        type: "array",
        items: {
          type: "object",
          properties: { from: { type: "string" }, to: { type: "string" } },
        },
      },
    },
    required: ["overview", "chapters"],
  },
} as const;

type Chapter = {
  id: string;
  title: string;
  introduction: string;
  definitions: { term: string; definition: string }[];
  concepts: { heading: string; body: string }[];
  examples: { title: string; body: string }[];
  diagrams: { caption: string; description: string }[];
  key_points: string[];
  tables: { title: string; headers: string[]; rows: string[][] }[];
  formulas: { name: string; formula: string; explanation: string }[];
  summary: string;
  interview_qs: { q: string; a: string }[];
  mcqs: { q: string; choices: string[]; answer_index: number; explanation: string }[];
  revision: string[];
};

type DeepNotesDraft = {
  overview: string;
  chapters: Chapter[];
  edges: { from: string; to: string }[];
};

const asText = (value: unknown, fallback = "") => (typeof value === "string" ? value.trim() : fallback);
const asTextArray = (value: unknown, max: number) =>
  (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, max);

function parseJsonObject<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("Failed to parse JSON from model");
  }
}

export const generateDeepNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    topic: string;
    level: "beginner" | "intermediate" | "advanced";
    language?: string;
  }) =>
    z.object({
      topic: z.string().min(2).max(200),
      level: z.enum(["beginner", "intermediate", "advanced"]),
      language: z.string().min(2).max(20).default("en"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await enforceAiRateLimit(userId, "deep_notes", { limit: 10, windowMinutes: 60 });
    const language = data.language ?? "en";

    // ---- Phase 1: plan 12 chapter outlines ----
    type PlanOutline = { id: string; title: string; brief: string };
    type PlanResult = { overview: string; outlines: PlanOutline[]; edges?: { from: string; to: string }[] };

    const planText = await openaiChat({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Return only valid minified JSON, no markdown fences.
Shape: {"overview":"string (3-5 sentences)","outlines":[{"id":"s1","title":"string","brief":"one sentence describing what this chapter will cover"}],"edges":[{"from":"s1","to":"s2"}]}
Language: ${language}. Level: ${data.level}.
Plan EXACTLY 12 chapters that together deliver a comprehensive, textbook-quality study guide on the topic, ordered pedagogically from fundamentals to advanced applications. Include chapters on: introduction/context, foundational concepts, core theory, key techniques/methods, practical examples, common variants, real-world applications, comparisons/trade-offs, common pitfalls, advanced topics, current state/trends, and a wrap-up/further-study chapter.
Use plain text only. Never fabricate facts.`,
        },
        { role: "user", content: `Topic: ${data.topic}\nPlan 12 chapters.` },
      ],
      temperature: 0.4,
      maxRetries: 1,
      requestTimeoutMs: 25_000,
    });
    const plan = parseJsonObject<PlanResult>(planText);
    const outlines = (Array.isArray(plan.outlines) ? plan.outlines : [])
      .map((o, i) => ({
        id: asText(o?.id, `s${i + 1}`) || `s${i + 1}`,
        title: asText(o?.title, `Chapter ${i + 1}`),
        brief: asText(o?.brief, ""),
      }))
      .filter((o) => o.title)
      .slice(0, 12);
    if (outlines.length < 4) throw new Error("Could not plan the study guide. Please try again.");

    // ---- Phase 2: expand chapters in parallel batches of 3 chapters/call ----
    type ChapterBatch = { chapters: Chapter[] };
    const groupSize = 3;
    const groups: PlanOutline[][] = [];
    for (let i = 0; i < outlines.length; i += groupSize) groups.push(outlines.slice(i, i + groupSize));

    const chapterSystem = `Return only valid minified JSON, no markdown fences.
Shape: {"chapters":[{"id":"string","title":"string","introduction":"3-4 substantial paragraphs (250-400 words) explaining background, motivation, and what will be learned","definitions":[{"term":"string","definition":"2-3 sentence definition"}],"concepts":[{"heading":"string","body":"2-3 paragraphs (150-250 words) of clear explanation with reasoning"}],"examples":[{"title":"string","body":"1-2 paragraphs walked-through example with steps"}],"diagrams":[{"caption":"string","description":"2-3 sentence description of what the diagram shows"}],"key_points":["6-8 substantial bullet points, each a full sentence"],"tables":[{"title":"string","headers":["string"],"rows":[["string"]]}],"formulas":[{"name":"string","formula":"string","explanation":"1-2 sentences"}],"summary":"2-3 paragraph chapter summary","interview_qs":[{"q":"string","a":"2-3 sentence answer"}],"mcqs":[{"q":"string","choices":["A","B","C","D"],"answer_index":0,"explanation":"1-2 sentences"}],"revision":["5-6 concise revision bullets"]}]}
Language: ${language}. Level: ${data.level}.
For EACH requested chapter produce RICH, textbook-quality content: aim for roughly 900-1400 words per chapter across all fields combined so the printed page count is generous. Include 3-4 definitions, 4-5 concepts, 2-3 examples, 1-2 diagrams (described), 6-8 key_points, at least 1 table when it clarifies (2-4 rows), 1-3 formulas ONLY if the topic involves math/science/engineering (otherwise leave empty), 3-4 interview_qs, 3 mcqs, 5-6 revision bullets.
Never fabricate specific dates, citations, statistics, or APIs. Use plain text. Keep IDs exactly as given.`;

    const runGroup = async (group: PlanOutline[]): Promise<Chapter[]> => {
      const userMsg = `Topic: ${data.topic}\nExpand the following chapters with full rich content (preserve ids and titles):\n${JSON.stringify(group)}`;
      const text = await openaiChat({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: chapterSystem },
          { role: "user", content: userMsg },
        ],
        temperature: 0.5,
        maxRetries: 2,
        requestTimeoutMs: 55_000,
      });
      const parsed = parseJsonObject<ChapterBatch>(text);
      return Array.isArray(parsed.chapters) ? parsed.chapters : [];
    };

    // Concurrency: 2 groups at a time to stay under gateway rate limits.
    const rawChapters: Chapter[] = [];
    const concurrency = 2;
    for (let i = 0; i < groups.length; i += concurrency) {
      const slice = groups.slice(i, i + concurrency);
      const results = await Promise.all(
        slice.map((g) => runGroup(g).catch((err) => {
          console.error("[deep-notes] group failed", err);
          return [] as Chapter[];
        })),
      );
      for (const r of results) rawChapters.push(...r);
    }

    const chapters = rawChapters.slice(0, 14).map((rawChapter, idx) => {
      const definitions = Array.isArray(rawChapter?.definitions)
        ? rawChapter.definitions
            .map((d) => ({ term: asText(d?.term), definition: asText(d?.definition) }))
            .filter((d) => d.term && d.definition)
            .slice(0, 5)
        : [];
      const concepts = Array.isArray(rawChapter?.concepts)
        ? rawChapter.concepts
            .map((c) => ({ heading: asText(c?.heading), body: asText(c?.body) }))
            .filter((c) => c.heading && c.body)
            .slice(0, 6)
        : [];
      const examples = Array.isArray(rawChapter?.examples)
        ? rawChapter.examples
            .map((e) => ({ title: asText(e?.title), body: asText(e?.body) }))
            .filter((e) => e.title && e.body)
            .slice(0, 4)
        : [];
      const diagrams = Array.isArray(rawChapter?.diagrams)
        ? rawChapter.diagrams
            .map((d) => ({ caption: asText(d?.caption), description: asText(d?.description) }))
            .filter((d) => d.caption && d.description)
            .slice(0, 3)
        : [];
      const tables = Array.isArray(rawChapter?.tables)
        ? rawChapter.tables
            .map((table) => {
              const headers = asTextArray(table?.headers, 5);
              const rows = Array.isArray(table?.rows)
                ? table.rows
                    .filter(Array.isArray)
                    .map((row) => {
                      const cells = (row as unknown[]).map((cell) => asText(cell)).slice(0, headers.length);
                      while (cells.length < headers.length) cells.push("");
                      return cells;
                    })
                    .filter((row) => row.some((cell) => cell.length > 0))
                    .slice(0, 6)
                : [];
              return { title: asText(table?.title), headers, rows };
            })
            .filter((table) => table.title && table.headers.length >= 2 && table.rows.length > 0)
            .slice(0, 2)
        : [];
      const formulas = Array.isArray(rawChapter?.formulas)
        ? rawChapter.formulas
            .map((f) => ({ name: asText(f?.name), formula: asText(f?.formula), explanation: asText(f?.explanation) }))
            .filter((f) => f.name && f.formula && f.explanation)
            .slice(0, 4)
        : [];
      const interview_qs = Array.isArray(rawChapter?.interview_qs)
        ? rawChapter.interview_qs
            .map((qa) => ({ q: asText(qa?.q), a: asText(qa?.a) }))
            .filter((qa) => qa.q && qa.a)
            .slice(0, 5)
        : [];
      const mcqs = Array.isArray(rawChapter?.mcqs)
        ? rawChapter.mcqs
            .map((mcq) => {
              const choices = asTextArray(mcq?.choices, 4);
              while (choices.length < 4) choices.push(`Option ${String.fromCharCode(65 + choices.length)}`);
              return {
                q: asText(mcq?.q),
                choices,
                answer_index:
                  typeof mcq?.answer_index === "number" && mcq.answer_index >= 0 && mcq.answer_index < 4
                    ? mcq.answer_index
                    : 0,
                explanation: asText(mcq?.explanation),
              };
            })
            .filter((mcq) => mcq.q && mcq.explanation)
            .slice(0, 4)
        : [];

      return {
        id: asText(rawChapter?.id, `s${idx + 1}`),
        title: asText(rawChapter?.title, `Chapter ${idx + 1}`),
        introduction: asText(rawChapter?.introduction, asText(rawChapter?.summary, "Overview unavailable.")),
        definitions,
        concepts,
        examples,
        diagrams,
        key_points: asTextArray(rawChapter?.key_points, 10),
        tables,
        formulas,
        summary: asText(rawChapter?.summary, asTextArray(rawChapter?.key_points, 3).join(" ") || "Summary unavailable."),
        interview_qs,
        mcqs,
        revision: asTextArray(rawChapter?.revision, 8),
      } satisfies Chapter;
    }).filter((chapter) => chapter.title && chapter.summary);

    if (chapters.length < 4) {
      throw new Error("Could not generate detailed notes. Please try again.");
    }

    const validIds = new Set(chapters.map((chapter) => chapter.id));
    const edges = (Array.isArray(plan.edges) ? plan.edges : [])
      .map((edge) => ({ from: asText(edge?.from), to: asText(edge?.to) }))
      .filter((edge) => edge.from !== edge.to && validIds.has(edge.from) && validIds.has(edge.to));


    const graph = {
      nodes: chapters.map((chapter) => ({ id: chapter.id, label: chapter.title })),
      edges: edges.length ? edges : chapters.slice(1).map((chapter, idx) => ({ from: chapters[idx].id, to: chapter.id })),
    };
    const toc = chapters.map((c) => ({ id: c.id, title: c.title }));

    const { data: row, error } = await supabase.from("notes").insert({
      user_id: userId,
      topic: data.topic,
      level: data.level,
      language,
      summary: asText(plan.overview, chapters[0]?.summary ?? ""),
      content: chapters.map((c) => `# ${c.title}\n\n${c.summary}`).join("\n\n"),
      key_points: chapters.flatMap((c) => c.key_points).slice(0, 12),
      flashcards: chapters.flatMap((c) => c.interview_qs.map((qa) => ({ q: qa.q, a: qa.a }))).slice(0, 20),
      chapters,
      graph,
      toc,
      meta: { pages_est: Math.max(10, chapters.length * 2), generated_at: new Date().toISOString(), model: "deep-v1" },
    }).select().single();
    if (error) { console.error("[deep-notes] db error", error); throw new Error("Could not save your notes. Please try again."); }

    await supabase.from("performance_events").insert({
      user_id: userId,
      topic: data.topic,
      event_type: "deep_notes_generated",
    });

    return row;
  });
