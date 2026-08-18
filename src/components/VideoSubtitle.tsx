type Props = {
  /** Dutch text of the sentence currently being spoken. */
  text: string;
  /** Expression inside the text worth noticing (rendered emphasized). */
  highlight?: string | null;
  /** Explicit tap on the highlighted expression (expression explanation). */
  onHighlightClick?: () => void;
  /** Explicit tap anywhere else in the subtitle (sentence explanation). */
  onSentenceClick?: () => void;
  /** Subtle, temporary first-time discovery hint rendered above the subtitle. */
  hint?: string | null;
  className?: string;
};

/** Split the sentence around the first case-insensitive occurrence of `phrase`. */
function splitAround(text: string, phrase?: string | null) {
  if (!phrase) return null;
  const i = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (i < 0) return null;
  return [text.slice(0, i), text.slice(i, i + phrase.length), text.slice(i + phrase.length)];
}

/**
 * Synchronized Dutch subtitle overlaid at the bottom of the video.
 *
 * Two distinct, non-overlapping interactions:
 *  - tap the highlighted expression  → expression explanation
 *  - tap anywhere else in the box    → whole-sentence explanation
 *
 * Automatic subtitle changes never trigger anything: only explicit taps do.
 */
export function VideoSubtitle({
  text,
  highlight,
  onHighlightClick,
  onSentenceClick,
  hint,
  className,
}: Props) {
  const parts = splitAround(text, highlight);
  const interactive = !!onSentenceClick;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-8 z-10 flex flex-col items-center gap-1.5 px-2 sm:bottom-14 sm:px-6 ${className ?? ""}`}
      aria-live="off"
    >
      {hint && (
        <div className="pointer-events-none max-w-[92%] animate-in fade-in slide-in-from-bottom-1 rounded-full bg-primary/95 px-3 py-1 text-center text-[11px] font-medium text-primary-foreground shadow-md sm:text-[13px]">
          {hint}
        </div>
      )}
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? "Explain this sentence" : undefined}
        onClick={interactive ? onSentenceClick : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSentenceClick?.();
                }
              }
            : undefined
        }
        className={`pointer-events-auto max-w-[96%] rounded-lg bg-black/75 px-2.5 py-2 text-center shadow-lg backdrop-blur-sm transition-colors duration-150 sm:px-4 sm:py-2.5 ${
          interactive
            ? "cursor-pointer hover:bg-black/85 active:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            : ""
        }`}
      >
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-white sm:line-clamp-none sm:text-[19px] md:text-[21px]">
          {parts ? (
            <>
              {parts[0]}
              <button
                type="button"
                onClick={(e) => {
                  // Expression and sentence explanations must never both fire.
                  e.stopPropagation();
                  onHighlightClick?.();
                }}
                className="rounded bg-primary/85 px-1 font-semibold text-primary-foreground underline decoration-primary-foreground/50 decoration-dotted underline-offset-2"
              >
                {parts[1]}
              </button>
              {parts[2]}
            </>
          ) : (
            text
          )}
        </p>
      </div>
    </div>
  );
}
