import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: () => (
    <div className="flex h-full items-center justify-center p-10 text-center">
      <div>
        <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h2 className="font-display text-2xl font-bold">Ask the AI tutor anything</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">Start a new chat to explore concepts, get step-by-step explanations, and clear your doubts.</p>
      </div>
    </div>
  ),
});
