import { createFileRoute, Link, Outlet, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({ component: ChatLayout });

function ChatLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const { data: threads } = useQuery({
    queryKey: ["threads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("chat_threads").select("id, title, updated_at").eq("user_id", user!.id).order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  async function newThread() {
    if (!user) return;
    const { data, error } = await supabase.from("chat_threads").insert({ user_id: user.id }).select().single();
    if (error || !data) return;
    qc.invalidateQueries({ queryKey: ["threads", user.id] });
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }

  return (
    <div className="grid h-full md:grid-cols-[280px_1fr]">
      <aside className="flex flex-col border-r border-border p-4">
        <Button onClick={newThread} className="bg-gradient-hero text-primary-foreground shadow-glow"><Plus className="mr-2 h-4 w-4" /> New chat</Button>
        <div className="mt-4 flex-1 space-y-1 overflow-y-auto">
          {threads?.map((t) => {
            const isActive = path.endsWith(`/chat/${t.id}`);
            return (
              <Link key={t.id} to="/chat/$threadId" params={{ threadId: t.id }}
                className={cn("block truncate rounded-lg px-3 py-2 text-sm transition", isActive ? "bg-accent/60 text-foreground" : "text-foreground/80 hover:bg-accent/40")}>
                {t.title}
              </Link>
            );
          })}
          {!threads?.length && (
            <div className="mt-10 text-center text-xs text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-6 w-6 text-primary" />
              No conversations yet
            </div>
          )}
        </div>
      </aside>
      <Outlet />
    </div>
  );
}
