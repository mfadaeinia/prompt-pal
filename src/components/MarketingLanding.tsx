import { useEffect, type ReactNode } from "react";
import {
  Play,
  Check,
  ArrowRight,
  MousePointerClick,
  Languages,
  BookOpen,
  Youtube,
  Mic,
  Newspaper,
  GraduationCap,
  Headphones,
  Quote,
} from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * Light, product-first landing — inspired by Linear / Notion / Readwise / Raycast.
 * Self-contained: no URL inputs in the hero. Primary CTA scrolls to #try,
 * where the existing PrimaryHero (with the YouTube URL form) lives.
 */
export function MarketingLanding({
  onStartDemo,
  onSignUp,
  conversionSlot,
}: {
  onStartDemo: () => void;
  onSignUp: () => void;
  /** The existing PrimaryHero (URL input + form). Rendered in the "Try it" section. */
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
        <RealContent />
        <HowItWorks />
        <ProductDemo />
        <Benefits />
        <Testimonials />
        <FinalCta onPrimary={handleSignUp} onSecondary={handleDemo} />
      </div>

      {/* Conversion section — light, matches the rest of the landing */}
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

/* ============================== HERO ============================== */

const heading = { fontFamily: "'Sora', system-ui, sans-serif" } as const;

function Hero({ onPrimary, onSecondary }: { onPrimary: () => void; onSecondary: () => void }) {
  return (
    <section className="mx-auto max-w-7xl px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        {/* Copy */}
        <div className="min-w-0">
          <span
            className="mb-6 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
            style={heading}
          >
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
            Understand real content, sentence by sentence
          </span>

          <h1
            className="text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl"
            style={heading}
          >
            Understand Any Video.
            <br />
            <span className="text-blue-600">Sentence by Sentence.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg sm:mt-6">
            Click any sentence to get translations, explanations, vocabulary, and context —
            instantly, without leaving the video.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
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
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:bg-slate-50 sm:px-6 sm:py-3.5"
              style={heading}
            >
              <Play className="h-4 w-4" />
              Watch Demo
            </button>
          </div>

          <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 sm:text-sm sm:gap-x-6 sm:mt-7">
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" /> Works with YouTube
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" /> 50+ languages
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" /> No credit card
            </li>
          </ul>
        </div>

        {/* Product visualization */}
        <div className="relative min-w-0">
          <ProductMock />
        </div>
      </div>
    </section>
  );
}

function ProductMock() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)]">
      {/* Toolbar */}
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

      {/* Video */}
      <div className="relative aspect-video bg-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,#1e3a8a_0%,#0f172a_60%,#020617_100%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 backdrop-blur shadow-lg">
            <Play className="ml-0.5 h-6 w-6 fill-slate-900 text-slate-900" />
          </div>
        </div>
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
          <Youtube className="h-3 w-3" /> YouTube
        </div>
        <div className="absolute bottom-3 left-3 right-3 h-1 rounded-full bg-white/20">
          <div className="h-full w-1/3 rounded-full bg-blue-500" />
        </div>
      </div>

      {/* Sentence + explanation, the real value */}
      <div className="space-y-4 p-5">
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2.5">
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-blue-700" style={heading}>
            0:42 · Dutch
          </div>
          <p className="text-base font-semibold text-slate-900">Dat slaat nergens op.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Translation">
            <p className="text-sm text-slate-800">That makes no sense at all.</p>
          </Field>
          <Field label="Meaning">
            <p className="text-sm text-slate-600">Used when something feels illogical.</p>
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

/* ============================== REAL CONTENT (trust strip) ============================== */

