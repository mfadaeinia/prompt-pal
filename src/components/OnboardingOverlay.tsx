import { Play, MousePointerClick, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OnboardingOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-background/40 p-4 backdrop-blur-sm sm:items-center">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl ring-1 ring-primary/10 animate-in fade-in zoom-in-95">
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-accent"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <h3 className="text-base font-semibold tracking-tight">
            How to use the demo
          </h3>
        </div>

        <ol className="mt-5 space-y-4">
          <Step n={1} icon={<Play className="h-4 w-4" />} title="Play the video">
            Press play to start watching.
          </Step>
          <Step
            n={2}
            icon={<MousePointerClick className="h-4 w-4" />}
            title="Click any transcript sentence"
          >
            Tap a line in the transcript panel.
          </Step>
          <Step n={3} icon={<span className="text-base leading-none">💡</span>} title="See translation, meaning, and notes">
            Instant explanation appears on the side.
          </Step>
        </ol>

        <Button className="mt-6 w-full rounded-full" onClick={onDismiss}>
          Got it — let's go
        </Button>
      </div>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
        {n}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <span className="text-primary">{icon}</span> {title}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {children}
        </p>
      </div>
    </li>
  );
}
