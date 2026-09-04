import { useEffect, useRef, useState } from "react";
import { Play, Youtube, ArrowRight, BookOpen, BarChart3 } from "lucide-react";
import { track } from "@/lib/analytics";
import { setEntryPath } from "@/lib/entry-path";
import { StaticProductPreview } from "@/components/StaticProductPreview";
import { looksLikeUrl } from "@/components/WatchHub";

/* The one and only interactive demo destination — the real app with a curated Dutch video. */
const DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=GVk3rV4-J6k";

const heading = { fontFamily: "'Playfair Display', Georgia, serif" } as const;
const body = { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" } as const;

/**
 * Activation-first landing page.
 * Three jobs only: say what NativeFlow does, make the two real ways to start
 * obvious (own video / explore), and prove the interaction with a real example.
 */
export function MarketingLanding({
  onSubmitUrl,
  onSearch,
}: {
  onStartDemo?: () => void;
  onFeedback?: () => void;
  onSubmitUrl: (url: string) => void;
  /** Plain (non-URL) input is a YouTube search — handled by the Watch hub. */
  onSearch?: (query: string) => void;
}) {
  useEffect(() => {
    track("marketing_landing_seen", {});
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden bg-background text-foreground selection:bg-accent"
      style={body}
    >
      {/* Subtle lavender / pink glows around the hero edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-32 h-[28rem] w-[28rem] rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--brand-purple) 16%, transparent), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-64 h-[30rem] w-[30rem] rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--brand-pink) 14%, transparent), transparent 70%)" }}
      />
      <Hero onSubmitUrl={onSubmitUrl} onSearch={onSearch} />
    </div>
  );
}

function Hero({
  onSubmitUrl,
  onSearch,
}: {
  onSubmitUrl: (url: string) => void;
  onSearch?: (query: string) => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startDemo = (placement: string) => {
    setEntryPath("demo");
    track("demo_cta_clicked", { target: "try_the_demo", placement });
    onSubmitUrl(DEMO_VIDEO_URL);
  };

  return (
    <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
      <div className="flex flex-col items-center">
        {/* ---------- Pill ---------- */}
        <span className="inline-flex items-center rounded-full bg-accent px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
          Learn Dutch with real content
        </span>

        {/* ---------- Promise ---------- */}
        <h1
          className="mt-7 max-w-3xl text-center text-[2.25rem] font-bold leading-[1.08] tracking-tight sm:text-[3.25rem] lg:text-[3.75rem]"
          style={heading}
        >
          Watch real Dutch.
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(90deg, var(--brand-purple), var(--brand-pink))",
            }}
          >
            Never get lost.
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-center text-base leading-relaxed text-muted-foreground sm:text-lg">
          Watch Dutch YouTube with interactive subtitles. Tap any subtitle you don't
          understand for an explanation in context.
        </p>

        {/* ---------- Start with a video ---------- */}
        <UrlForm
          value={value}
          setValue={setValue}
          inputRef={inputRef}
          onSubmitUrl={onSubmitUrl}
          onSearch={onSearch}
        />
        <p className="mt-3 text-center text-sm text-muted-foreground">No account needed.</p>

        {/* ---------- Proof: real curated example ---------- */}
        <div className="relative mt-10 w-full min-w-0">
          {/* Decorative handwritten callouts (desktop only) */}
          <Callout
            className="left-[-2.5rem] top-[-3.5rem] xl:left-[-6rem]"
            lines={["Real videos.", "Real progress."]}
            arrow="left"
          />
          <Callout
            className="right-[-2.5rem] top-[-2.5rem] xl:right-[-6rem]"
            lines={["Click any subtitle", "to understand."]}
            arrow="right"
          />

          <div className="rounded-[2rem] border border-border bg-card p-3 shadow-[0_20px_60px_-30px_rgba(17,24,39,0.35)] sm:p-5">
            <StaticProductPreview onClick={() => startDemo("preview")} />
          </div>
        </div>

        {/* ---------- Secondary CTA ---------- */}
        <button
          type="button"
          onClick={() => startDemo("below_preview")}
          className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card px-7 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary"
        >
          Try the demo
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="mt-2.5 text-xs text-muted-foreground">See how interactive subtitles work</p>

        {/* ---------- Benefits ---------- */}
        <div className="mt-14 grid w-full gap-8 sm:grid-cols-3 sm:gap-6">
          <Benefit
            icon={<Youtube className="h-5 w-5 text-primary" />}
            tile="bg-accent"
            title="Authentic content"
            text="Learn with real Dutch YouTube videos"
          />
          <Benefit
            icon={<BookOpen className="h-5 w-5" style={{ color: "var(--brand-pink)" }} />}
            tile="bg-secondary"
            title="Instant explanations"
            text="Tap any subtitle for meaning and context"
          />
          <Benefit
            icon={<BarChart3 className="h-5 w-5" style={{ color: "var(--success)" }} />}
            tile="bg-muted"
            title="Make real progress"
            text="Build vocabulary naturally"
          />
        </div>
      </div>
    </section>
  );
}

function Benefit({
  icon,
  tile,
  title,
  text,
}: {
  icon: React.ReactNode;
  tile: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tile}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

/** Understated handwritten-style annotation with a curved arrow. */
function Callout({
  className,
  lines,
  arrow,
}: {
  className: string;
  lines: string[];
  arrow: "left" | "right";
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute hidden select-none xl:block ${className}`}
    >
      <p
        className="text-sm italic leading-snug text-muted-foreground/80"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", transform: "rotate(-6deg)" }}
      >
        {lines.map((l) => (
          <span key={l} className="block whitespace-nowrap">
            {l}
          </span>
        ))}
      </p>
      <svg
        viewBox="0 0 80 60"
        className={`mt-1 h-14 w-20 text-muted-foreground/50 ${arrow === "right" ? "-scale-x-100" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M6 6 C 20 40, 45 50, 72 46" />
        <path d="M62 38 L 73 46 L 61 51" />
      </svg>
    </div>
  );
}

function UrlForm({
  value,
  setValue,
  inputRef,
  onSubmitUrl,
  onSearch,
}: {
  value: string;
  setValue: (v: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onSubmitUrl: (url: string) => void;
  onSearch?: (query: string) => void;
}) {
  const trimmed = value.trim();
  return (
    <form
      className="mt-9 flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-center"
      style={body}
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed) return;
        if (!looksLikeUrl(trimmed) && onSearch) {
          setEntryPath("explore");
          onSearch(trimmed);
          return;
        }
        setEntryPath("own_url");
        track("own_video_url_submitted", { placement: "hero" });
        onSubmitUrl(trimmed);
      }}
    >
      <div className="relative flex-1">
        <Youtube className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/70" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Search Dutch YouTube or paste a link"
          placeholder="Search Dutch YouTube or paste a link..."
          inputMode="search"
          autoComplete="off"
          className="h-14 w-full rounded-full border border-border bg-card pl-13 pr-5 text-[0.95rem] text-foreground shadow-sm outline-none placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2 focus:ring-primary/15"
          style={{ paddingLeft: "3.25rem" }}
        />
      </div>
      <button
        type="submit"
        className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-full px-9 text-[0.95rem] font-semibold text-primary-foreground shadow-md transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(135deg, var(--brand-purple), color-mix(in oklab, var(--brand-pink) 55%, var(--brand-purple)))",
        }}
        disabled={!trimmed}
      >
        <Play className="h-4 w-4 fill-current" />
        Watch
      </button>
    </form>
  );
}
