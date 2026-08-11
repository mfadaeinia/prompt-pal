import { ChevronDown, Sparkles } from "lucide-react";

type Props = {
  /** The single recommendation that passed the quality gate, or null. */
  expression: { head: string; meaning: string; score?: number } | null;
  /** true while the sentence explanation is still loading */
  loading?: boolean;
  expanded: boolean;
  onToggle: () => void;
  className?: string;
};


/**
 * The quiet learning layer. Sits directly under the video, shows at most ONE
 * useful expression for the current moment, and never interrupts playback:
 * no modal, no dismissal, no auto-scroll, no aggressive motion. Reserves its
 * own height so expression changes don't shift the page.
 */
export function UsefulExpressionBar({
  expression,
  loading,
  expanded,
  onToggle,
  className,
}: Props) {
  return (
    <div
      className={`min-h-[76px] rounded-xl border border-border bg-card px-4 py-3 shadow-sm ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
        Useful expression
      </div>

      {expression ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="mt-1.5 grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left"
        >
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-foreground">
              {expression.head}
            </span>
            <span className="block truncate text-[13px] text-muted-foreground">
              {expression.meaning}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary">
            {expanded ? "Less" : "More"}
            <ChevronDown
              aria-hidden
              className={`h-3.5 w-3.5 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
            />
          </span>
        </button>
      ) : (
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {loading
            ? "Listening for useful language…"
            : "Keep watching — useful language will appear here."}
        </p>
      )}
    </div>
  );
}
