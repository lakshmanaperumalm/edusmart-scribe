import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { Sparkles, Flame, Trophy, Target, BookOpen, MessageSquare, CalendarRange } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return data;
    },
  });

  useEffect(() => {
    if (profile && profile.onboarded === false) navigate({ to: "/onboarding" });
  }, [profile, navigate]);

  const { data: attempts } = useQuery({
    queryKey: ["attempts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("quiz_attempts").select("score,total,created_at").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const totalAttempts = attempts?.length ?? 0;
  const accuracy = totalAttempts ? Math.round((attempts!.reduce((s, a) => s + a.score / Math.max(1, a.total), 0) / totalAttempts) * 100) : 0;

  return (
    <div className="px-6 py-8 md:px-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">
          Welcome back{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""} <span className="text-gradient">👋</span>
        </h1>
        <p className="text-muted-foreground">Pick up where you left off, or start something new.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={Trophy} label="Total XP" value={profile?.xp ?? 0} />
        <Stat icon={Flame} label="Streak" value={`${profile?.streak ?? 0}d`} />
        <Stat icon={Target} label="Quizzes" value={totalAttempts} />
        <Stat icon={Sparkles} label="Accuracy" value={`${accuracy}%`} />
      </div>

      <h2 className="mt-10 mb-4 font-display text-xl font-semibold">Quick actions</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <ActionCard to="/notes" icon={BookOpen} title="Generate AI Notes" desc="Notes, key points & flashcards on any topic." />
        <ActionCard to="/quiz" icon={Target} title="Take an Adaptive Quiz" desc="MCQs that adapt to your level." />
        <ActionCard to="/plan" icon={CalendarRange} title="Build a 7-Day Plan" desc="Personalized schedule for your goals." />
        <ActionCard to="/chat" icon={MessageSquare} title="Ask the AI Tutor" desc="Threaded chat with conversation memory." />
      </div>

      <h2 className="mt-10 mb-4 font-display text-xl font-semibold">Recent activity</h2>
      <div className="bg-gradient-card rounded-2xl border border-border p-6">
        {attempts && attempts.length > 0 ? (
          <ul className="divide-y divide-border">
            {attempts.map((a, i) => (
              <li key={i} className="flex items-center justify-between py-3 text-sm">
                <span>Quiz attempt — {Math.round((a.score / Math.max(1, a.total)) * 100)}%</span>
                <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Take your first quiz to see your progress here.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: number | string }) {
  return (
    <div className="bg-gradient-card rounded-2xl border border-border p-5 shadow-card">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary"><Icon className="h-4 w-4" /></div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ActionCard({ to, icon: Icon, title, desc }: { to: string; icon: typeof Trophy; title: string; desc: string }) {
  return (
    <Link to={to} className="bg-gradient-card group rounded-2xl border border-border p-6 shadow-card transition hover:border-primary/50 hover:shadow-glow">
      <Icon className="mb-3 h-6 w-6 text-primary" />
      <h3 className="text-lg font-semibold group-hover:text-primary">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}
