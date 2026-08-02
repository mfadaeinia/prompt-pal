import { cn } from "@/lib/utils";

/**
 * NativeFlow brand mark: an abstract flowing "N" ribbon drawn as one continuous
 * rounded stroke, filled with the brand gradient (#FF5A3D → #FF2D7A → #7B3FF2).
 *
 * Inline SVG so it stays crisp at every size and can be themed via `tone`.
 */
export function BrandMark({ className, gradientId = "nf-mark" }: { className?: string; gradientId?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-8 w-8", className)} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF5A3D" />
          <stop offset="50%" stopColor="#FF2D7A" />
          <stop offset="100%" stopColor="#7B3FF2" />
        </linearGradient>
      </defs>
      <path
        d="M15 49V19L49 45V15"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type BrandLogoProps = {
  /** Hide the wordmark and render the icon only. */
  iconOnly?: boolean;
  /** Wordmark color: light surfaces use `dark` text, dark surfaces use `light`. */
  tone?: "dark" | "light";
  /** Optional tagline under the wordmark (landing / auth hero use). */
  tagline?: boolean;
  className?: string;
  markClassName?: string;
  wordClassName?: string;
  gradientId?: string;
};

export function BrandLogo({
  iconOnly = false,
  tone = "dark",
  tagline = false,
  className,
  markClassName,
  wordClassName,
  gradientId,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <BrandMark className={cn("h-8 w-8 shrink-0", markClassName)} gradientId={gradientId} />
      {!iconOnly && (
        <span className="flex min-w-0 flex-col leading-none">
          <span
            className={cn(
              "font-display text-[1.15rem] font-bold tracking-[-0.03em]",
              tone === "light" ? "text-white" : "text-foreground",
              wordClassName,
            )}
          >
            NativeFlow
          </span>
          {tagline && (
            <span
              className={cn(
                "mt-1 text-[0.7rem] font-medium tracking-tight",
                tone === "light" ? "text-white/70" : "text-muted-foreground",
              )}
            >
              Language that flows.
            </span>
          )}
        </span>
      )}
    </span>
  );
}

export default BrandLogo;
