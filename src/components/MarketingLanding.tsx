import { useEffect, type ReactNode } from "react";
import {
  Play,
  Check,
  ArrowRight,
  Sparkles,
  MousePointerClick,
  Brain,
  Languages,
  BookOpen,
  Globe2,
  Quote,
  Star,
} from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * Premium "Editorial Cockpit" landing — dark Glass Aurora aesthetic.
 * Self-contained: no URL inputs in the hero. Primary CTA scrolls to #try,
 * where the existing PrimaryHero (with the YouTube URL form) lives.
 */
export function MarketingLanding({
  onStartDemo,
  conversionSlot,
}: {
  onStartDemo: () => void;
  /** The existing PrimaryHero (URL input + form). Rendered in the "Try it" section. */
  conversionSlot: ReactNode;
}) {
  useEffect(() => {
    track("marketing_landing_seen", {});
  }, []);

  const scrollToTry = () => {
    track("marketing_cta_clicked", { target: "try" });
    const el = document.getElementById("try");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const handleDemo = () => {
    track("marketing_cta_clicked", { target: "demo" });
    onStartDemo();
  };

  return (
    <div
      className="relative w-full overflow-hidden bg-[#020617] text-slate-200 selection:bg-blue-500/30"
      style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}
    >
      {/* Aurora background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[20%] h-[70%] w-[70%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute -right-[10%] top-[10%] h-[50%] w-[50%] rounded-full bg-violet-600/12 blur-[120px]" />
        <div className="absolute bottom-0 left-[20%] h-[40%] w-[60%] rounded-full bg-emerald-500/[0.06] blur-[120px]" />
      </div>

      <div className="relative z-10">
        <Hero onPrimary={scrollToTry} onSecondary={handleDemo} />
        <SocialProof />
        <HowItWorks />
        <ProductDemo />
        <Benefits />
        <Testimonials />
        <FinalCta onPrimary={scrollToTry} onSecondary={handleDemo} />
      </div>

      {/* Conversion section — light, contains existing URL input form */}
      <section id="try" className="relative bg-background text-foreground">
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-6 sm:pt-24">
          <div className="mb-10 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm">
              <Sparkles className="h-3 w-3 text-primary" /> Paste a link to begin
            </span>
            <h2
              className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-5xl"
              style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
            >
              Try it on any video — free
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              Paste a YouTube link and start understanding every sentence in seconds. No account required.
            </p>
          </div>
          {conversionSlot}
        </div>
      </section>
    </div>
  );
}

/* ============================== HERO ============================== */

const heading = { fontFamily: "'Sora', system-ui, sans-serif" } as const;

function Hero({ onPrimary, onSecondary }: { onPrimary: () => void; onSecondary: () => void }) {
  return (
    <section className="mx-auto max-w-7xl px-6 pt-20 pb-28 sm:pt-28 sm:pb-36">
      <div className="grid items-center gap-16 lg:grid-cols-2">
        {/* Copy */}
        <div className="min-w-0">
          <span
            className="mb-6 inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300"
            style={heading}
          >
            <span className="relative mr-2 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            Learn from real videos you already love
          </span>

          <h1
            className="text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-7xl"
            style={heading}
          >
            Turn Any YouTube Video Into a{" "}
            <span className="bg-gradient-to-r from-blue-400 to-emerald-300 bg-clip-text text-transparent">
              Personal Language Tutor
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg sm:mt-6">
            Understand every sentence instantly — translations, explanations, vocabulary notes,
            and cultural context, without leaving the video.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={onPrimary}
              className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 active:scale-[0.98] sm:px-7 sm:py-4"
              style={heading}
            >
              Try NativeFlow Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={onSecondary}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10 sm:px-7 sm:py-4"
              style={heading}
            >
              <Play className="h-4 w-4" />
              Watch Demo
            </button>
          </div>

          <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400 sm:text-sm sm:gap-x-6 sm:mt-7">
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-400" /> No account required
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-400" /> Works with 50+ languages
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-400" /> Learn sentence-by-sentence
            </li>
          </ul>
        </div>

        {/* Product visualization */}
        <div className="relative min-w-0">
          <div aria-hidden className="absolute inset-0 rounded-[2rem] bg-blue-500/20 blur-[80px]" />
          <ProductMock />
        </div>
      </div>
    </section>
  );
}

