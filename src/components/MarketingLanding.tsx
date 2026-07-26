import { useEffect, type ReactNode } from "react";
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
import heroCollage from "@/assets/hero-collage.png.asset.json";
import youtubePlayer from "@/assets/youtube-player.png.asset.json";
import productMock from "@/assets/product-mock-v3.png.asset.json";
import tedLogo from "@/assets/ted-logo.png.asset.json";

/**
 * Mission-first landing — philosophy over features.
 * NativeFlow is a bridge between authentic content and language growth.
 */
export function MarketingLanding({
  onStartDemo,
  onSignUp,
}: {
  onStartDemo: () => void;
  onSignUp: () => void;
}) {
  useEffect(() => {
    track("marketing_landing_seen", {});
  }, []);

  const handleSignUp = () => {
    track("try_for_free_clicked", { source: "marketing_landing" });
    onSignUp();
  };
  const handleDemo = () => {
    track("marketing_cta_clicked", { target: "demo" });
    onStartDemo();
  };

  return (
    <div
      className="relative w-full overflow-hidden text-slate-900 selection:bg-blue-200"
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
        <Hero onPrimary={handleSignUp} onSecondary={handleDemo} />
        <CompetitorComparison />
        <HowItWorks />
        <Comparison />
        <Features />
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

function Hero({ onPrimary, onSecondary }: { onPrimary: () => void; onSecondary: () => void }) {
  return (
    <section className="relative overflow-hidden">
      {/* ============== BACKGROUND — MOBILE & TABLET: very faded collage ============== */}
      <div aria-hidden className="pointer-events-none absolute inset-0 lg:hidden">
        <img
          src={heroCollage.url}
          alt=""
          width={1562}
          height={1007}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-top opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#F8FAFC]/40 via-[#F8FAFC]/70 to-[#F8FAFC]" />
      </div>


      {/* ============== BACKGROUND — DESKTOP: collage concentrated on right ~60% ============== */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
        <img
          src={heroCollage.url}
          alt=""
          width={1562}
          height={1007}
          fetchPriority="high"
          className="absolute inset-y-0 right-0 h-full w-[60%] object-cover object-left"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#F8FAFC] from-15% via-[#F8FAFC]/20 via-35% to-transparent to-55%" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#F8FAFC] to-transparent" />
      </div>


      <div className="relative mx-auto max-w-7xl px-6 pt-4 pb-16 sm:pt-6 sm:pb-24 md:pt-8 md:pb-28 lg:pb-24">
        <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[1fr_0.95fr] lg:gap-12">
          <div className="max-w-xl md:pl-12 lg:pl-0">
            <span
              className="mb-5 inline-block text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600/80 sm:mb-6"
              style={heading}
            >
              For Dutch learners who watch YouTube
            </span>

            <h1
              className="text-3xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-4xl lg:text-[2.5rem]"
              style={heading}
            >
              Turn any Dutch YouTube video into an interactive lesson.
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-700 sm:mt-6 sm:text-lg">
              Click any subtitle to instantly understand its meaning, expressions and context.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:max-w-sm">
              <button
                onClick={onSecondary}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98]"
                style={heading}
              >
                <Play className="h-4 w-4 fill-white text-white" />
                Demo
              </button>
              <button
                onClick={onPrimary}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/95 px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur transition-all hover:bg-white"
                style={heading}
              >
                Try it Free
              </button>
            </div>
          </div>


          <div className="relative mx-auto w-full">
            <ProductMock />
          </div>
        </div>
      </div>
    </section>
  );
}




function ProductMock() {
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-2xl">
      <img
        src={productMock.url}
        alt="NativeFlow product preview — Dutch sentence explanation"
        width={1658}
        height={949}
        className="block w-full h-auto"
        style={{ transform: "scale(1.02)" }}
      />
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
    <section>
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <h2
          className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl"
          style={heading}
        >
          Other tools let you click a word. NativeFlow lets you understand a sentence.
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* LEFT — Word-by-word tools */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-7">
            <h3
              className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500"
              style={heading}
            >
              Word-by-word tools
            </h3>
            <ul className="mt-6 space-y-3">
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
                  1
                </span>
                Click a single word → get a dictionary definition
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
                  2
                </span>
                Lose the meaning of the full expression
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-600">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
                  3
                </span>
                Miss idioms, slang, and context entirely
              </li>
            </ul>
          </div>

          {/* RIGHT — NativeFlow */}
          <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/40 p-7">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-200/40 blur-3xl" />
            <div className="relative">
              <h3
                className="text-sm font-semibold uppercase tracking-[0.15em] text-blue-700"
                style={heading}
              >
                NativeFlow
              </h3>
              <ul className="mt-6 space-y-3">
                <li className="flex items-start gap-3 text-sm text-slate-900">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    1
                  </span>
                  Tap any full sentence → get instant translation
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-900">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    2
                  </span>
                  See the expression explained in context
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-900">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
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
      title: "Browse real Dutch videos",
      body: "Search a curated library of Dutch YouTube content — news, vlogs, interviews. Pick what actually interests you.",
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
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <h2
          className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl"
          style={heading}
        >
          Three steps. No friction.
        </h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
          {steps.map((s) => (
            <div key={s.title} className="flex flex-col items-start">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
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
  const oldWay = ["Find content", "Lose focus", "Miss meaning", "Give up", "Try again", "Stay stuck"];
  const newWay = ["Watch what you love", "Understand more", "Stay engaged", "Grow naturally"];

  return (
    <section className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
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
        <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/40 p-7 shadow-sm">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-200/40 blur-3xl" />
          <div className="relative mb-6 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700"
              style={heading}
            >
              With NativeFlow
            </span>
          </div>
          <ol className="relative space-y-2.5">
            {newWay.map((step, i) => (
              <li
                key={step}
                className="flex items-center gap-3 rounded-lg border border-blue-100 bg-white px-3.5 py-2.5 shadow-sm"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-600 text-[11px] font-semibold text-white"
                  style={heading}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-slate-900">{step}</span>
                {step === "Understand more" && (
                  <MousePointerClick className="ml-auto h-3.5 w-3.5 text-blue-500" />
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
      title: "Any Language, Any Content",
      body: "Learn from the podcasts, videos, and interviews you actually care about — in any language.",
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: "Comprehension On Demand",
      body: "Get the exact support you need, exactly when you need it — then keep watching.",
    },
    {
      icon: <Bookmark className="h-5 w-5" />,
      title: "Build Your Own Learning Path",
      body: "Save expressions, revisit them, and watch your understanding grow over time.",
    },
    {
      icon: <Languages className="h-5 w-5" />,
      title: "Stay in the Flow",
      body: "Never pause, search, or switch tabs. Stay immersed in the content you love.",
    },
  ];
  return (
    <section className="border-y border-slate-200">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
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
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
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


