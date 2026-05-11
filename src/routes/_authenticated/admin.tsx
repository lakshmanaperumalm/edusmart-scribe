import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({ component: Admin });

function Admin() {
  const { roles } = useAuth();
  if (!roles.includes("admin")) return <div className="p-10 text-muted-foreground">Admin role required.</div>;

  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [u, q, n, p] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        supabase.from("quiz_attempts").select("id", { count: "exact", head: true }),
        supabase.from("notes").select("id", { count: "exact", head: true }),
        supabase.from("study_plans").select("id", { count: "exact", head: true }),
      ]);
      return { users: u.count ?? 0, attempts: q.count ?? 0, notes: n.count ?? 0, plans: p.count ?? 0 };
    },
  });

  return (
    <div className="px-6 py-8 md:px-10">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <h1 className="font-display text-3xl font-bold">Admin</h1>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {[
          { label: "Users", value: data?.users },
          { label: "Quiz attempts", value: data?.attempts },
          { label: "AI notes", value: data?.notes },
          { label: "Study plans", value: data?.plans },
        ].map((s) => (
          <div key={s.label} className="bg-gradient-card rounded-2xl border border-border p-5 shadow-card">
            <div className="text-3xl font-bold">{s.value ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
