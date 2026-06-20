import { useEffect, type ReactNode } from "react";
import {
  Play,
  Check,
  ArrowRight,
  Languages,
  BookOpen,
  Youtube,
  Mic,
  Newspaper,
  GraduationCap,
  Headphones,
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

/**

 * Light, product-first landing — premium "understanding layer" for real content.
 * Inspired by Linear, Notion, Stripe, Readwise.
 */
export function MarketingLanding({
  onStartDemo,
  onSignUp,
  conversionSlot,
}: {
  onStartDemo: () => void;
  onSignUp: () => void;
  conversionSlot: ReactNode;
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
      className="relative w-full overflow-hidden bg-[#F8FAFC] text-slate-900 selection:bg-blue-200"
      style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}
    >
      <div className="relative z-10">
        <Hero onPrimary={handleSignUp} onSecondary={handleDemo} />
        <ContentTypes />
        <Comparison />
        <Features />
        <Testimonials />
        <FinalCta onPrimary={handleSignUp} onSecondary={handleDemo} />
      </div>

      <section id="try" className="relative border-t border-slate-200 bg-white">
        <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-6 sm:pt-24">
          <div className="mb-10 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              Paste a link to begin
            </span>
            <h2
              className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl"
              style={heading}
            >
              Paste a video to start understanding it
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600 sm:text-base">
              Free account. Save words, track progress, and return anytime.
            </p>
          </div>
          {conversionSlot}
        </div>
      </section>
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
      {/* ============== BACKGROUND — MOBILE: small tile grid as texture ============== */}
      <div aria-hidden className="pointer-events-none absolute inset-0 md:hidden">
        <div className="absolute inset-0 grid grid-cols-4 gap-1.5 p-2 opacity-[0.35] blur-[2px]">
          {MOBILE_TILES.map((id, i) => (
            <div
              key={id + i}
              className="overflow-hidden rounded-md"
              style={{ aspectRatio: "1/1" }}
            >
              <img
                src={`https://images.unsplash.com/${id}?w=200&q=60`}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
        {/* fade so the headline stays dominant */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#F8FAFC]/50 via-[#F8FAFC]/70 to-[#F8FAFC]" />
      </div>

      {/* ============== BACKGROUND — TABLET: collage spans most of the hero ============== */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block lg:hidden">
        <img
          src={heroCollage.url}
          alt=""
          className="absolute inset-y-0 right-0 h-full w-[92%] object-cover object-right"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#F8FAFC] via-[#F8FAFC]/50 via-25% to-transparent to-55%" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#F8FAFC] to-transparent" />
      </div>

      {/* ============== BACKGROUND — DESKTOP: collage concentrated on right ~60% ============== */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
        <img
          src={heroCollage.url}
          alt=""
          className="absolute inset-y-0 right-0 h-full w-[60%] object-cover object-left"
        />
        {/* strong left clean area, soft fade into collage */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#F8FAFC] from-25% via-[#F8FAFC]/50 via-40% to-transparent to-60%" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#F8FAFC] to-transparent" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pt-14 pb-20 sm:pt-20 sm:pb-28 md:pt-24 md:pb-32 lg:pb-28">
        <div className="relative z-10 max-w-xl md:max-w-2xl lg:max-w-3xl">
          <span
            className="mb-5 inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm backdrop-blur sm:mb-6"
            style={heading}
          >
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
            For the content you already watch
          </span>

          <h1
            className="text-[1.85rem] font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem]"
            style={heading}
          >
            Understand Any Video.
            <br />
            <span className="text-blue-600">Without Leaving It.</span>
          </h1>

          <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-700 sm:mt-6 sm:text-lg">
            Click any sentence to get translations, explanations, vocabulary, and context — instantly.
            No tabs. No dictionaries. No broken focus.
          </p>

          <div className="mt-7 flex flex-wrap gap-3 sm:mt-8">
            <button
              onClick={onPrimary}
              className="group inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] sm:px-6 sm:py-3.5"
              style={heading}
            >
              Try NativeFlow Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={onSecondary}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur transition-all hover:bg-white sm:px-6 sm:py-3.5"
              style={heading}
            >
              <Play className="h-4 w-4" />
              Watch Demo
            </button>
          </div>

          <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 sm:gap-x-6 sm:text-sm">
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" /> Works with YouTube
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" /> 50+ languages
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" /> No credit card required
            </li>
          </ul>

          <p
            className="mt-7 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 sm:mt-8"
            style={heading}
          >
            YouTube · TED Talks · News · Podcasts · Interviews
          </p>
        </div>
      </div>
    </section>
  );
}




function ProductMock() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_30px_80px_-25px_rgba(15,23,42,0.25)]">

        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          </div>
          <div
            className="mx-auto text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400"
            style={heading}
          >
            nativeflow.life · Dutch
          </div>
        </div>

        <div className="relative aspect-video bg-slate-900">
          <img
            src="https://images.unsplash.com/photo-1534351590666-13e3e96c5017?w=900&q=80"
            alt="Amsterdam canal scene from a Dutch YouTube video"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-lg backdrop-blur">
              <Play className="ml-0.5 h-6 w-6 fill-slate-900 text-slate-900" />
            </div>
          </div>
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
            <Youtube className="h-3 w-3" /> YouTube
          </div>
          <div className="absolute bottom-3 left-3 right-3 h-1 rounded-full bg-white/30">
            <div className="h-full w-1/3 rounded-full bg-blue-500" />
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2.5">
            <div
              className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-blue-700"
              style={heading}
            >
              0:42 · Dutch
            </div>
            <p className="text-base font-semibold text-slate-900">Dat slaat nergens op.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Translation">
              <p className="text-sm text-slate-800">That makes no sense at all.</p>
            </Field>
            <Field label="Meaning">
              <p className="text-sm text-slate-600">
                Used when something feels illogical or absurd.
              </p>
            </Field>
          </div>

          <Field label="Vocabulary">
            <div className="flex flex-wrap gap-1.5">
              {[
                ["slaat", "hits / strikes"],
                ["nergens", "nowhere"],
                ["op", "on / makes sense"],
              ].map(([w, m]) => (
                <span
                  key={w}
                  className="inline-flex items-baseline gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600"
                >
                  <span className="font-semibold text-slate-900">{w}</span>
                  <span className="text-slate-400">{m}</span>
                </span>
              ))}
            </div>
          </Field>
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

/* ============================== CONTENT TYPES ============================== */

function ContentTypes() {
  const cards = [
    {
      icon: <Newspaper className="h-4 w-4" />,
      tag: "News",
      original: "Le gouvernement a annoncé de nouvelles mesures.",
      lang: "French",
      translation: "The government announced new measures.",
    },
    {
      icon: <Headphones className="h-4 w-4" />,
      tag: "Podcast",
      original: "Eso no tiene ningún sentido para mí.",
      lang: "Spanish",
      translation: "That makes no sense to me.",
    },
    {
      icon: <Youtube className="h-4 w-4" />,
      tag: "YouTube",
      original: "Dat slaat nergens op, eerlijk gezegd.",
      lang: "Dutch",
      translation: "Honestly, that makes no sense at all.",
    },
    {
      icon: <Mic className="h-4 w-4" />,
      tag: "Interview",
      original: "Ich hätte das nie für möglich gehalten.",
      lang: "German",
      translation: "I would never have thought it possible.",
    },
  ];

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
          <h2
            className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
            style={heading}
          >
            Learn From Content You Already Watch
          </h2>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">
            Real videos. Real language. Real understanding.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div
              key={c.tag}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                <span className="text-blue-600">{c.icon}</span>
                {c.tag}
              </div>
              <div
                className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400"
                style={heading}
              >
                {c.lang}
              </div>
              <p className="text-[15px] font-semibold leading-snug text-slate-900">
                {c.original}
              </p>
              <div className="my-3 h-px bg-slate-100" />
              <div
                className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400"
                style={heading}
              >
                Translation
              </div>
              <p className="text-sm leading-relaxed text-slate-600">{c.translation}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================== COMPARISON ============================== */

function Comparison() {
  const oldWay = ["Watch", "Pause", "Search", "Look Up", "Lose Context", "Resume"];
  const newWay = ["Watch", "Click", "Understand", "Keep Watching"];

  return (
    <section className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
      <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
        <h2
          className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          style={heading}
        >
          The Old Way vs. The NativeFlow Way
        </h2>
        <p className="mt-3 text-base text-slate-600 sm:text-lg">
          One breaks your focus. The other keeps you in the flow.
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
              The Old Way
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
                {step === "Pause" && <Pause className="ml-auto h-3.5 w-3.5 text-slate-400" />}
                {step === "Search" && <Search className="ml-auto h-3.5 w-3.5 text-slate-400" />}
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm leading-relaxed text-slate-500">
            Breaks your flow. Kills your focus.
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
              The NativeFlow Way
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
                {step === "Click" && (
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
      title: "50+ Languages",
      body: "Learn from content in the languages you actually care about.",
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: "Instant Understanding",
      body: "Translations, meaning, and vocabulary appear the moment you click.",
    },
    {
      icon: <Bookmark className="h-5 w-5" />,
      title: "Save & Review",
      body: "Build your own library of sentences and expressions to revisit.",
    },
    {
      icon: <Languages className="h-5 w-5" />,
      title: "Works Everywhere",
      body: "YouTube, podcasts, news, talks — wherever real conversations live.",
    },
  ];
  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-14">
          <h2
            className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
            style={heading}
          >
            Everything you need to understand real content
          </h2>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">
            Designed to support your listening, not replace it.
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

/* ============================== TESTIMONIALS ============================== */

const TESTIMONIALS = [
  {
    name: "Sarah Klein",
    lang: "Learning Dutch",
    color: "#3b82f6",
    quote:
      "I finally understand the podcasts I actually want to listen to. Clicking a sentence and getting the nuance is exactly what I needed.",
  },
  {
    name: "Luca Moretti",
    lang: "Learning English",
    color: "#a78bfa",
    quote:
      "It's the first tool that fits into how I already watch videos — instead of replacing it with a course.",
  },
  {
    name: "Aiko Tanaka",
    lang: "Learning French",
    color: "#10b981",
    quote:
      "The expression notes are what set this apart. I'm learning how natives actually talk, not textbook French.",
  },
];

function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
      <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-14">
        <h2
          className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          style={heading}
        >
          Built For Learners Who Use Real Content
        </h2>
        <p className="mt-3 text-base text-slate-600 sm:text-lg">
          People who want to enjoy native podcasts, videos, and shows — and understand them.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
          >
            <Quote className="h-5 w-5 text-blue-500/60" />
            <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-slate-700">
              "{t.quote}"
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)` }}
              >
                {t.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900" style={heading}>
                  {t.name}
                </div>
                <div className="text-xs text-slate-500">{t.lang}</div>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ============================== FINAL CTA ============================== */

function FinalCta({ onPrimary, onSecondary }: { onPrimary: () => void; onSecondary: () => void }) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:rounded-[2rem] sm:p-12 lg:p-16">
        <h2
          className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          style={heading}
        >
          Understand any video today
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
          Paste a link and start understanding every sentence in seconds.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={onPrimary}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700"
            style={heading}
          >
            Try NativeFlow Free
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={onSecondary}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-50"
            style={heading}
          >
            <Play className="h-4 w-4" /> Watch Demo
          </button>
        </div>
        <p className="mt-5 text-xs text-slate-500">
          Free to try · No credit card required · Works with YouTube
        </p>
      </div>
    </section>
  );
}
