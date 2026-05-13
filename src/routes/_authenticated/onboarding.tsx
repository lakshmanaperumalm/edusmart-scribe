import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, Headphones, BookText, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({ component: Onboarding });

const STYLES = [
  { id: "visual", label: "Visual", desc: "Diagrams, charts, mind-maps", icon: Eye },
  { id: "audio", label: "Audio", desc: "Lectures, discussions", icon: Headphones },
  { id: "reading_writing", label: "Reading & Writing", desc: "Notes, articles", icon: BookText },
  { id: "practical", label: "Practical", desc: "Hands-on exercises", icon: Wrench },
] as const;

function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [style, setStyle] = useState<string>("visual");
  const [interests, setInterests] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, onboarded").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.display_name) setName(data.display_name);
      if (data?.onboarded) navigate({ to: "/dashboard" });
    });
  }, [user, navigate]);

  async function save() {
    if (!user) return;
    setBusy(true);
    try {
      const { completeOnboarding } = await import("@/lib/ai.functions");
      await completeOnboarding({
        data: {
          displayName: name || null,
          learningStyle: style as "visual" | "audio" | "reading_writing" | "practical",
          interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
          goals: goal ? [goal] : [],
        },
      });
      toast.success("Profile ready!");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-3xl font-bold">Let's personalize your tutor</h1>
      <p className="mt-2 text-muted-foreground">A few quick details so LumenAI can teach you the way you learn best.</p>

      <div className="mt-8 space-y-6">
        <div><Label>Your name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" /></div>

        <div>
          <Label>Preferred learning style</Label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition",
                  style === s.id ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card hover:border-primary/40",
                )}
              >
                <s.icon className="mb-2 h-5 w-5 text-primary" />
                <div className="font-semibold">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div><Label>Interests (comma-separated)</Label><Input value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="Math, Physics, Web Dev" /></div>
        <div><Label>Main goal</Label><Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ace my calculus midterm" /></div>

        <Button className="w-full bg-gradient-hero text-primary-foreground shadow-glow" disabled={busy} onClick={save}>
          {busy ? "Saving..." : "Continue to dashboard"}
        </Button>
      </div>
    </div>
  );
}
