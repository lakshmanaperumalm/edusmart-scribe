import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher")({ component: Teacher });

function Teacher() {
  const { roles } = useAuth();
  if (!roles.includes("teacher") && !roles.includes("admin")) {
    return <div className="p-10 text-muted-foreground">Teacher role required.</div>;
  }

  const { data: students } = useQuery({
    queryKey: ["all-students"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name, xp, streak, learning_style").order("xp", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  return (
    <div className="px-6 py-8 md:px-10">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-7 w-7 text-primary" />
        <h1 className="font-display text-3xl font-bold">Teacher Dashboard</h1>
      </div>
      <p className="mt-2 text-muted-foreground">Top students by XP. (Course management coming next iteration.)</p>

      <div className="bg-gradient-card mt-6 overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Style</th><th className="px-4 py-3">XP</th><th className="px-4 py-3">Streak</th></tr>
          </thead>
          <tbody>
            {students?.map((s) => (
              <tr key={s.user_id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{s.display_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.learning_style ?? "—"}</td>
                <td className="px-4 py-3">{s.xp}</td>
                <td className="px-4 py-3">{s.streak}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
