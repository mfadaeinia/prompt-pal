type Line = { id: number; text: string };

type Props = {
  previous?: Line | null;
  current?: Line | null;
  next?: Line | null;
  /** Optional deep dive for a line. Never pauses playback. */
  onSelect?: (line: Line) => void;
  className?: string;
};

/**
 * Compact synchronized context: the sentence before, the one being spoken, and
 * the one coming next. Enough to follow the conversation without opening the
 * full transcript.
 */
export function ContextStrip({ previous, current, next, onSelect, className }: Props) {
  const rows: Array<{ line: Line | null | undefined; active: boolean }> = [
    { line: previous, active: false },
    { line: current, active: true },
    { line: next, active: false },
  ];

  return (
    <section
      className={`flex min-h-[180px] sm:min-h-[220px] flex-col rounded-xl border border-border bg-card p-4 shadow-sm ${className ?? ""}`}
    >
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Current context
      </h2>
      <div className="mt-3 space-y-2">
        {rows.map(({ line, active }, i) =>
          line ? (
            <button
              key={line.id}
              type="button"
              onClick={onSelect ? () => onSelect(line) : undefined}
              className={`block w-full rounded-md px-3 py-2 text-left transition-colors duration-150 ${
                active
                  ? "bg-primary/5 text-[17px] font-medium leading-snug text-foreground"
                  : "text-[14px] leading-snug text-muted-foreground hover:bg-muted"
              }`}
            >
              {line.text}
            </button>
          ) : (
            <div key={`empty-${i}`} className="px-3 py-2 text-[14px] text-muted-foreground/50">
              {i === 1 ? "Press play to follow along." : "—"}
            </div>
          ),
        )}
      </div>
    </section>
  );
}
