import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Play,
  Check,
  
  Languages,
  BookOpen,
  Youtube,
  GraduationCap,
  Quote,
  Bookmark,
  Globe,
  Zap,
  Search,
  Pause,
  X,
  MousePointerClick,
} from "lucide-react";
import { track } from "@/lib/analytics";
import { LibraryStrip } from "@/components/LibraryStrip";
import heroCollage from "@/assets/hero-collage.png.asset.json";
import youtubePlayer from "@/assets/youtube-player.png.asset.json";
import productMock from "@/assets/product-mock-v3.png.asset.json";
import founderPhoto from "@/assets/founder-mahta.png.asset.json";

/* Demo embed used by both the modal (mobile) and the inline example (tablet+). */
const DEMO_EMBED_SRC =
  "/?embed=1&url=" + encodeURIComponent("https://www.youtube.com/watch?v=3GHwKtBtdfk");

/**
 * Mission-first landing — philosophy over features.
 * NativeFlow is a bridge between authentic content and language growth.
 */
export function MarketingLanding({
  onFeedback,
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
      className="relative w-full overflow-hidden text-slate-900 selection:bg-accent"
      style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}
    >
      {/* Faded collage background — fixed so it persists while scrolling */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <img
          src={heroCollage.url}
          alt=""
          width={1562}
          height={1007}
          className="absolute inset-0 h-full w-full object-cover object-top opacity-[0.07]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#F8FAFC]/60 via-[#F8FAFC]/90 to-[#F8FAFC]" />
      </div>

      <div className="relative z-10">
        <Hero onSubmitUrl={onSubmitUrl} />

        <CompetitorComparison />
        <HowItWorks />
        <Comparison />
        <Features />
        <LibraryPromo />
        <FounderNote onFeedback={onFeedback} />
      </div>
    </div>
  );
}

const heading = { fontFamily: "'Sora', system-ui, sans-serif" } as const;

/* ============================== HERO ============================== */

// Peek tiles that wrap around the product mock on tablet+ so the screenshot
// feels embedded in the content ecosystem instead of floating above it.
const PEEK_TILES = [
  {
    src: "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=500&q=75",
    alt: "News broadcast",
    cls: "absolute -top-6 -left-10 w-28 sm:w-36 rotate-[-4deg]",
  },
  {
    src: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=500&q=75",
    alt: "Podcast",
    cls: "absolute -top-10 right-6 w-24 sm:w-32 rotate-[5deg]",
  },
  {
    src: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=500&q=75",
    alt: "TED talk",
    cls: "absolute -bottom-8 -left-6 w-28 sm:w-36 rotate-[3deg]",
  },
  {
    src: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&q=75",
    alt: "Interview",
    cls: "absolute -bottom-10 right-0 w-24 sm:w-32 rotate-[-4deg]",
  },
];

// Small mobile tiles — many of them, used as background texture only.
const MOBILE_TILES = [
  "photo-1495020689067-958852a7765e", // news
  "photo-1478737270239-2f02b77fc618", // podcast
  "photo-1505373877841-8d25f7d46678", // ted
  "photo-1573496359142-b8d87734a5a2", // interview
  "photo-1485579149621-3123dd979885", // mic
  "photo-1517245386807-bb43f82c33c4", // documentary
  "photo-1522202176988-66273c2fd55f", // discussion
  "photo-1556761175-5973dc0f32e7", // newsroom
  "photo-1531058020387-3be344556be6", // youtuber
  "photo-1551817958-d9d86fb29431", // podcast2
  "photo-1494059980473-813e73ee784b", // talk
  "photo-1540317580384-e5d43616b9aa", // creator
  "photo-1492724441997-5dc865305da7", // tv
  "photo-1581368087028-4f4f5e0c5d6a", // interview2
  "photo-1551836022-d5d88e9218df", // mic2
  "photo-1503676260728-1c00da094a0b", // educational
];