function RealContent() {
  const items = [
    { icon: <Youtube className="h-4 w-4" />, label: "YouTube videos" },
    { icon: <Mic className="h-4 w-4" />, label: "Interviews" },
    { icon: <Newspaper className="h-4 w-4" />, label: "News" },
    { icon: <Headphones className="h-4 w-4" />, label: "Podcasts" },
    { icon: <GraduationCap className="h-4 w-4" />, label: "Educational" },
  ];
  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-10 sm:py-12">
        <p
          className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
          style={heading}
        >
          Built for real content — learn from what you already enjoy
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {items.map((it) => (
            <span
              key={it.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              <span className="text-blue-600">{it.icon}</span>
              {it.label}
            </span>
          ))}
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
      icon: <Youtube className="h-5 w-5" />,
      title: "Paste a video",
      body: "Drop in any YouTube link — podcasts, interviews, news, lectures.",
    },
    {
      n: "02",
      icon: <MousePointerClick className="h-5 w-5" />,
      title: "Click a sentence",
      body: "Pick the line you didn't catch. No pausing, no tab-switching.",
    },
    {
      n: "03",
      icon: <BookOpen className="h-5 w-5" />,
      title: "Understand instantly",
      body: "Translation, meaning, vocabulary, and context in one place.",
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
      <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl" style={heading}>
          Three steps. Real understanding.
        </h2>
        <p className="mt-3 text-base text-slate-600 sm:text-lg">
          Designed to keep you in the flow of the video — not in a textbook.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                {s.icon}
              </div>
              <span className="text-xs font-semibold tracking-widest text-slate-400" style={heading}>
                {s.n}
              </span>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-900" style={heading}>
              {s.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================== PRODUCT DEMO ============================== */

function ProductDemo() {
  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-14">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl" style={heading}>
            See exactly how it works
          </h2>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">
            One click on a sentence gives you everything you need to understand it.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          {/* The sentence in context */}
          <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500" style={heading}>
                Transcript
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                Dutch
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
              <div className="rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-sm">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-blue-700" style={heading}>
                  0:42 · selected
                </div>
                <p className="text-base font-semibold text-slate-900 sm:text-lg">
                  Dat slaat nergens op.
                </p>
              </div>
              <TranscriptLine time="1:08" muted>
                Ik heb er geen zin in.
              </TranscriptLine>
            </div>
          </div>

          {/* What you get */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-5">
              <Field label="Translation">
                <p className="text-lg font-medium text-slate-900">That makes no sense at all.</p>
              </Field>
              <div className="h-px bg-slate-100" />
              <Field label="Meaning">
                <p className="text-sm leading-relaxed text-slate-700">
                  Used when something feels illogical or absurd.
                </p>
              </Field>
              <div className="h-px bg-slate-100" />
              <Field label="Vocabulary">
                <div className="space-y-1.5 text-sm">
                  {[
                    ["slaat", "hits / strikes"],
                    ["nergens", "nowhere"],
                    ["op", "on / makes sense in context"],
                  ].map(([w, m]) => (
                    <div key={w} className="flex items-baseline gap-2">
                      <span className="w-20 font-semibold text-slate-900">{w}</span>
                      <span className="text-slate-500">{m}</span>
                    </div>
                  ))}
                </div>
              </Field>
              <div className="h-px bg-slate-100" />
              <Field label="Expression note">
                <p className="text-sm leading-relaxed text-slate-600">
                  Very common Dutch expression in everyday conversation.
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
    <div className={`flex items-baseline gap-3 ${muted ? "opacity-60" : ""}`}>
      <span className="w-10 shrink-0 text-[10px] font-medium tabular-nums text-slate-400" style={heading}>
        {time}
      </span>
      <span className="text-slate-700">{children}</span>
    </div>
  );
}

/* ============================== BENEFITS ============================== */

function Benefits() {
  const items = [
    {
      icon: <Languages className="h-5 w-5" />,
      title: "Understand without leaving the video",
      body: "Translations and meaning are one click away. No dictionaries, no tabs.",
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      title: "Learn vocabulary in context",
      body: "Real sentences, real situations. Words stick when they have a home.",
    },
    {
      icon: <Headphones className="h-5 w-5" />,
      title: "Train your ear on real speech",
      body: "Build listening comprehension with authentic native content, at your pace.",
    },
    {
      icon: <Check className="h-5 w-5" />,
      title: "Save phrases you want to remember",
      body: "Build a personal library of expressions you can revisit anytime.",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
      <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-14">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl" style={heading}>
          Stop pausing videos to look things up
        </h2>
        <p className="mt-3 text-base text-slate-600 sm:text-lg">
          NativeFlow folds the dictionary, translator, and notebook into the video itself.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((b) => (
          <div
            key={b.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300"
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
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-14">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl" style={heading}>
            Built for people who already love content
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex h-full flex-col rounded-2xl border border-slate-200 bg-[#F8FAFC] p-7"
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
          Paste a YouTube link and start understanding every sentence in seconds.
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
      </div>
    </section>
  );
}
