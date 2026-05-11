
# Intelligent Personalized Learning Assistant — v1

The full spec is huge. I'll build a strong, production-shaped v1 you can iterate on, not a thin demo. Anything not in v1 is listed at the end and easy to add next.

## Foundation
- Enable Lovable Cloud (Postgres + Auth + Storage)
- Auth: Email/password + Google sign-in, password reset page
- Roles: `student`, `teacher`, `admin` in a separate `user_roles` table with `has_role()` SECURITY DEFINER (no privilege escalation)
- Bring-your-own OpenAI key stored as a server secret (`OPENAI_API_KEY`)

## Database (RLS on every table)
- `profiles` (name, avatar, learning_style, interests[], goals[], xp, streak)
- `user_roles` (user_id, role)
- `courses`, `lessons`, `enrollments`
- `quizzes`, `quiz_questions`, `quiz_attempts` (score, weak_topics jsonb)
- `study_plans` (ai-generated, week schedule jsonb)
- `notes` (ai-generated study material, flashcards jsonb)
- `chat_threads`, `chat_messages` (threaded chatbot, user-scoped)
- `performance_events` (time spent, topic, accuracy) → powers analytics
- `badges`, `user_badges`

## Pages & Features

### Public
- Landing page (hero, features, CTA)
- Login / Signup / Forgot password / Reset password

### Student (`/app/*`)
- Onboarding: pick learning style, interests, goals
- Dashboard: streak, XP, weekly progress chart, AI recommendations, recent activity
- AI Study Plan: generate 7-day personalized plan from performance + goals
- AI Notes Generator: paste topic / upload PDF → notes + key points + flashcards (3 levels)
- AI Quiz: generate adaptive MCQ quiz, take it, get instant evaluation + weak-topic analysis, difficulty auto-adjusts on next attempt
- Doubt Chatbot: threaded conversations (sidebar of threads, persisted), markdown + code rendering, streaming
- Analytics: subject-wise accuracy, time spent, weak/strong topics
- Gamification: badges, daily streak, XP

### Teacher (`/teacher/*`)
- Dashboard: students overview, weak-topic heatmap, quiz analytics
- Course/lesson management (create courses, upload PDF/link materials)
- Quiz creation (manual + AI-assisted)

### Admin (`/admin/*`)
- Users + role management
- Platform stats (users, AI calls, quizzes taken)
- Course oversight

## AI (server functions, key never leaves server)
- `generateStudyPlan(profile, performance)` → structured JSON
- `generateNotes(topic, level)` / `summarizePdf(text)` → notes + flashcards
- `generateQuiz(topic, difficulty, count)` → MCQs with answers + explanations
- `evaluateAttempt(answers, questions)` → per-question feedback + weak topics
- `chatStream(threadId, message)` → streaming tutor response, conversation memory
- `recommendNext(userId)` → adaptive next-topic suggestion

Model: `gpt-5.2` for generation/eval (your OpenAI key), structured outputs via JSON schema.

## Design
- Modern edu-tech: clean, focused, generous whitespace
- Indigo/violet primary on near-black surfaces, dark mode default with light toggle
- Display font for headings, Inter for body
- Recharts for analytics, framer-motion for subtle motion, AI Elements for chat

## Tech (this template)
- TanStack Start + React 19 + Tailwind v4
- Lovable Cloud (Supabase) — Postgres, Auth, Storage, RLS
- OpenAI via server functions (`createServerFn`)
- shadcn UI + AI Elements for chat surface

## Not in v1 (easy follow-ups)
- Voice tutor (STT/TTS), emotion detection, AR/VR
- Multi-language, offline mode, blockchain certs
- Push notifications + email reminders (we'll stub UI; wiring email needs Resend)
- Real-time leaderboards across cohorts
- Video lesson generation

## Sequence
1. Enable Cloud + collect OpenAI key
2. Auth + roles + onboarding
3. Schema + RLS migrations
4. Student dashboard + AI generators (plan, notes, quiz)
5. Threaded chatbot
6. Analytics + gamification
7. Teacher + admin dashboards
8. Polish, SEO, empty states

This will take several iterations of generation. After each major chunk we can adjust.
