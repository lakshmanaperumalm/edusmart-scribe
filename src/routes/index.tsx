import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Brain, Sparkles, MessageSquare, Target, BarChart3, BookOpen,
  ArrowRight, Shield, Zap, Lock, Star, Users, TrendingUp, Check,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RAW — Your AI Personal Tutor" },
      { name: "description", content: "Personalized study plans, smart notes, adaptive quizzes, and an AI tutor that answers your doubts in real time." },
      { property: "og:title", content: "RAW — Your AI Personal Tutor" },
      { property: "og:description", content: "Learn smarter with an AI tutor built around how you learn." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Sparkles, title: "AI Study Plans", desc: "Personalized 7-day plans tuned to your goals, weak areas, and learning style." },
  { icon: BookOpen, title: "Smart Notes & Flashcards", desc: "Generate notes, key points, and flashcards on any topic, at any depth." },
  { icon: Target, title: "Adaptive Quizzes", desc: "MCQs that get harder when you nail them and softer when you struggle." },
  { icon: MessageSquare, title: "Doubt-Solving Tutor", desc: "Threaded chat with a tutor that remembers your conversations." },
  { icon: BarChart3, title: "Progress Analytics", desc: "See accuracy, streaks, and exactly which topics need more love." },
  { icon: Brain, title: "Built for How You Learn", desc: "Visual, audio, reading, or hands-on — content adapts to you." },
];

const stats = [
  { value: "12K+", label: "Active learners" },
  { value: "1.2M", label: "Questions answered" },
  { value: "94%", label: "Report better grades" },
  { value: "4.9★", label: "Student rating" },
];

const testimonials = [
  { name: "Aanya R.", role: "NEET aspirant", quote: "RAW caught my weak topics in biology before my mock test did. Jumped 18% in two weeks." },
  { name: "Devin K.", role: "CS undergrad", quote: "The doubt tutor is like having a TA on call. It actually walks through the reasoning instead of dumping answers." },
  { name: "Mei L.", role: "High school junior", quote: "Adaptive quizzes feel like a game. My streak is the only one I actually care about keeping." },
];

function Landing() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Sticky nav */}
      <header
        className={`sticky top-0 z-50 transition-all ${
          scrolled
            ? "border-b border-border bg-background/80 backdrop-blur-lg"
            : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#loved" className="hover:text-foreground">Reviews</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth"><Button size="sm">Get started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-gradient-glow absolute inset-x-0 top-0 h-[600px]" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center md:py-28 animate-fade-in">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3" />
            Powered by Generative AI · Built for 2026
          </div>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Learn smarter with your <span className="text-gradient">personal AI tutor</span>.
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
            <a href="#features">
              <Button size="lg" variant="outline" className="h-12">See what's inside</Button>
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-foreground" /> No credit card</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-foreground" /> Free forever plan</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-foreground" /> Cancel anytime</span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mx-auto max-w-5xl px-6 pb-16">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-background px-6 py-6 text-center">
                <div className="font-display text-2xl font-bold md:text-3xl">{s.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Everything you need to study, in one place.</h2>
          <p className="mt-3 text-muted-foreground">No more juggling 7 tabs. RAW handles plans, notes, quizzes, and doubts under one calm interface.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="bg-gradient-card group rounded-2xl border border-border p-6 shadow-card transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Three steps to your sharpest study session.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { n: "01", title: "Tell RAW your goal", desc: "Exam date, subjects, weak topics, and how you learn best." },
              { n: "02", title: "Get a personal plan", desc: "A day-by-day schedule with notes, flashcards, and quizzes ready to go." },
              { n: "03", title: "Improve every day", desc: "Adaptive quizzes and analytics show exactly what to revise next." },
            ].map((s) => (
              <div key={s.n} className="bg-card rounded-2xl border border-border p-6">
                <div className="font-display text-3xl font-bold text-muted-foreground/40">{s.n}</div>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="loved" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Loved by students who hate wasted study time.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="bg-gradient-card rounded-2xl border border-border p-6 shadow-card">
              <div className="mb-3 flex gap-0.5 text-foreground">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="text-sm leading-relaxed">"{t.quote}"</blockquote>
              <figcaption className="mt-4 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t.name}</span> · {t.role}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-hero p-12 text-center text-primary-foreground shadow-glow md:p-16">
          <div className="bg-gradient-glow absolute inset-0 opacity-30" aria-hidden />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold md:text-5xl">Your next study session starts now.</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm opacity-80 md:text-base">Free to start. Built for serious learners. No credit card required.</p>
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="mt-8 h-12">
                Start learning free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-8 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> SOC 2 in progress</span>
          <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Encrypted at rest</span>
          <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> GDPR friendly</span>
          <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> 99.9% uptime</span>
          <span className="inline-flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Trusted by 12K+ students</span>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <Logo size={20} />
          <span>© {new Date().getFullYear()} RAW · Learn smarter</span>
        </div>
      </footer>
    </div>
  );
}