function ProductMock() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-slate-700/50 bg-slate-800/50 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        </div>
        <div
          className="mx-auto text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500"
          style={heading}
        >
          Learning Mode · Dutch
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr]">
        {/* Left: Video + transcript */}
        <div className="flex flex-col border-b border-slate-700/50 lg:border-b-0 lg:border-r">
          <div className="relative aspect-video bg-black">
            {/* YouTube-ish gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md">
                <Play className="ml-0.5 h-6 w-6 fill-white text-white" />
              </div>
            </div>
            <div className="absolute bottom-3 left-3 right-3 h-1 rounded-full bg-white/20">
              <div className="h-full w-1/3 rounded-full bg-blue-500" />
            </div>
            <div className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
              YouTube
            </div>
          </div>

          <div className="space-y-3 p-5">
            <div className="text-[11px] font-medium uppercase tracking-widest text-slate-500" style={heading}>
              02:45 · Transcript
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              "Ik probeerde het hem uit te leggen, maar hij wilde niet luisteren."
            </p>
            <div className="rounded-lg border-l-2 border-blue-500 bg-blue-500/10 py-2 pl-3 pr-3">
              <p className="text-sm font-medium leading-relaxed text-white">
                "<span className="rounded bg-blue-500/30 px-1">Dat slaat nergens op.</span>", zei hij boos.
              </p>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              "En toen liep hij gewoon weg zonder iets te zeggen."
            </p>
          </div>
        </div>

        {/* Right: AI panel */}
        <div className="bg-slate-900/40 p-5">
          <h4
            className="mb-5 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400"
            style={heading}
          >
            AI Explanation
          </h4>
          <div className="space-y-5 text-sm">
            <Field label="Translation">
              <p className="italic text-slate-200">That makes no sense at all.</p>
            </Field>
            <Field label="Meaning">
              <p className="text-slate-300">Used when something feels illogical or absurd.</p>
            </Field>
            <Field label="Vocabulary">
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["slaat", "hits / strikes"],
                  ["nergens", "nowhere"],
                  ["op", "makes sense"],
                ].map(([w, m]) => (
                  <span
                    key={w}
                    className="rounded-md border border-slate-700 bg-slate-800/70 px-2 py-1 text-[11px] text-slate-300"
                  >
                    <span className="font-semibold text-white">{w}</span>
                    <span className="ml-1 text-slate-500">= {m}</span>
                  </span>
                ))}
              </div>
            </Field>
            <Field label="Expression Note">
              <p className="text-xs italic leading-relaxed text-slate-400">
                A very common Dutch expression used in everyday conversation.
              </p>
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <div
        className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500"
        style={heading}
      >
        {label}
      </div>
      {children}
    </section>
  );
}

/* ============================== SOCIAL PROOF ============================== */

const AVATARS = ["#3b82f6", "#a78bfa", "#10b981", "#f59e0b", "#ec4899"];

