import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateQuiz, submitQuiz } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quiz")({ component: QuizPage });

type Q = { q: string; choices: string[]; answer_index: number; explanation: string; subtopic: string };

function QuizPage() {
  const genFn = useServerFn(generateQuiz);
  const subFn = useServerFn(submitQuiz);

  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  const [quiz, setQuiz] = useState<{ id: string; questions: Q[] } | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof submitQuiz>> | null>(null);

  const gen = useMutation({
    mutationFn: () => genFn({ data: { subject, topic, difficulty, count: 8 } }),
    onSuccess: (q) => {
      const questions = (q as unknown as { id: string; questions: Q[] }).questions;
      setQuiz({ id: (q as unknown as { id: string }).id, questions });
      setAnswers(Array(questions.length).fill(-1));
      setStartTime(Date.now());
      setResult(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: () => subFn({ data: { quizId: quiz!.id, answers, durationSeconds: Math.round((Date.now() - startTime) / 1000) } }),
    onSuccess: (r) => { setResult(r); toast.success(`Score: ${r.attempt.score}/${r.attempt.total} • +${r.xpGained} XP`); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (result && quiz) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-3xl font-bold">Results</h1>
        <div className="bg-gradient-card mt-4 rounded-2xl border border-border p-6 shadow-glow">
          <div className="text-5xl font-bold text-gradient">{result.attempt.score}/{result.attempt.total}</div>
          <p className="mt-2 text-muted-foreground">{result.feedback}</p>
        </div>
        {!!result.weakTopics.length && (
          <div className="bg-gradient-card mt-4 rounded-2xl border border-border p-6">
            <h3 className="mb-2 font-semibold">Topics to revise</h3>
            <ul className="space-y-1 text-sm">
              {result.weakTopics.map((w) => <li key={w.topic}>• {w.topic} ({w.count} missed)</li>)}
            </ul>
          </div>
        )}
        <div className="mt-6 space-y-4">
          {quiz.questions.map((q, i) => {
            const correct = answers[i] === q.answer_index;
            return (
              <div key={i} className="bg-gradient-card rounded-2xl border border-border p-5">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  {correct ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                  <span className="font-medium">{q.q}</span>
                </div>
                <p className="text-xs text-muted-foreground">Correct: {q.choices[q.answer_index]}</p>
                <p className="mt-2 text-sm text-foreground/90">{q.explanation}</p>
              </div>
            );
          })}
        </div>
        <Button className="mt-6" onClick={() => { setQuiz(null); setResult(null); }}>New quiz</Button>
      </div>
    );
  }

  if (quiz) {
    const allAnswered = answers.every((a) => a >= 0);
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold">{topic} — {difficulty}</h1>
        <div className="mt-6 space-y-5">
          {quiz.questions.map((q, i) => (
            <div key={i} className="bg-gradient-card rounded-2xl border border-border p-5">
              <div className="mb-3 font-medium">{i + 1}. {q.q}</div>
              <div className="grid gap-2">
                {q.choices.map((c, ci) => (
                  <button
                    key={ci}
                    onClick={() => setAnswers((a) => a.map((v, idx) => (idx === i ? ci : v)))}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-left text-sm transition",
                      answers[i] === ci ? "border-primary bg-primary/10" : "border-border hover:border-primary/40",
                    )}
                  >{c}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button className="mt-6 bg-gradient-hero text-primary-foreground shadow-glow" disabled={!allAnswered || submit.isPending} onClick={() => submit.mutate()}>
          {submit.isPending ? "Evaluating..." : "Submit quiz"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold">Adaptive AI Quiz</h1>
      <p className="mt-2 text-muted-foreground">Generate a personalized MCQ set on any topic.</p>
      <div className="bg-gradient-card mt-6 space-y-4 rounded-2xl border border-border p-6">
        <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Computer Science" /></div>
        <div><Label>Topic</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Binary Trees" /></div>
        <div>
          <Label>Difficulty</Label>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="w-full bg-gradient-hero text-primary-foreground shadow-glow" disabled={!subject || !topic || gen.isPending} onClick={() => gen.mutate()}>
          <Sparkles className="mr-2 h-4 w-4" /> {gen.isPending ? "Generating..." : "Generate quiz"}
        </Button>
      </div>
    </div>
  );
}
