import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Sparkles, MessageSquare, Target, BarChart3, BookOpen, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Landing });

const features = [
  { icon: Sparkles, title: "AI Study Plans", desc: "Personalized 7-day plans tuned to your goals, weak areas, and learning style." },
  { icon: BookOpen, title: "Smart Notes & Flashcards", desc: "Generate notes, key points, and flashcards on any topic, at any depth." },
  { icon: Target, title: "Adaptive Quizzes", desc: "MCQs that get harder when you nail them and softer when you struggle." },
  { icon: MessageSquare, title: "Doubt-Solving Tutor", desc: "Threaded chat with a tutor that remembers your conversations." },
  { icon: BarChart3, title: "Progress Analytics", desc: "See accuracy, streaks, and exactly which topics need more love." },
  { icon: Brain, title: "Built for How You Learn", desc: "Visual, audio, reading, or hands-on — content adapts to you." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/auth"><Button>Get started</Button></Link>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="bg-gradient-glow absolute inset-x-0 top-0 h-[600px]" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center md:py-28">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" />
            Powered by Generative AI
          </div>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Your <span className="text-gradient">AI personal tutor</span>,<br />built around how you learn.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            RAW generates personalized study plans, notes, flashcards, and adaptive quizzes — and answers your doubts in real time.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="group h-12 bg-gradient-hero text-primary-foreground shadow-glow hover:opacity-95">
                Start learning free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/auth"><Button size="lg" variant="outline" className="h-12">I'm a teacher</Button></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-gradient-card rounded-2xl border border-border p-6 shadow-card transition hover:border-primary/40">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <Logo size={20} />
          <span>© {new Date().getFullYear()} RAW</span>
        </div>
      </footer>
    </div>
  );
}
