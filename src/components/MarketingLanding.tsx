import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Play, Youtube, MousePointerClick, ArrowRight } from "lucide-react";
import { track } from "@/lib/analytics";
import { setEntryPath } from "@/lib/entry-path";
import { StaticProductPreview } from "@/components/StaticProductPreview";

/* The one and only interactive demo destination — the real app with a curated Dutch video. */
const DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=GVk3rV4-J6k";

const heading = { fontFamily: "'Playfair Display', Georgia, serif" } as const;

/**
 * Activation-first landing page.
 * Three jobs only: say what NativeFlow does, make the two real ways to start
 * obvious (own video / explore), and prove the interaction with a real example.
 */
export function MarketingLanding({
  onSubmitUrl,
}: {
  onStartDemo?: () => void;
  onFeedback?: () => void;
  onSubmitUrl: (url: string) => void;
}) {
  useEffect(() => {
    track("marketing_landing_seen", {});
  }, []);

  return (
    <div
      className="relative w-full bg-[#F8FAFC] text-slate-900 selection:bg-accent"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <Hero onSubmitUrl={onSubmitUrl} />
    </div>
  );
}

function Hero({ onSubmitUrl }: { onSubmitUrl: (url: string) => void }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startDemo = (placement: string) => {
    setEntryPath("demo");
    track("demo_cta_clicked", { target: "try_the_demo", placement });
    onSubmitUrl(DEMO_VIDEO_URL);
  };

  return (
    <section className="mx-auto max-w-4xl px-6 pb-20 pt-12 sm:pt-16">
      <div className="flex flex-col items-center gap-10">
        {/* ---------- Promise ---------- */}
        <div className="max-w-xl text-center">
          <h1
            className="text-[2rem] font-bold leading-[1.12] tracking-tight text-slate-900 sm:text-[2.5rem] lg:text-[2.75rem]"
            style={heading}
          >
            Watch real Dutch.
            <br />
            Never get lost.
          </h1>

          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
            Watch Dutch YouTube with interactive subtitles. Tap any subtitle you don't
            understand for an explanation in context.
          </p>
        </div>

        {/* ---------- Mobile: fastest path is the working demo ---------- */}
        <div className="flex w-full flex-col items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => startDemo("mobile_hero")}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-[0.98] sm:w-auto"
            style={heading}
          >
            <MousePointerClick className="h-4 w-4" />
            Try the demo
          </button>
          <p className="text-xs text-slate-500">No account needed.</p>
        </div>

        {/* ---------- Start with your own video (primary on desktop) ---------- */}
        <div className="flex w-full flex-col items-center">
          <p className="text-sm font-semibold text-slate-500 lg:text-[0.95rem]">
            <span className="lg:hidden">Have your own video?</span>
            <span className="hidden lg:inline">Start with a video</span>
          </p>

          <UrlForm
            value={value}
            setValue={setValue}
            inputRef={inputRef}
            onSubmitUrl={onSubmitUrl}
          />

          <p className="mt-3 text-xs text-slate-400">or</p>

          <Link
            to="/library"
            onClick={() => {
              setEntryPath("explore");
              track("explore_dutch_clicked", { placement: "hero" });
            }}
            className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Explore Dutch videos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <p className="mt-4 hidden text-xs text-slate-500 lg:block">No account needed.</p>
        </div>

        {/* ---------- Proof: real curated example ---------- */}
        <div className="mt-4 w-full min-w-0">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
            See how it works
          </p>
          <StaticProductPreview onClick={() => startDemo("preview")} />
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => startDemo("below_preview")}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary"
              style={heading}
            >
              Try the demo
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function UrlForm({
  value,
  setValue,
  inputRef,
  onSubmitUrl,
}: {
  value: string;
  setValue: (v: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onSubmitUrl: (url: string) => void;
}) {
  const trimmed = value.trim();
  return (
    <form
      className="mt-3 flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed) return;
        setEntryPath("own_url");
        track("own_video_url_submitted", { placement: "hero" });
        onSubmitUrl(trimmed);
      }}
    >
      <div className="relative flex-1">
        <Youtube className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Paste a Dutch YouTube link"
          placeholder="Paste a Dutch YouTube link…"
          inputMode="url"
          autoComplete="off"
          className="h-12 w-full rounded-full border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>
      <button
        type="submit"
        className="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-7 text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
        style={heading}
        disabled={!trimmed}
      >
        <Play className="h-3.5 w-3.5 fill-current" />
        Watch
      </button>
    </form>
  );
}
