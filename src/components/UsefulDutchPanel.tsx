import { Sparkles, Star } from "lucide-react";
import type { UsefulExpression } from "@/lib/useful-expression";

export type QueuedExpression = UsefulExpression & {
  sentenceId: number;
  /** "current" = spoken now, "next" = coming up, "recent" = just heard. */
  state: "current" | "next" | "recent";
};

type Props = {
  items: QueuedExpression[];
  loading?: boolean;
  /** Deep dive for one expression. Never pauses playback. */
  onExplain: (item: QueuedExpression) => void;
  className?: string;
};

const STATE_LABEL: Record<QueuedExpression["state"], string> = {
  current: "Now",
  next: "Coming up",
  recent: "Just heard",
};

/**
 * The learning companion next to the video: one prominent expression for the
 * moment plus a few weaker ones from nearby in the video. Calm by design —
 * no popups, no auto-scroll, no animation beyond a soft fade.
 */
export function UsefulDutchPanel({ items, loading, onExplain, className }: Props) {
  const current = items.find((i) => i.state === "current") ?? items[0] ?? null;
  const others = items.filter((i) => i !== current);

  return (
    <section
      className={`flex min-h-[180px] sm:min-h-[220px] flex-col rounded-xl border border-border bg-card p-4 shadow-sm ${className ?? ""}`}
    >
      <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
        Useful Dutch
      </h2>

      {current ? (
        <>
          <div className="mt-3 rounded-lg bg-primary/5 px-3 py-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <Star className="h-3 w-3 fill-current" aria-hidden />
              {STATE_LABEL[current.state]}
            </div>
            <p className="mt-1 text-[20px] font-semibold leading-tight text-foreground md:text-[22px]">
              {current.head}
            </p>
            <p className="mt-1 text-[15px] leading-snug text-muted-foreground">{current.meaning}</p>
            <button
              type="button"
              onClick={() => onExplain(current)}
              className="mt-2 text-[13px] font-medium text-primary underline-offset-4 hover:underline"
            >
              Explain
            </button>
          </div>

          {others.length > 0 && (
            <ul className="mt-3 space-y-2.5">
              {others.map((it) => (
                <li key={`${it.sentenceId}-${it.head}`}>
                  <button
                    type="button"
                    onClick={() => onExplain(it)}
                    className="w-full rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-muted"
                  >
                    <span className="block text-[15px] font-medium text-foreground/80">
                      {it.head}
                    </span>
                    <span className="block text-[13px] text-muted-foreground">{it.meaning}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
          {loading
            ? "Listening for useful language…"
            : "Keep watching — expressions worth noticing will appear here."}
        </p>
      )}
    </section>
  );
}
