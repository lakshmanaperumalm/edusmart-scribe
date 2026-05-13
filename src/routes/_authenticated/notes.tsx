import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateNotes } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notes")({ component: NotesPage });

type Note = {
  id: string;
  topic: string;
  level: string;
  summary: string | null;
  content: string | null;
  key_points: string[];
  flashcards: { q: string; a: string }[];
  created_at: string;
};

function NotesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [active, setActive] = useState<Note | null>(null);
  const fn = useServerFn(generateNotes);

  const { data: notes } = useQuery({
    queryKey: ["notes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("notes").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      return (data ?? []) as unknown as Note[];
    },
  });

  const gen = useMutation({
    mutationFn: () => fn({ data: { topic, level } }),
    onSuccess: (n) => {
      toast.success("Notes generated");
      setActive(n as unknown as Note);
      setTopic("");
      qc.invalidateQueries({ queryKey: ["notes", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid h-full md:grid-cols-[320px_1fr]">
      <aside className="border-r border-border p-5">
        <h2 className="font-display text-lg font-semibold">AI Notes</h2>
        <div className="mt-4 space-y-3">
          <div><Label>Topic</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Binary Trees" /></div>
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
          <Button className="w-full bg-gradient-hero text-primary-foreground shadow-glow" disabled={!topic || gen.isPending} onClick={() => gen.mutate()}>
            <Sparkles className="mr-2 h-4 w-4" /> {gen.isPending ? "Generating..." : "Generate"}
          </Button>
        </div>
        <div className="mt-6">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Saved notes</div>
          <div className="space-y-1">
            {notes?.map((n) => (
              <button key={n.id} onClick={() => setActive(n)} className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-accent/50 ${active?.id === n.id ? "bg-accent/60" : ""}`}>
                <div className="truncate font-medium">{n.topic}</div>
                <div className="text-xs text-muted-foreground">{n.level}</div>
              </button>
            ))}
            {!notes?.length && <p className="text-xs text-muted-foreground">No notes yet.</p>}
          </div>
        </div>
      </aside>

      <section className="overflow-y-auto p-8">
        {active ? (
          <article className="mx-auto max-w-3xl">
            <h1 className="font-display text-3xl font-bold">{active.topic}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{active.level}</p>

            <div className="bg-gradient-card mt-6 rounded-2xl border border-border p-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">Summary</h2>
              <p className="text-foreground/90">{active.summary}</p>
            </div>

            <h2 className="mt-8 font-display text-xl font-semibold">Key points</h2>
            <ul className="mt-3 list-disc space-y-1 pl-6 text-foreground/90">
              {active.key_points?.map((k, i) => <li key={i}>{k}</li>)}
            </ul>

            <h2 className="mt-8 font-display text-xl font-semibold">Notes</h2>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-foreground/90">{active.content}</pre>

            <h2 className="mt-8 font-display text-xl font-semibold">Flashcards</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {active.flashcards?.map((f, i) => (
                <details key={i} className="bg-gradient-card rounded-xl border border-border p-4">
                  <summary className="cursor-pointer font-medium">{f.q}</summary>
                  <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </article>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-muted-foreground">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-primary" />
              <p>Generate your first set of AI notes to get started.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
