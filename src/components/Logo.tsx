import { Brain } from "lucide-react";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center justify-center rounded-xl bg-gradient-hero shadow-glow"
        style={{ width: size + 8, height: size + 8 }}
      >
        <Brain className="text-primary-foreground" style={{ width: size - 4, height: size - 4 }} />
      </div>
      <span className="font-display text-lg font-bold tracking-tight">
        Lumen<span className="text-gradient">AI</span>
      </span>
    </div>
  );
}
