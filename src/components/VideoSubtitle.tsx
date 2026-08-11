type Props = {
  /** Dutch text of the sentence currently being spoken. */
  text: string;
  /** Expression inside the text worth noticing (rendered emphasized). */
  highlight?: string | null;
  /** Optional: clicking the highlighted phrase. NEVER pauses playback. */
  onHighlightClick?: () => void;
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
 * Synchronized Dutch subtitle, overlaid at the bottom of the video. Read-only
 * by default: it never pauses playback and never covers the player controls.
 */
export function VideoSubtitle({ text, highlight, onHighlightClick, className }: Props) {
  const parts = splitAround(text, highlight);

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-8 z-10 flex justify-center px-2 sm:bottom-14 sm:px-6 ${className ?? ""}`}
      aria-live="off"
    >
      <p className="pointer-events-auto line-clamp-2 max-w-[96%] rounded-lg bg-black/75 px-2.5 py-1.5 text-center text-[13px] font-medium leading-snug text-white shadow-lg backdrop-blur-sm sm:line-clamp-none sm:px-4 sm:py-2 sm:text-[19px] md:text-[21px]">
        {parts ? (
          <>
            {parts[0]}
            <button
              type="button"
              onClick={onHighlightClick}
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
  );
}