function Hero({ onSubmitUrl }: { onSubmitUrl: (url: string) => void }) {

  const [value, setValue] = useState("");
  const [demoOpen, setDemoOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = value.trim();

  const focusHeroInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => el.focus(), 350);
  };

  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <img
          src={heroCollage.url}
          alt=""
          width={1562}
          height={1007}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-top opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#F8FAFC]/70 via-[#F8FAFC]/85 to-[#F8FAFC]" />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 pt-12 pb-14 text-center sm:pt-16 sm:pb-20 min-[1600px]:max-w-4xl min-[1600px]:pt-20">
        <span
          className="mb-5 inline-block text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80"
          style={heading}
        >
          For Dutch learners who watch YouTube
        </span>

        <h1
          className="text-3xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]"
          style={heading}
        >
          Paste any Dutch video. Understand every sentence.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-700 sm:text-lg">
          Tap any sentence to get an instant explanation in context: meaning, expressions and grammar.
        </p>

        <form
          className="mx-auto mt-8 flex w-full max-w-2xl flex-col gap-2.5 sm:flex-row sm:items-center sm:rounded-full sm:border sm:border-slate-200 sm:bg-white sm:p-1.5 sm:shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!trimmed) return;
            track("marketing_hero_url_submitted", {});
            onSubmitUrl(trimmed);
          }}
        >
          <div className="relative flex-1">
            <Youtube className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="Paste a Dutch YouTube video link"
              placeholder="Paste a Dutch YouTube link…"
              inputMode="url"
              autoComplete="off"
              className="h-12 w-full rounded-full border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary sm:border-transparent sm:shadow-none sm:focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
            style={heading}
            disabled={!trimmed}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Watch and learn
          </button>
        </form>

        <div className="mt-3.5 flex justify-center">
          <button
            type="button"
            onClick={() => {
              track("marketing_cta_clicked", { target: "watch_demo_modal" });
              setDemoOpen(true);
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white/70 px-6 text-sm font-semibold text-slate-700 transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary"
            style={heading}
          >
            <MousePointerClick className="h-4 w-4" />
            Watch demo
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">No account needed to try it</p>
      </div>

      {demoOpen && (
        <DemoModal
          onClose={() => setDemoOpen(false)}
          onTryOwn={() => {
            setDemoOpen(false);
            track("marketing_cta_clicked", { target: "demo_modal_try_own" });
            requestAnimationFrame(focusHeroInput);
          }}
        />
      )}
    </section>
  );
}

/* ============================== DEMO MODAL ============================== */

const DEMO_EMBED_SRC =
  "/?embed=1&url=" + encodeURIComponent("https://www.youtube.com/watch?v=3GHwKtBtdfk");

function DemoModal({ onClose, onTryOwn }: { onClose: () => void; onTryOwn: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="NativeFlow interactive demo"
    >
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <span className="text-sm font-semibold text-slate-900" style={heading}>
            Try it — tap any sentence
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close demo"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-slate-50">
          <iframe
            src={DEMO_EMBED_SRC}
            title="NativeFlow interactive demo"
            className="h-full min-h-[50vh] w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          />
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={onTryOwn}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-[0.98]"
            style={heading}
          >
            <Youtube className="h-4 w-4" />
            Try with your own video
          </button>
        </div>
      </div>
    </div>
  );
}


function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <div
        className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400"
        style={heading}
      >
        {label}
      </div>
      {children}
    </section>
  );
}

/* ============================== COMPETITOR COMPARISON ============================== */