function SocialProof() {
  return (
    <section className="border-y border-white/5 bg-slate-950/40 py-20 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6">
        <h2
          className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-slate-500"
          style={heading}
        >
          Trusted by language learners worldwide
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-3">
          {[
            ["100,000+", "Sentences explained daily"],
            ["50+", "Languages supported"],
            ["1M+", "Video moments understood"],
          ].map(([n, l]) => (
            <div key={l} className="text-center">
              <div
                className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl lg:text-6xl"
                style={heading}
              >
                {n}
              </div>
              <div className="mt-2 text-sm text-slate-500">{l}</div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-14 flex max-w-2xl items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
          <div className="flex -space-x-2">
            {AVATARS.map((c, i) => (
              <span
                key={i}
                className="inline-block h-10 w-10 rounded-full border-2 border-[#020617]"
                style={{ background: `linear-gradient(135deg, ${c}, ${c}99)` }}
              />
            ))}
          </div>
          <div>
            <div className="flex text-yellow-400">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-current" />
              ))}
            </div>
            <p className="mt-1 text-sm italic text-slate-300">
              "The first tool that actually made Dutch stick for me."
            </p>
            <p className="mt-1 text-xs font-semibold text-blue-400" style={heading}>
              — Sarah K., learning Dutch
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================== HOW IT WORKS ============================== */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: <Globe2 className="h-6 w-6" />,
      color: "blue",
      title: "Paste Any YouTube Video",
      body: "Use videos you already enjoy — podcasts, news, comedy, lectures.",
      illustration: <IllVideo />,
    },
    {
      n: "02",
      icon: <MousePointerClick className="h-6 w-6" />,
      color: "emerald",
      title: "Click Any Sentence",
      body: "Select what you want to understand. No pausing, no tab switching.",
      illustration: <IllClick />,
    },
    {
      n: "03",
      icon: <Brain className="h-6 w-6" />,
      color: "violet",
      title: "Learn Instantly",
      body: "Translation, meaning, vocabulary, and usage notes in one click.",
      illustration: <IllLearn />,
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-32">
      <div className="mx-auto mb-14 max-w-2xl text-center sm:mb-20">
        <h2 className="text-2xl font-bold text-white sm:text-3xl lg:text-5xl" style={heading}>
          From paste to fluency in three steps
        </h2>
        <p className="mt-3 text-base text-slate-400 sm:text-lg">
          No textbook can match the context of native content.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 p-8 transition-all hover:border-${s.color}-500/40`}
          >
            <div className="mb-6 h-32">{s.illustration}</div>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl bg-${s.color}-500/10 text-${s.color}-400`}
              >
                {s.icon}
              </div>
              <span className="text-xs font-bold tracking-widest text-slate-600" style={heading}>
                {s.n}
              </span>
            </div>
            <h3 className="mt-5 text-xl font-bold text-white" style={heading}>
              {s.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* Custom SVG illustrations (not generic icons) */
function IllVideo() {
  return (
    <svg viewBox="0 0 240 100" className="h-full w-full">
      <defs>
        <linearGradient id="g1" x1="0" x2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="20" y="15" width="200" height="70" rx="10" fill="url(#g1)" stroke="#3b82f6" strokeOpacity="0.4" />
      <circle cx="120" cy="50" r="14" fill="#3b82f6" fillOpacity="0.3" stroke="#60a5fa" />
      <path d="M116 44 L116 56 L127 50 Z" fill="#dbeafe" />
      <rect x="30" y="78" width="60" height="3" rx="1.5" fill="#3b82f6" fillOpacity="0.6" />
      <rect x="92" y="78" width="120" height="3" rx="1.5" fill="#fff" fillOpacity="0.1" />
    </svg>
  );
}
function IllClick() {
  return (
    <svg viewBox="0 0 240 100" className="h-full w-full">
      <rect x="20" y="20" width="200" height="10" rx="5" fill="#fff" fillOpacity="0.08" />
      <rect x="20" y="42" width="160" height="12" rx="6" fill="#10b981" fillOpacity="0.25" stroke="#10b981" strokeOpacity="0.6" />
      <rect x="20" y="66" width="140" height="10" rx="5" fill="#fff" fillOpacity="0.08" />
      <g transform="translate(150,40)">
        <path d="M0 0 L0 22 L6 16 L10 24 L13 23 L9 15 L17 14 Z" fill="#fff" stroke="#10b981" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
function IllLearn() {
  return (
    <svg viewBox="0 0 240 100" className="h-full w-full">
      <rect x="40" y="15" width="160" height="70" rx="12" fill="#a78bfa" fillOpacity="0.08" stroke="#a78bfa" strokeOpacity="0.4" />
      <rect x="55" y="30" width="60" height="4" rx="2" fill="#a78bfa" fillOpacity="0.7" />
      <rect x="55" y="42" width="120" height="3" rx="1.5" fill="#fff" fillOpacity="0.2" />
      <rect x="55" y="50" width="100" height="3" rx="1.5" fill="#fff" fillOpacity="0.2" />
      <rect x="55" y="62" width="35" height="12" rx="6" fill="#a78bfa" fillOpacity="0.2" stroke="#a78bfa" strokeOpacity="0.5" />
      <rect x="95" y="62" width="35" height="12" rx="6" fill="#a78bfa" fillOpacity="0.2" stroke="#a78bfa" strokeOpacity="0.5" />
      <circle cx="200" cy="25" r="8" fill="#10b981" fillOpacity="0.3" stroke="#10b981" />
      <path d="M196 25 L199 28 L204 22" stroke="#10b981" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

/* ============================== PRODUCT DEMO ============================== */

function ProductDemo() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 sm:py-32">
      <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
        <span className="mb-4 inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300" style={heading}>
          See it in action
        </span>
        <h2 className="text-2xl font-bold text-white sm:text-3xl lg:text-5xl" style={heading}>
          See NativeFlow explain real language
        </h2>
        <p className="mt-3 text-base text-slate-400 sm:text-lg">
          One click. Full context. The way you'd actually want to learn.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 shadow-2xl backdrop-blur-xl lg:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-[100px]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Transcript */}
          <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-6">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500" style={heading}>
                Transcript
              </span>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                Auto-scrolling
              </span>
            </div>
            <div className="space-y-3 text-base leading-relaxed">
              <TranscriptLine time="0:14" muted>
                Wacht even, ik moet nog parkeren.
              </TranscriptLine>
              <TranscriptLine time="0:17" muted>
                Rij eens door, man.
              </TranscriptLine>
              <TranscriptLine time="0:25" muted>
                Kom op, we hebben haast.
              </TranscriptLine>
              <div className="rounded-xl border-l-2 border-blue-500 bg-blue-500/10 px-4 py-3">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-blue-400" style={heading}>
                  0:42 · selected
                </div>
                <p className="text-base font-medium text-white sm:text-lg">Dat slaat nergens op.</p>
              </div>
              <TranscriptLine time="1:08" muted>
                Ik heb er geen zin in.
              </TranscriptLine>
            </div>
          </div>

          {/* Explanation */}
          <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-6">
            <div className="mb-5 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-blue-400" style={heading}>
                AI Explanation
              </span>
            </div>
            <div className="space-y-5">
            <Field label="Translation">
                <p className="text-base italic text-white sm:text-lg">That makes no sense at all.</p>
              </Field>
              <Field label="Meaning">
                <p className="text-sm leading-relaxed text-slate-300">
                  Used when something feels illogical or absurd.
                </p>
              </Field>
              <Field label="Vocabulary">
                <div className="space-y-1.5 text-sm">
                  {[
                    ["slaat", "hits / strikes"],
                    ["nergens", "nowhere"],
                    ["op", "up / makes sense in context"],
                  ].map(([w, m]) => (
                    <div key={w} className="flex items-baseline gap-2">
                      <span className="font-semibold text-white">{w}</span>
                      <span className="text-slate-500">= {m}</span>
                    </div>
                  ))}
                </div>
              </Field>
              <Field label="Expression Note">
                <p className="text-sm italic leading-relaxed text-slate-400">
                  A very common Dutch expression used in everyday conversation.
                </p>
              </Field>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TranscriptLine({
  time,
  muted,
  children,
}: {
  time: string;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`flex items-baseline gap-3 ${muted ? "opacity-50" : ""}`}>
      <span className="w-10 shrink-0 text-[10px] font-medium tabular-nums text-slate-600" style={heading}>
        {time}
      </span>
      <span className="text-slate-300">{children}</span>
    </div>
  );
}

/* ============================== BENEFITS ============================== */

function Benefits() {
  const items = [
    {
      icon: <Languages className="h-5 w-5" />,
      title: "Understand videos without opening dictionaries",
      body: "Translations and meaning are one click away — never leave the player.",
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      title: "Learn vocabulary in context",
      body: "Real sentences, real situations. Words stick when they have a home.",
    },
    {
      icon: <Brain className="h-5 w-5" />,
      title: "Build listening comprehension naturally",
      body: "Train your ear on authentic native speech, at your own pace.",
    },
    {
      icon: <Sparkles className="h-5 w-5" />,
      title: "Learn from content you genuinely enjoy",
      body: "Motivation compounds. The best lesson is the one you finish.",
    },
    {
      icon: <Star className="h-5 w-5" />,
      title: "Remember phrases more effectively",
      body: "Save expressions to your library and revisit them later.",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 sm:py-32">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:items-start lg:gap-16">
        <div className="lg:sticky lg:top-24">
          <h2 className="text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-5xl" style={heading}>
            Stop switching between tabs.
          </h2>
          <p className="mt-3 max-w-md text-base text-slate-400 sm:text-lg sm:mt-4">
            NativeFlow folds dictionary, translator, grammar guide, and notebook into the video itself.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((b) => (
            <div
              key={b.title}
              className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-all hover:bg-white/[0.04]"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                {b.icon}
              </div>
              <h3 className="text-base font-semibold leading-snug text-white" style={heading}>
                {b.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{b.body}</p>
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
      "NativeFlow helped me understand real Dutch content faster than any language app I've tried.",
  },
  {
    name: "Luca Moretti",
    lang: "Learning English",
    color: "#a78bfa",
    quote:
      "I finally enjoy watching native podcasts. Clicking a sentence and getting the nuance — magical.",
  },
  {
    name: "Aiko Tanaka",
    lang: "Learning French",
    color: "#10b981",
    quote:
      "The expression notes are what set this apart. I'm learning how natives actually talk.",
  },
];

function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 sm:py-32">
      <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
        <h2 className="text-2xl font-bold text-white sm:text-3xl lg:text-5xl" style={heading}>
          Learners. Languages. Lightbulbs.
        </h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="flex h-full flex-col rounded-2xl border border-white/10 bg-slate-900/40 p-7 backdrop-blur-sm"
          >
            <Quote className="h-6 w-6 text-blue-400/60" />
            <blockquote className="mt-4 flex-1 text-base leading-relaxed text-slate-200">
              "{t.quote}"
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }}
              >
                {t.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
              <div>
                <div className="text-sm font-semibold text-white" style={heading}>
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
    <section className="mx-auto max-w-5xl px-6 pb-20 sm:pb-32">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 p-8 text-center sm:rounded-[2.5rem] sm:p-12 lg:p-20">
        <div aria-hidden className="absolute inset-0 bg-blue-600/10 backdrop-blur-md" />
        <div aria-hidden className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-500/30 blur-[100px]" />
        <div aria-hidden className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-[100px]" />

        <div className="relative z-10">
          <h2
            className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-5xl xl:text-6xl"
            style={heading}
          >
            Start learning from any video today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-300 sm:text-lg sm:mt-5">
            Paste a YouTube link and start understanding every sentence in seconds.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <button
              onClick={onPrimary}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-sm font-semibold text-blue-950 shadow-xl transition-all hover:bg-slate-100"
              style={heading}
            >
              Try NativeFlow Free
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={onSecondary}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-8 py-4 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
              style={heading}
            >
              <Play className="h-4 w-4" /> Watch Demo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
