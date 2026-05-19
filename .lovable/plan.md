# AI Notes Generator + PDF Export

Extend the existing `/notes` feature into a premium "Notes Studio" that generates deep, multi-chapter study material, visualizes related subtopics as a node graph, and exports a beautifully formatted PDF. Builds on existing `notes` table, `generateNotes` server fn, and gamification.

## 1. Schema (migration)

Extend `notes` (additive, non-breaking):
- `language` text default 'en'
- `chapters` jsonb — array of `{ id, title, introduction, definitions[], concepts[], examples[], diagrams[], key_points[], tables[], formulas[], summary, interview_qs[], mcqs[], revision[] }`
- `graph` jsonb — `{ nodes: [{id,label,group}], edges: [{from,to,label?}] }`
- `toc` jsonb — array of `{ title, page? }` (page filled client-side at PDF time)
- `meta` jsonb — `{ pages_est, generated_at, model }`

Keep existing `summary/content/key_points/flashcards` for backward compat. RLS unchanged (already user-scoped).

## 2. Server functions (`src/lib/ai.functions.ts`)

- `planNotes({ topic, level, language })` → returns `{ subtopics: string[] (8–14), graph }`. Uses `openaiJSON` with `google/gemini-2.5-pro` for breadth.
- `generateDeepNotes({ topic, level, language })` → orchestrates:
  1. Call `planNotes` to get subtopics + graph.
  2. For each subtopic, call `openaiJSON` to produce one chapter with the full schema (intro, definitions, concepts, examples, diagram descriptions, key points, tables, formulas, summary, interview Qs, MCQs, revision).
  3. Generate cover blurb + global summary + toc.
  4. Persist full row to `notes` (chapters, graph, language).
  5. Award XP + insert `performance_events`.
- `generateFlashcardsFromNotes({ noteId })` and `generateQuizFromNotes({ noteId })` — derive from saved chapters (reuse existing `quizzes` table for quiz).
- All protected by `requireSupabaseAuth`; Zod-validated; errors surfaced via the existing toast pattern.

Performance: run chapter calls with `Promise.all` in batches of 3 to stay within timeout while keeping latency reasonable. Stream progress via polling a temp progress row OR — simpler — return chapter count up-front and have the client show indeterminate stages.

## 3. PDF generation (client-side)

Use **pdfmake** (already-friendly for TOC, headers/footers, tables, page numbers; pure JS, no native deps). Install: `pdfmake`.

`src/lib/notes-pdf.ts` exports `buildNotesPdf(note)`:
- Cover page: gradient header, topic, level, date, RAW logo watermark.
- Auto-generated TOC (pdfmake `toc` feature) with real page numbers.
- Per-chapter sections with styled H1/H2, callout boxes for "Key Points" and "Formulas", striped tables, highlighted important concepts, diagram placeholder boxes with caption.
- Interview Qs + MCQs (answers on flip page).
- Revision cheat-sheet at the end.
- Header: topic title (right). Footer: "RAW — AI Personal Tutor • page X of Y" (left + page number right).
- Diagonal subtle "RAW" watermark on every content page.
- One-click "Download PDF" button triggers `pdfMake.createPdf(docDef).download(filename)`.

## 4. UI — Notes Studio (`src/routes/_authenticated/notes.tsx` rewrite)

Three-pane layout:
- **Left sidebar**: history list (existing), search, "New" button. Each item shows topic, level, language flag.
- **Center**: topic input, level + language selects, "Generate Deep Notes" button with Framer Motion loading state showing staged progress ("Planning subtopics → Writing chapter 3/12 → Finalizing"). Below: rendered notes with chapter tabs.
- **Right**: **Node graph** rendered with `reactflow` (already common; install `reactflow`). Clicking a node scrolls to that chapter and highlights it. "Expand node" button calls `generateDeepNotes` scoped to that subtopic and appends as a new chapter.

Top action bar on a loaded note:
- Download PDF
- Generate Flashcards
- Generate Quiz
- Read Aloud (uses browser `speechSynthesis`, reuses voice tutor pattern — reads current chapter summary)
- Language toggle (re-runs generation in target language)

Dark mode: already supported via tokens; ensure all new components use semantic tokens (`bg-card`, `text-foreground`, `border-border`, `bg-primary`).

## 5. Dependencies to install

- `pdfmake` (PDF)
- `reactflow` (node graph)
- `dompurify` (sanitize markdown-derived HTML if rendered — optional)

## 6. Out of scope (deferred unless asked)

- Real diagram image generation (placeholders only — would need image model + storage; can be follow-up)
- True streaming progress (using polling estimate instead)
- Saving PDFs to Storage server-side (download stays client-side)

## 7. Verification

- Migration applies cleanly; existing notes still render.
- Generate a sample note ("Photosynthesis", intermediate) — expect 8–14 chapters, graph renders, PDF downloads with TOC + page numbers + watermark.
- QA the PDF by opening it and confirming cover, TOC pages, headers/footers, no clipped text.
- Dark mode passes visual check on Notes Studio.

Confirm to proceed and I'll implement in this order: migration → server fns → notes-pdf lib → UI rewrite → install deps → verify.
