type Props = {
  /** Dutch text of the sentence currently being spoken. */
  text: string;
  /** Expression inside the text worth noticing (rendered emphasized). */
  highlight?: string | null;
  /**
   * Interaction state: true while the explanation for this sentence is open.
   * Normal watching keeps the expression calm (a quiet dotted underline — the
   * video stays dominant); an explicit tap promotes the SAME phrase to a
   * strong continuous highlight so the link "this phrase → this explanation"
   * is visually obvious. The phrase is always ONE semantic unit, never
   * tokenized into separate word boxes.
   */
  emphasized?: boolean;
  /** Explicit tap on the highlighted expression (expression explanation). */
  onHighlightClick?: () => void;
  /** Explicit tap anywhere else in the subtitle (sentence explanation). */
  onSentenceClick?: () => void;
  /** Subtle, temporary first-time discovery hint rendered above the subtitle. */
  hint?: string | null;
  /** Optional second line under the hint title. */
  hintSecondary?: string | null;
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
  emphasized = false,
  onHighlightClick,
  onSentenceClick,
  hint,
  hintSecondary,
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
        <div className="pointer-events-none relative mb-2 max-w-[94%] animate-in fade-in slide-in-from-bottom-1 rounded-xl border border-primary bg-primary px-4 py-2.5 text-center shadow-lg">
          <p className="text-[13px] font-bold text-primary-foreground sm:text-sm">
            {hint}
          </p>
          {hintSecondary && (
            <p className="mt-0.5 text-[12px] leading-snug text-primary-foreground/85 sm:text-[13px]">
              {hintSecondary}
            </p>
          )}
          {/* small pointer toward the subtitle */}
          <span
            aria-hidden
            className="absolute -bottom-[6px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-primary bg-primary"
          />
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
                // box-decoration-clone keeps a wrapped multi-word phrase
                // visually continuous — ONE expression, never word-sized boxes.
                className={
                  emphasized
                    ? "box-decoration-clone rounded bg-primary/85 px-1 font-semibold text-primary-foreground"
                    : "box-decoration-clone font-semibold underline decoration-primary-foreground/70 decoration-dotted underline-offset-4 transition-colors hover:decoration-solid"
                }
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
