import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import {
  Sparkles, Flame, Trophy, Target, BookOpen, MessageSquare,
  CalendarRange, Zap, Lock, ArrowRight,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BADGES, dailyMission, levelFromXp } from "@/lib/gamification";

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
      const { data } = await supabase
        .from("quiz_attempts")
        .select("score,total,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const xp = profile?.xp ?? 0;
  const streak = profile?.streak ?? 0;
  const totalAttempts = attempts?.length ?? 0;
  const accuracy = totalAttempts
    ? Math.round((attempts!.reduce((s, a) => s + a.score / Math.max(1, a.total), 0) / totalAttempts) * 100)
    : 0;

  const lvl = useMemo(() => levelFromXp(xp), [xp]);
  const stats = { xp, streak, quizzes: totalAttempts, accuracy };
  const mission = dailyMission(new Date().getDate());

  const unlockedBadges = BADGES.filter((b) => b.unlocked(stats));
  const lockedBadges = BADGES.filter((b) => !b.unlocked(stats));

  // Last 7 days attempt count for mini-chart
  const weekly = useMemo(() => {
    const days: { d: string; n: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      const n = (attempts ?? []).filter((a) => a.created_at.slice(0, 10) === key).length;
      days.push({ d: ["S", "M", "T", "W", "T", "F", "S"][date.getDay()], n });
    }
    return days;
  }, [attempts]);
  const maxN = Math.max(1, ...weekly.map((w) => w.n));

  return (
    <div className="px-6 py-8 md:px-10">
      {/* Hero */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">
            Welcome back{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""} <span className="text-gradient">👋</span>
          </h1>
          <p className="text-muted-foreground">Pick up where you left off, or start something new.</p>
        </div>
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
          <Trophy className="h-3.5 w-3.5" /> Level {lvl.level}
        </Badge>
      </div>

      {/* Level + streak card */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="bg-gradient-card relative overflow-hidden rounded-2xl border border-border p-6 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Your level</div>
              <div className="mt-1 font-display text-3xl font-bold">Lvl {lvl.level}</div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-bold">{xp.toLocaleString()} XP</div>
              <div className="text-xs text-muted-foreground">{lvl.toNext} XP to Lvl {lvl.level + 1}</div>
            </div>
          </div>
          <Progress value={lvl.progress} className="mt-4 h-2.5" />
        </div>

        <div className="bg-gradient-hero relative overflow-hidden rounded-2xl p-6 text-primary-foreground shadow-glow">
          <div className="bg-gradient-glow absolute inset-0 opacity-30" aria-hidden />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
              <Flame className="h-3.5 w-3.5" /> Daily streak
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-5xl font-bold">{streak}</span>
              <span className="text-sm opacity-80">day{streak === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-2 text-xs opacity-80">
              {streak === 0 ? "Start one today!" : streak < 3 ? "Keep going — you're warming up." : "🔥 You're on fire."}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={Trophy} label="Total XP" value={xp} />
        <Stat icon={Flame} label="Streak" value={`${streak}d`} />
        <Stat icon={Target} label="Quizzes" value={totalAttempts} />
        <Stat icon={Sparkles} label="Accuracy" value={`${accuracy}%`} />
      </div>

      {/* Daily mission + weekly chart */}
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <div className="bg-gradient-card rounded-2xl border border-border p-6 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">This week</h2>
            <span className="text-xs text-muted-foreground">Quiz attempts</span>
          </div>
          <div className="flex h-32 items-end justify-between gap-2">
            {weekly.map((w, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-md bg-gradient-hero transition-all"
                    style={{ height: `${(w.n / maxN) * 100}%`, minHeight: w.n ? "8%" : "2%", opacity: w.n ? 1 : 0.15 }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{w.d}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-card rounded-2xl border border-border p-6 shadow-card">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3.5 w-3.5" /> Daily mission
          </div>
          <h3 className="font-display text-lg font-semibold leading-tight">{mission.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Complete to earn +{mission.reward} XP</p>
          <Link to={mission.to}>
            <button className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background transition hover:opacity-90">
              Start now <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <h2 className="mt-10 mb-4 font-display text-xl font-semibold">Quick actions</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ActionCard to="/notes" icon={BookOpen} title="AI Notes" desc="Notes & flashcards on any topic." />
        <ActionCard to="/quiz" icon={Target} title="Adaptive Quiz" desc="MCQs that adapt to your level." />
        <ActionCard to="/plan" icon={CalendarRange} title="7-Day Plan" desc="Personalized schedule." />
        <ActionCard to="/chat" icon={MessageSquare} title="AI Tutor" desc="Threaded doubt chat." />
      </div>

      {/* Badges */}
      <h2 className="mt-10 mb-4 flex items-center gap-2 font-display text-xl font-semibold">
        Achievements
        <span className="text-sm font-normal text-muted-foreground">{unlockedBadges.length}/{BADGES.length}</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {[...unlockedBadges, ...lockedBadges].map((b) => {
          const unlocked = b.unlocked(stats);
          return (
            <div
              key={b.id}
              className={`rounded-2xl border p-4 transition ${
                unlocked
                  ? "bg-gradient-card border-border shadow-card"
                  : "border-dashed border-border/60 bg-muted/30"
              }`}
            >
              <div className={`mb-2 text-3xl ${unlocked ? "" : "grayscale opacity-40"}`}>{b.emoji}</div>
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                {b.name}
                {!unlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{b.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Recent activity */}
      <h2 className="mt-10 mb-4 font-display text-xl font-semibold">Recent activity</h2>
      <div className="bg-gradient-card rounded-2xl border border-border p-6 shadow-card">
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
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ActionCard({ to, icon: Icon, title, desc }: { to: string; icon: typeof Trophy; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="bg-gradient-card group rounded-2xl border border-border p-6 shadow-card transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-glow"
    >
      <Icon className="mb-3 h-6 w-6 text-primary" />
      <h3 className="text-lg font-semibold group-hover:text-primary">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}
