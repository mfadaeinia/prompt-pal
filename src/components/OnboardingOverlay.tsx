import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MousePointerClick, X, Sparkles } from "lucide-react";

/**
 * Lightweight first-time coachmark that anchors to the first interactive
 * transcript sentence. Dims the rest of the screen, pulses a ring on the
 * target sentence, and shows a tooltip ("Tap any sentence to see explanation").
 *
 * Non-blocking: pointer events pass through to the underlying sentence so the
 * user can simply tap to interact (which also dismisses the hint).
 */
export function SentenceCoachmark({
  containerRef,
  onDismiss,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    function measure() {
      const root = containerRef.current;
      if (!root) return;
      const target = root.querySelector<HTMLElement>("[data-sid]");
      if (!target) {
        setRect(null);
        return;
      }
      setRect(target.getBoundingClientRect());
    }
    measure();
    const id = window.setInterval(measure, 250); // cheap reposition on scroll/layout shifts
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [containerRef]);

  if (!rect) return null;

  const tooltipTop = Math.min(
    rect.bottom + 10,
    (typeof window !== "undefined" ? window.innerHeight : 800) - 120
  );
  const tooltipLeft = Math.max(12, Math.min(rect.left, (typeof window !== "undefined" ? window.innerWidth : 800) - 300));

  return (
    <>
      {/* Soft dim — pointer events pass through so the target stays tappable */}
      <div
        className="pointer-events-none fixed inset-0 z-40 bg-background/55 backdrop-blur-[1px] animate-in fade-in"
        aria-hidden
      />
      {/* Spotlight ring on the target sentence */}
      <div
        className="pointer-events-none fixed z-40 rounded-lg ring-2 ring-primary/80 shadow-[0_0_0_6px_rgba(0,0,0,0.0)] animate-pulse"
        style={{
          top: rect.top - 2,
          left: rect.left - 2,
          width: rect.width + 4,
          height: rect.height + 4,
        }}
        aria-hidden
      />
      {/* Tooltip */}
      <div
        role="tooltip"
        className="fixed z-50 flex max-w-[280px] items-start gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm shadow-2xl ring-1 ring-primary/20 animate-in fade-in slide-in-from-top-2"
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <MousePointerClick className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug text-foreground">
            Tap any sentence to see the explanation
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            The video pauses while you study.
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss hint"
          className="-mr-1 -mt-1 rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
}

/**
 * Reinforcement nudge shown when the user has played the video for a while
 * without interacting with the transcript. Small, non-blocking, auto-hides.
 */
export function PlayNudge({ onDismiss }: { onDismiss: () => void }) {
  const dismissedRef = useRef(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!dismissedRef.current) onDismiss();
    }, 8000);
    return () => window.clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="pointer-events-auto fixed bottom-24 left-1/2 z-40 -translate-x-1/2 sm:bottom-6">
      <div className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-3.5 py-2 text-[13px] shadow-lg ring-1 ring-primary/15 backdrop-blur animate-in fade-in slide-in-from-bottom-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium text-foreground">Try tapping a sentence for meaning</span>
        <button
          onClick={() => {
            dismissedRef.current = true;
            onDismiss();
          }}
          aria-label="Dismiss"
          className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-accent"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
