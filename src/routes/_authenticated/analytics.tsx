import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

export const Route = createFileRoute("/_authenticated/analytics")({ component: Analytics });

function Analytics() {
  const { user } = useAuth();
  const { data: events } = useQuery({
    queryKey: ["events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("performance_events").select("*").eq("user_id", user!.id).order("created_at", { ascending: true }).limit(100);
      return data ?? [];
    },
  });

  const accuracySeries = (events ?? []).filter((e) => e.accuracy != null).map((e, i) => ({
    name: `#${i + 1}`,
    accuracy: Math.round(Number(e.accuracy) * 100),
  }));

  const subjectAgg: Record<string, { subject: string; total: number; correct: number }> = {};
  (events ?? []).forEach((e) => {
    if (e.subject && e.accuracy != null) {
      subjectAgg[e.subject] ??= { subject: e.subject, total: 0, correct: 0 };
      subjectAgg[e.subject].total += 1;
      subjectAgg[e.subject].correct += Number(e.accuracy);
    }
  });
  const subjectData = Object.values(subjectAgg).map((s) => ({ subject: s.subject, accuracy: Math.round((s.correct / s.total) * 100) }));

  return (
    <div className="px-6 py-8 md:px-10">
      <h1 className="font-display text-3xl font-bold">Your analytics</h1>
      <p className="mt-2 text-muted-foreground">Track accuracy, subject performance, and learning trends.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="bg-gradient-card rounded-2xl border border-border p-6">
          <h3 className="mb-4 font-semibold">Accuracy over time</h3>
          {accuracySeries.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={accuracySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 270)" />
                <XAxis dataKey="name" stroke="oklch(0.68 0.02 270)" />
                <YAxis domain={[0, 100]} stroke="oklch(0.68 0.02 270)" />
                <Tooltip contentStyle={{ background: "oklch(0.21 0.025 270)", border: "1px solid oklch(0.3 0.02 270)" }} />
                <Line dataKey="accuracy" stroke="oklch(0.72 0.19 295)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>

        <div className="bg-gradient-card rounded-2xl border border-border p-6">
          <h3 className="mb-4 font-semibold">By subject</h3>
          {subjectData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={subjectData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 270)" />
                <XAxis dataKey="subject" stroke="oklch(0.68 0.02 270)" />
                <YAxis domain={[0, 100]} stroke="oklch(0.68 0.02 270)" />
                <Tooltip contentStyle={{ background: "oklch(0.21 0.025 270)", border: "1px solid oklch(0.3 0.02 270)" }} />
                <Bar dataKey="accuracy" fill="oklch(0.78 0.18 200)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>
      </div>
    </div>
  );
}

function Empty() {
  return <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">Take a few quizzes to see your data here.</div>;
}
