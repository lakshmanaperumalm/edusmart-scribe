import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { Shield, ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) throw redirect({ to: "/auth" });
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", sess.session.user.id);
    const roles = (roleRows ?? []).map((r) => r.role);
    if (!roles.includes("admin")) throw redirect({ to: "/dashboard" });
  },
  component: Admin,
});

type AuditRow = {
  id: string;
  table_name: string;
  action: string;
  actor_id: string | null;
  target_row_id: string | null;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
};

function Admin() {
  const { roles } = useAuth();
  if (!roles.includes("admin")) return null;

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

  const { data: audit, isLoading: auditLoading } = useQuery({
    queryKey: ["admin-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, table_name, action, actor_id, target_row_id, before_data, after_data, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
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

      <div className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-semibold">Audit log</h2>
          <span className="text-xs text-muted-foreground">Last 100 events · admin-only</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Table</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Change</th>
                </tr>
              </thead>
              <tbody>
                {auditLoading && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!auditLoading && (audit?.length ?? 0) === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No events yet.</td></tr>
                )}
                {audit?.map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium">{row.table_name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.action === "INSERT" ? "bg-emerald-100 text-emerald-700" :
                        row.action === "UPDATE" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>{row.action}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {row.actor_id ? row.actor_id.slice(0, 8) : "system"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {row.target_row_id ? row.target_row_id.slice(0, 8) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <details>
                        <summary className="cursor-pointer text-xs text-primary">View diff</summary>
                        <pre className="mt-2 max-w-md overflow-x-auto rounded bg-muted p-2 text-[10px] leading-tight">
{JSON.stringify({ before: row.before_data, after: row.after_data }, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
