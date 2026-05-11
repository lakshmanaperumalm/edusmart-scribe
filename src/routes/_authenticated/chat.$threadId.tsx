import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { sendChatMessage } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({ component: ChatThread });

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string; created_at: string };

function ChatThread() {
  const { threadId } = useParams({ from: "/_authenticated/chat/$threadId" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const sendFn = useServerFn(sendChatMessage);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: msgs } = useQuery({
    queryKey: ["messages", threadId],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("chat_messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true });
      return (data ?? []) as Msg[];
    },
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, sending]);
  useEffect(() => { taRef.current?.focus(); }, [threadId]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setSending(true);
    // optimistic
    qc.setQueryData<Msg[]>(["messages", threadId], (old) => [...(old ?? []), { id: "tmp", role: "user", content: text, created_at: new Date().toISOString() }]);
    try {
      await sendFn({ data: { threadId, message: text } });
      await qc.invalidateQueries({ queryKey: ["messages", threadId] });
      await qc.invalidateQueries({ queryKey: ["threads", user?.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
      taRef.current?.focus();
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-10">
        <div className="mx-auto max-w-3xl space-y-6">
          {msgs?.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "user" ? (
                <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground">{m.content}</div>
              ) : (
                <div className="max-w-[85%] whitespace-pre-wrap text-foreground/90">{m.content}</div>
              )}
            </div>
          ))}
          {sending && <div className="text-sm text-muted-foreground">Thinking…</div>}
          <div ref={endRef} />
        </div>
      </div>
      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-3xl">
          <div className="bg-gradient-card flex items-end gap-2 rounded-2xl border border-border p-2">
            <Textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask anything... (Shift+Enter for newline)"
              className="min-h-[60px] resize-none border-0 bg-transparent focus-visible:ring-0"
            />
            <Button size="icon" onClick={send} disabled={!input.trim() || sending} className="bg-gradient-hero text-primary-foreground shadow-glow">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
