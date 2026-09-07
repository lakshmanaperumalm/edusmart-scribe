import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import ReactFlow, { Background, Controls, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { generateDeepNotes } from "@/lib/ai.functions";
import { buildNotesPdf, type DeepNote, type PdfOptions } from "@/lib/notes-pdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Sparkles, BookOpen, Download, Volume2, VolumeX, Plus, Search, ArrowUp, ArrowDown, Trash2, ListOrdered, Settings2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notes")({ component: NotesPage });

type Chapter = DeepNote["chapters"][number];
type Note = DeepNote & {
  id: string;
  user_id: string;
  content: string | null;
  graph: { nodes: { id: string; label: string }[]; edges: { from: string; to: string }[] };
  toc: { id: string; title: string }[];
  key_points: string[];
  flashcards: { q: string; a: string }[];
};

const LANGS = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
];

const STAGES = [
  "Mapping subtopics…",
  "Planning the curriculum…",
  "Writing detailed chapters…",
  "Adding examples & formulas…",
  "Generating MCQs & revision notes…",
  "Polishing your study guide…",
];

function NotesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [language, setLanguage] = useState("en");
  const [targetPages, setTargetPages] = useState(60);
  const [customContent, setCustomContent] = useState("");
  const [active, setActive] = useState<Note | null>(null);
  const [search, setSearch] = useState("");
  const [stageIdx, setStageIdx] = useState(0);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [pdfOpts, setPdfOpts] = useState<Required<PdfOptions>>({
    pageSize: "A4",
    fontSize: 10,
    margin: 50,
    lineHeight: 1.3,
    watermark: true,
  });
  const fn = useServerFn(generateDeepNotes);

  const { data: notes } = useQuery({
    queryKey: ["notes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as Note[];
    },
  });

  const gen = useMutation({
    mutationFn: async () => {
      setStageIdx(0);
      const interval = setInterval(() => {
        setStageIdx((i) => (i < STAGES.length - 1 ? i + 1 : i));
      }, 4500);
      try {
        return await fn({ data: { topic, level, language, targetPages, customContent } });
      } finally {
        clearInterval(interval);
      }
    },
    onSuccess: (n) => {
      toast.success("Deep notes generated");
      setActive(n as unknown as Note);
      setTopic("");
      qc.invalidateQueries({ queryKey: ["notes", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveChapters = useMutation({
    mutationFn: async (chapters: Chapter[]) => {
      if (!active) return;
      const { error } = await supabase
        .from("notes")
        .update({
          chapters: chapters as unknown as never,
          toc: chapters.map((c) => ({ id: c.id, title: c.title })) as unknown as never,
        })
        .eq("id", active.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Chapters saved");
      qc.invalidateQueries({ queryKey: ["notes", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyChapters = (chapters: Chapter[]) => {
    if (!active) return;
    setActive({ ...active, chapters });
    saveChapters.mutate(chapters);
  };


  const filtered = useMemo(() => {
    if (!notes) return [];
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter((n) => n.topic.toLowerCase().includes(q));
  }, [notes, search]);

  const speak = (text: string, idx: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Voice playback isn't supported in this browser");
      return;
    }
    window.speechSynthesis.cancel();
    if (speakingIdx === idx) {
      setSpeakingIdx(null);
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = active?.language ?? "en";
    utter.onend = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utter);
  };

  const downloadPdf = () => {
    if (!active) return;
    if (!active.chapters?.length) {
      toast.error("This note has no chapters yet. Generate deep notes first.");
      return;
    }
    try {
      buildNotesPdf(active, pdfOpts);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    }
  };

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[300px_1fr_340px]">
      {/* Sidebar */}
      <aside className="border-r border-border bg-card/40 p-5 overflow-y-auto">
        <h2 className="font-display text-lg font-semibold">Notes Studio</h2>
        <p className="mt-1 text-xs text-muted-foreground">AI-powered deep study guides</p>

        <div className="mt-5 space-y-3 rounded-2xl border border-border bg-background p-4">
          <div>
            <Label>Topic or node</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Neural Networks" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Level</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Target pages</Label>
              <span className="text-xs font-medium text-primary">{targetPages}</span>
            </div>
            <Slider
              className="mt-3"
              min={20}
              max={150}
              step={5}
              value={[targetPages]}
              onValueChange={(v) => setTargetPages(v[0])}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Longer targets take a little more time.</p>
          </div>
          <div>
            <Label>Your own paragraphs / content (optional)</Label>
            <Textarea
              className="mt-1 h-28 text-xs"
              placeholder="Paste the exact paragraphs, syllabus points or notes you want included…"
              value={customContent}
              onChange={(e) => setCustomContent(e.target.value)}
            />
          </div>
          <Button
            className="w-full bg-gradient-hero text-primary-foreground shadow-glow"
            disabled={!topic || gen.isPending}
            onClick={() => gen.mutate()}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {gen.isPending ? "Generating…" : "Generate Deep Notes"}
          </Button>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">History</div>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setActive(null)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="h-8 pl-7 text-xs" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-1">
            {filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => setActive(n)}
                className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent/50 ${active?.id === n.id ? "bg-accent/60" : ""}`}
              >
                <div className="truncate font-medium">{n.topic}</div>
                <div className="text-xs text-muted-foreground">
                  {n.level} · {n.chapters?.length ?? 0} chapters · {(n.language ?? "en").toUpperCase()}
                </div>
              </button>
            ))}
            {!filtered.length && <p className="text-xs text-muted-foreground">No notes yet.</p>}
          </div>
        </div>
      </aside>

      {/* Center */}
      <section className="overflow-y-auto p-6 md:p-10">
        {gen.isPending && <GeneratingState stage={STAGES[stageIdx]} stageIdx={stageIdx} total={STAGES.length} />}

        {!gen.isPending && active && (
          <article className="mx-auto max-w-3xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl font-bold">{active.topic}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {active.level} · {(active.language ?? "en").toUpperCase()} · {active.chapters?.length ?? 0} chapters
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setEditorOpen(true)}>
                  <ListOrdered className="mr-2 h-4 w-4" /> Edit chapters
                </Button>
                <Button variant="outline" onClick={() => setLayoutOpen(true)}>
                  <Settings2 className="mr-2 h-4 w-4" /> PDF layout
                </Button>
                <Button onClick={downloadPdf} className="bg-primary text-primary-foreground shadow-glow">
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
              </div>
            </div>

            {active.summary && (
              <div className="bg-gradient-card mt-6 rounded-2xl border border-border p-6">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">Overview</h2>
                <p className="text-foreground/90">{active.summary}</p>
              </div>
            )}

            <div className="mt-8 space-y-10">
              {active.chapters?.map((c, idx) => (
                <ChapterBlock
                  key={c.id ?? idx}
                  chapter={c}
                  index={idx}
                  speaking={speakingIdx === idx}
                  onSpeak={() => speak(`${c.title}. ${c.summary}`, idx)}
                />
              ))}
            </div>

            {!active.chapters?.length && active.content && (
              <pre className="mt-6 whitespace-pre-wrap font-sans text-sm text-foreground/90">{active.content}</pre>
            )}
          </article>
        )}

        {!gen.isPending && !active && (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md text-center text-muted-foreground">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-primary" />
              <p className="text-lg text-foreground">Generate your first deep study guide.</p>
              <p className="mt-2 text-sm">Pick a topic on the left — we'll plan the chapters, expand related concepts, and produce a downloadable PDF.</p>
            </div>
          </div>
        )}
      </section>

      {/* Right: graph */}
      <aside className="hidden border-l border-border bg-card/40 md:block">
        <div className="border-b border-border p-4">
          <h3 className="font-display text-sm font-semibold">Concept Graph</h3>
          <p className="text-xs text-muted-foreground">Click a node to jump to its chapter</p>
        </div>
        <div className="h-[calc(100%-65px)]">
          {active?.graph?.nodes?.length ? (
            <GraphView
              graph={active.graph}
              onNodeClick={(id) => {
                const el = document.getElementById(`chapter-${id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
              The concept graph appears here after generation.
            </div>
          )}
        </div>
      </aside>

      {active && (
        <ChapterEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          chapters={active.chapters ?? []}
          onSave={(next) => {
            applyChapters(next);
            setEditorOpen(false);
          }}
        />
      )}

      <LayoutDialog open={layoutOpen} onOpenChange={setLayoutOpen} value={pdfOpts} onChange={setPdfOpts} />
    </div>
  );
}

function LayoutDialog({
  open,
  onOpenChange,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: Required<PdfOptions>;
  onChange: (v: Required<PdfOptions>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>PDF layout</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div>
            <Label>Page size</Label>
            <Select value={value.pageSize} onValueChange={(v) => onChange({ ...value, pageSize: v as "A4" | "LETTER" })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="LETTER">Letter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between"><Label>Font size</Label><span className="text-xs text-primary">{value.fontSize}pt</span></div>
            <Slider className="mt-3" min={8} max={14} step={1} value={[value.fontSize]} onValueChange={(v) => onChange({ ...value, fontSize: v[0] })} />
          </div>
          <div>
            <div className="flex items-center justify-between"><Label>Margins</Label><span className="text-xs text-primary">{value.margin}pt</span></div>
            <Slider className="mt-3" min={25} max={80} step={5} value={[value.margin]} onValueChange={(v) => onChange({ ...value, margin: v[0] })} />
          </div>
          <div>
            <div className="flex items-center justify-between"><Label>Line spacing</Label><span className="text-xs text-primary">{value.lineHeight.toFixed(1)}</span></div>
            <Slider className="mt-3" min={10} max={20} step={1} value={[Math.round(value.lineHeight * 10)]} onValueChange={(v) => onChange({ ...value, lineHeight: v[0] / 10 })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Background watermark</Label>
            <Switch checked={value.watermark} onCheckedChange={(c) => onChange({ ...value, watermark: c })} />
          </div>
        </div>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const emptyChapter = (title: string, body: string): Chapter => ({
  id: `custom-${Math.random().toString(36).slice(2, 8)}`,
  title,
  introduction: body,
  definitions: [],
  concepts: [],
  examples: [],
  diagrams: [],
  key_points: [],
  tables: [],
  formulas: [],
  summary: body.slice(0, 300),
  interview_qs: [],
  mcqs: [],
  revision: [],
});

function ChapterEditor({
  open,
  onOpenChange,
  chapters,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chapters: Chapter[];
  onSave: (chapters: Chapter[]) => void;
}) {
  const [draft, setDraft] = useState<Chapter[]>(chapters);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(chapters);
      setOpenIdx(null);
    }
  }, [open, chapters]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[i], next[j]] = [next[j], next[i]];
    setDraft(next);
    setOpenIdx(null);
  };

  const update = (i: number, patch: Partial<Chapter>) =>
    setDraft(draft.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Edit, reorder or replace chapters</DialogTitle></DialogHeader>

        <div className="space-y-2">
          {draft.map((c, i) => (
            <div key={c.id ?? i} className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{i + 1}</span>
                <Input value={c.title} onChange={(e) => update(i, { title: e.target.value })} className="h-8 flex-1 text-sm" />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDraft(draft.filter((_, idx) => idx !== i))} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
              </div>
              <button className="mt-2 text-xs text-primary" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                {openIdx === i ? "Hide content" : "Edit content"}
              </button>
              {openIdx === i && (
                <div className="mt-2 space-y-2">
                  <Label className="text-xs">Introduction / paragraphs</Label>
                  <Textarea className="h-40 text-xs" value={c.introduction} onChange={(e) => update(i, { introduction: e.target.value })} />
                  <Label className="text-xs">Summary</Label>
                  <Textarea className="h-20 text-xs" value={c.summary} onChange={(e) => update(i, { summary: e.target.value })} />
                  <Label className="text-xs">Key points (one per line)</Label>
                  <Textarea
                    className="h-24 text-xs"
                    value={(c.key_points ?? []).join("\n")}
                    onChange={(e) => update(i, { key_points: e.target.value.split("\n").filter(Boolean) })}
                  />
                </div>
              )}
            </div>
          ))}
          {!draft.length && <p className="text-sm text-muted-foreground">No chapters — add one below.</p>}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-border p-3">
          <Label className="text-xs">Add your own chapter</Label>
          <Input className="mt-1 h-8 text-sm" placeholder="Chapter title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <Textarea className="mt-2 h-28 text-xs" placeholder="Paste your paragraphs here…" value={newBody} onChange={(e) => setNewBody(e.target.value)} />
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            disabled={!newTitle.trim() || !newBody.trim()}
            onClick={() => {
              setDraft([...draft, emptyChapter(newTitle.trim(), newBody.trim())]);
              setNewTitle("");
              setNewBody("");
            }}
          >
            <Plus className="mr-2 h-3.5 w-3.5" /> Add chapter
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GeneratingState({ stage, stageIdx, total }: { stage: string; stageIdx: number; total: number }) {
  const pct = Math.round(((stageIdx + 1) / total) * 100);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-20 text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="bg-gradient-hero shadow-glow mb-6 h-16 w-16 rounded-2xl"
      />
      <h2 className="font-display text-xl font-semibold">Building your study guide</h2>
      <AnimatePresence mode="wait">
        <motion.p
          key={stage}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="mt-2 text-sm text-muted-foreground"
        >
          {stage}
        </motion.p>
      </AnimatePresence>
      <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="bg-gradient-hero h-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">This usually takes 30–90 seconds</p>
    </div>
  );
}

function ChapterBlock({
  chapter,
  index,
  speaking,
  onSpeak,
}: {
  chapter: Chapter;
  index: number;
  speaking: boolean;
  onSpeak: () => void;
}) {
  return (
    <motion.section
      id={`chapter-${chapter.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="scroll-mt-6"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">
          <span className="mr-2 text-primary">{index + 1}.</span>
          {chapter.title}
        </h2>
        <Button size="sm" variant="ghost" onClick={onSpeak} aria-label="Read aloud">
          {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-3 text-foreground/90 leading-relaxed">{chapter.introduction}</p>

      {chapter.definitions?.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">Definitions</h3>
          <ul className="mt-2 space-y-1.5">
            {chapter.definitions.map((d, i) => (
              <li key={i}><span className="font-semibold text-foreground">{d.term}:</span> <span className="text-foreground/80">{d.definition}</span></li>
            ))}
          </ul>
        </div>
      )}

      {chapter.concepts?.map((c, i) => (
        <div key={i} className="mt-5">
          <h3 className="font-semibold text-foreground">{c.heading}</h3>
          <p className="mt-1 text-foreground/85 leading-relaxed">{c.body}</p>
        </div>
      ))}

      {chapter.examples?.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">Examples</h3>
          <div className="mt-2 space-y-3">
            {chapter.examples.map((e, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="font-medium">{e.title}</div>
                <p className="mt-1 text-sm text-foreground/80">{e.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {chapter.diagrams?.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {chapter.diagrams.map((d, i) => (
            <div key={i} className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4">
              <div className="flex h-20 items-center justify-center text-xs italic text-muted-foreground">[ Diagram ]</div>
              <div className="mt-2 text-sm font-medium">{d.caption}</div>
              <div className="text-xs text-muted-foreground">{d.description}</div>
            </div>
          ))}
        </div>
      )}

      {chapter.key_points?.length > 0 && (
        <div className="mt-5 rounded-xl border-l-4 border-primary bg-primary/5 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">Key Points</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/85">
            {chapter.key_points.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </div>
      )}

      {chapter.tables?.map((t, i) => (
        <div key={i} className="mt-5 overflow-x-auto">
          <div className="mb-1 text-sm italic text-muted-foreground">{t.title}</div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>{t.headers.map((h, hi) => <th key={hi} className="border border-border bg-primary/10 px-3 py-2 text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {t.rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border border-border px-3 py-2">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {chapter.formulas?.length > 0 && (
        <div className="mt-5 rounded-xl border-l-4 border-amber-500 bg-amber-500/5 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Formulas</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {chapter.formulas.map((f, i) => (
              <li key={i}>
                <div className="font-medium">{f.name}</div>
                <code className="block rounded bg-muted px-2 py-1 font-mono text-xs">{f.formula}</code>
                <div className="mt-1 text-xs text-muted-foreground">{f.explanation}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 rounded-xl bg-muted/40 p-4 italic text-foreground/80">{chapter.summary}</div>

      {chapter.interview_qs?.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">Interview Questions</h3>
          <div className="mt-2 space-y-2">
            {chapter.interview_qs.map((qa, i) => (
              <details key={i} className="rounded-lg border border-border bg-card p-3">
                <summary className="cursor-pointer font-medium">{qa.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{qa.a}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      {chapter.mcqs?.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">Practice MCQs</h3>
          <div className="mt-2 space-y-3">
            {chapter.mcqs.map((m, i) => (
              <details key={i} className="rounded-lg border border-border bg-card p-3">
                <summary className="cursor-pointer font-medium">Q{i + 1}. {m.q}</summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {m.choices.map((c, ci) => (
                    <li key={ci} className={ci === m.answer_index ? "font-semibold text-primary" : "text-foreground/80"}>
                      {String.fromCharCode(65 + ci)}. {c}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs italic text-muted-foreground">{m.explanation}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      {chapter.revision?.length > 0 && (
        <div className="mt-5 rounded-xl border-l-4 border-emerald-500 bg-emerald-500/5 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Revision Notes</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/85">
            {chapter.revision.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </motion.section>
  );
}

function GraphView({
  graph,
  onNodeClick,
}: {
  graph: { nodes: { id: string; label: string }[]; edges: { from: string; to: string }[] };
  onNodeClick: (id: string) => void;
}) {
  const nodes: Node[] = useMemo(() => {
    const cols = 2;
    return graph.nodes.map((n, i) => ({
      id: n.id,
      data: { label: n.label },
      position: { x: (i % cols) * 150, y: Math.floor(i / cols) * 80 },
      style: {
        borderRadius: 12,
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
        color: "hsl(var(--foreground))",
        fontSize: 11,
        padding: 6,
        width: 140,
      },
    }));
  }, [graph.nodes]);

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((e, i) => ({
        id: `e${i}`,
        source: e.from,
        target: e.to,
        animated: true,
        style: { stroke: "hsl(var(--primary))", strokeWidth: 1 },
      })),
    [graph.edges],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      onNodeClick={(_, n) => onNodeClick(n.id)}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} color="hsl(var(--border))" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
