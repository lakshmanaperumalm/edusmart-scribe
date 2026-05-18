import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { openaiChat, openaiJSON } from "./openai.server";

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

    const { data: attempt, error: aerr } = await supabase
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
