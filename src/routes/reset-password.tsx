import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({ component: ResetPassword });

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="bg-gradient-card w-full max-w-sm space-y-4 rounded-2xl border border-border p-6 shadow-card">
        <h1 className="font-display text-2xl font-bold">Set a new password</h1>
        <div><Label>New password</Label><Input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button className="w-full" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
      </form>
    </div>
  );
}
