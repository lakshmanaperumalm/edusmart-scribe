import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateStudyPlan } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/plan")({ component: PlanPage });

type Day = { day: string; focus: string; tasks: string[]; estimate_minutes: number };
type Plan = { id: string; title: string; goal: string | null; days: Day[]; created_at: string };

function PlanPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [goal, setGoal] = useState("");
  const fn = useServerFn(generateStudyPlan);

  const { data: plan } = useQuery({
    queryKey: ["plan", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("study_plans").select("*").eq("user_id", user!.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data as Plan | null;
    },
  });

  const gen = useMutation({
    mutationFn: () => fn({ data: { goal } }),
    onSuccess: () => { toast.success("Plan generated!"); setGoal(""); qc.invalidateQueries({ queryKey: ["plan", user?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold">Personalized Study Plan</h1>
      <p className="mt-2 text-muted-foreground">A 7-day plan tailored to your goals, learning style, and recent performance.</p>

      <div className="bg-gradient-card mt-6 flex flex-col gap-3 rounded-2xl border border-border p-6 md:flex-row">
        <div className="flex-1"><Label>Goal</Label><Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Prepare for calculus midterm" /></div>
        <Button className="self-end bg-gradient-hero text-primary-foreground shadow-glow" disabled={!goal || gen.isPending} onClick={() => gen.mutate()}>
          <Sparkles className="mr-2 h-4 w-4" />{gen.isPending ? "Generating..." : "Generate plan"}
        </Button>
      </div>

      {plan ? (
        <div className="mt-8">
          <h2 className="font-display text-xl font-semibold">{plan.title}</h2>
          <p className="text-sm text-muted-foreground">{plan.goal}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {plan.days.map((d, i) => (
              <div key={i} className="bg-gradient-card rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-semibold">{d.day}</span>
                  <span className="text-xs text-muted-foreground">{d.estimate_minutes} min</span>
                </div>
                <p className="mt-1 text-sm font-medium text-primary">{d.focus}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
                  {d.tasks.map((t, ti) => <li key={ti}>{t}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No active plan yet — generate one above.
        </div>
      )}
    </div>
  );
}