function CompetitorComparison() {
  return (
    <section id="why" className="scroll-mt-24">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24 min-[1600px]:max-w-[1400px] min-[1600px]:px-12 min-[1600px]:py-[4.5rem]">
        <h2
          className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl"
          style={heading}
        >
          Other tools let you click a word. NativeFlow lets you understand a sentence.
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-2 min-[1600px]:mt-10 min-[1600px]:gap-8">
          {/* LEFT — Word-by-word tools */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-7">
            <h3
              className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500"
              style={heading}
            >
              Word-by-word tools
            </h3>
            <ul className="mt-6 space-y-3">
              <li className="flex items-start gap-3 text-sm text-slate-600 min-[1600px]:text-[0.9375rem]">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
                  1
                </span>
                Click a single word → get a dictionary definition
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600 min-[1600px]:text-[0.9375rem]">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
                  2
                </span>
                Lose the meaning of the full expression
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600 min-[1600px]:text-[0.9375rem]">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
                  3
                </span>
                Miss idioms, slang, and context entirely
              </li>
            </ul>
          </div>

          {/* RIGHT — NativeFlow */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-accent/60 p-7">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative">
              <h3
                className="text-sm font-semibold uppercase tracking-[0.15em] text-primary"
                style={heading}
              >
                NativeFlow
              </h3>
              <ul className="mt-6 space-y-3">
                <li className="flex items-start gap-3 text-sm text-slate-900 min-[1600px]:text-[0.9375rem]">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    1
                  </span>
                  Tap any full sentence → get instant translation
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-900 min-[1600px]:text-[0.9375rem]">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    2
                  </span>
                  See the expression explained in context
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-900 min-[1600px]:text-[0.9375rem]">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    3
                  </span>
                  Understand idioms and Dutch expressions as natives use them
                </li>
              </ul>
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-lg font-bold text-slate-900">
          Because Dutch isn't just words. It's expressions.
        </p>
      </div>
    </section>
  );
}

/* ============================== CONTENT TYPES ============================== */

function HowItWorks() {
  const steps = [
    {
      icon: <Search className="h-5 w-5" />,
      title: "Pick your video",
      body: "Paste your own YouTube link, search for one, or pick from our suggestions.",
    },
    {
      icon: <MousePointerClick className="h-5 w-5" />,
      title: "Tap any sentence",
      body: "See the instant translation, expression notes, and key vocab for that exact sentence. While the video is right there.",
    },
    {
      icon: <Bookmark className="h-5 w-5" />,
      title: "Save what sticks",
      body: "One tap saves any word or phrase to your personal vocab list. Review it anytime.",
    },
  ];
  return (
    <section className="border-t border-slate-200">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24 min-[1600px]:max-w-[1400px] min-[1600px]:px-12 min-[1600px]:py-[4.5rem]">
        <h2
          className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl"
          style={heading}
        >
          Three steps. No friction.
        </h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
          {steps.map((s) => (
            <div key={s.title} className="flex flex-col items-start">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                {s.icon}
              </div>
              <h3 className="text-base font-semibold text-slate-900" style={heading}>
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ============================== COMPARISON ============================== */

function Comparison() {
  const oldWay = ["Watch what you love", "Miss meaning", "Lose focus", "Give up", "Try again", "Stay stuck"];
  const newWay = ["Watch what you love", "Understand more", "Stay engaged", "Grow naturally"];

  return (
    <section className="mx-auto max-w-7xl px-6 py-24 sm:py-28 min-[1600px]:max-w-[1400px] min-[1600px]:px-12 min-[1600px]:py-[5.25rem]">
      <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
        <h2
          className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          style={heading}
        >
          Content Should Teach You. Not Frustrate You.
        </h2>
        <p className="mt-3 text-base text-slate-600 sm:text-lg">
          Real content is the best teacher, when you have just enough support to follow it.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* OLD WAY */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <X className="h-3.5 w-3.5" />
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
              style={heading}
            >
              Without Support
            </span>
          </div>
          <ol className="space-y-2.5">
            {oldWay.map((step, i) => (
              <li
                key={step}
                className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-2.5"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-semibold text-slate-500"
                  style={heading}
                >
                  {i + 1}
                </span>
                <span className="text-sm text-slate-700">{step}</span>
                {step === "Lose focus" && <Pause className="ml-auto h-3.5 w-3.5 text-slate-400" />}
                {step === "Miss meaning" && <Search className="ml-auto h-3.5 w-3.5 text-slate-400" />}
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm leading-relaxed text-slate-500">
            Breaks your flow. Kills your motivation.
          </p>
        </div>

        {/* NEW WAY */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-accent/60 p-7 shadow-sm">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative mb-6 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary"
              style={heading}
            >
              With NativeFlow
            </span>
          </div>
          <ol className="relative space-y-2.5">
            {newWay.map((step, i) => (
              <li
                key={step}
                className="flex items-center gap-3 rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 shadow-sm"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-white"
                  style={heading}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-slate-900">{step}</span>
                {step === "Understand more" && (
                  <MousePointerClick className="ml-auto h-3.5 w-3.5 text-primary" />
                )}
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm leading-relaxed text-slate-700">
            Stay in the flow. Understand more. Enjoy more.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ============================== FEATURES ============================== */

function Features() {
  const items = [
    {
      icon: <Globe className="h-5 w-5" />,
      title: "Learn Dutch by watching your favorite content",
      body: "Learn from the podcasts, videos, and interviews\u00a0 available on Youtube.",
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: "Comprehension on demand",
      body: "Get the exact support you need, exactly when you need it, then keep watching.",
    },
    {
      icon: <Bookmark className="h-5 w-5" />,
      title: "Build your own learning path",
      body: "Save expressions, revisit them, and watch your understanding grow over time.",
    },
    {
      icon: <Languages className="h-5 w-5" />,
      title: "Stay in the flow",
      body: "Never search, or switch tabs. Stay immersed in the content you love.",
    },
  ];
  return (
    <section className="border-y border-slate-200">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-28 min-[1600px]:max-w-[1400px] min-[1600px]:px-12 min-[1600px]:py-[5.25rem]">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-14">
          <h2
            className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
            style={heading}
          >
            A Bridge Between Content and Growth
          </h2>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">
            Support your listening. Don't replace it.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 transition-all hover:border-slate-300 hover:bg-white"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
                {b.icon}
              </div>
              <h3 className="text-base font-semibold text-slate-900" style={heading}>
                {b.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================== FOUNDER NOTE ============================== */

function LibraryPromo() {
  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Explore our curated library
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-slate-600">
            Don't know where to start? Choose from professionally curated YouTube videos
            organized by level and topic.
          </p>
        </div>
        <div className="mt-8">
          <LibraryStrip
            source="landing"
            title="Weekly picks and beginner-friendly lessons"
            subtitle="Filter by CEFR level and jump straight into a lesson."
            limit={4}
          />
        </div>
      </div>
    </section>
  );
}

function FounderNote({ onFeedback }: { onFeedback?: () => void }) {
  return (
    <section className="border-t border-slate-200 bg-[#F8FAFC]">
      <div className="mx-auto max-w-4xl px-6 py-20 sm:py-24">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
          <div className="shrink-0">
            <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white shadow-md sm:h-32 sm:w-32">
              <img
                src={founderPhoto.url}
                alt="Mahta, founder of NativeFlow"
                width={256}
                height={256}
                className="h-full w-full object-cover object-top"
              />
            </div>
          </div>
          <div className="text-center sm:text-left">
            <h2
              className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
              style={heading}
            >
              Why I built this.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-700 sm:text-lg">
              I'm Mahta. I moved to the Netherlands in 2015, and picking up Dutch has been a slow
              climb ever since. I could follow the gist of a video, but the expressions and slang
              always slipped past me, and no tool ever explained them well.
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate-700 sm:text-lg">
              I'm a software engineer working on medical devices, and I built NativeFlow in the hours
              I have outside a full-time job and two small kids, so it's still rough in places. If
              you try it, I'd genuinely like to hear{" "}
              {onFeedback ? (
                <button
                  onClick={onFeedback}
                  className="font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
                >
                  what's not working
                </button>
              ) : (
                <span className="font-medium text-primary">what's not working</span>
              )}
              .
            </p>

          </div>
        </div>
      </div>
    </section>
  );
}





