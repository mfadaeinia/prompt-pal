import { useEffect, useRef, useState } from "react";
import { Play, Youtube, MousePointerClick, ArrowRight } from "lucide-react";
import { track } from "@/lib/analytics";
import { StaticProductPreview } from "@/components/StaticProductPreview";

/* The one and only interactive demo destination — the real app with a curated Dutch video. */
const DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=L6EWbqiRbME";

const heading = { fontFamily: "'Sora', system-ui, sans-serif" } as const;

/**
 * Activation-first landing page.
 * Three jobs only: say what NativeFlow does, show a real example, get the visitor
 * into the real product. No marketing sections.
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
      style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}
    >
      <Hero onSubmitUrl={onSubmitUrl} />
    </div>
  );
}

function Hero({ onSubmitUrl }: { onSubmitUrl: (url: string) => void }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startDemo = (placement: string) => {
    track("demo_cta_clicked", { target: "hero_try_demo", placement });
    onSubmitUrl(DEMO_VIDEO_URL);
  };

  return (
    <section className="mx-auto max-w-4xl px-6 pb-20 pt-12 sm:pt-16">
      <div className="flex flex-col items-center gap-10">
        {/* ---------- Promise + one obvious action ---------- */}
        <div className="max-w-xl text-center">
          <h1
            className="text-[2rem] font-bold leading-[1.12] tracking-tight text-slate-900 sm:text-[2.5rem] lg:text-[2.75rem]"
            style={heading}
          >
            Watch real Dutch.
            <br />
            Never get lost.
          </h1>

          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg">
            Tap anything you don't understand. NativeFlow explains it in context.
          </p>

          <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
            <button
              type="button"
              onClick={() => startDemo("hero")}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-[0.98] sm:w-auto"
              style={heading}
            >
              <MousePointerClick className="h-4 w-4" />
              Watch Demo
            </button>
            <p className="text-xs text-slate-500">No account needed.</p>
          </div>
        </div>

        {/* ---------- Real curated example, directly underneath ---------- */}
        <div className="w-full min-w-0">
          <StaticProductPreview onClick={() => startDemo("preview")} />
        </div>
      </div>


      {/* ---------- Secondary path: bring your own video ---------- */}
      <div className="mt-14 border-t border-slate-200 pt-7">
        <UrlForm
          value={value}
          setValue={setValue}
          inputRef={inputRef}
          onSubmitUrl={onSubmitUrl}
        />
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
    <>
      <p className="text-sm font-medium text-slate-500">Have your own Dutch video?</p>
      <form
        className="mt-3 flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed) return;
          track("marketing_hero_url_submitted", {});
          onSubmitUrl(trimmed);
        }}
      >
        <div className="relative flex-1">
          <Youtube className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Paste a Dutch YouTube link"
            placeholder="Paste a Dutch YouTube link…"
            inputMode="url"
            autoComplete="off"
            className="h-11 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary disabled:opacity-50"
          style={heading}
          disabled={!trimmed}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Watch
        </button>
      </form>
    </>
  );
}
