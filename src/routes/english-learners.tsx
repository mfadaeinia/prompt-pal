import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Play,
  Check,
  Search,
  MousePointerClick,
  Bookmark,
  Headphones,
  MessageSquareQuote,
  Repeat,
  Sparkles,
  Quote,
  Youtube,
} from "lucide-react";
import { track, setLandingVariant } from "@/lib/analytics";
import productMock from "@/assets/product-mock-v3.png.asset.json";

const VARIANT = "english_learners";
const TITLE = "Learn English with YouTube — Real Videos, Real Listening | NativeFlow";
const DESCRIPTION =
  "Improve English listening with authentic YouTube videos, podcasts and TED Talks. Click any subtitle for instant explanations, idioms and phrasal verbs in context.";
const URL = "https://nativeflow.life/english-learners";

export const Route = createFileRoute("/english-learners")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      {
        name: "keywords",
        content:
          "learn English with YouTube, learn English from real videos, improve English listening, learn English naturally, English listening practice, learn English with authentic content",
      },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: EnglishLearnersLanding,
});

const heading = { fontFamily: "'Sora', system-ui, sans-serif" } as const;

/* ------------------------------- data ------------------------------- */

const FAQS: { q: string; a: string }[] = [
  {
    q: "Do I need perfect English?",
    a: "No. NativeFlow is built for learners who understand some English but get lost with fast, natural speech. You click the parts you miss and keep watching.",
  },
  {
    q: "Can I use any YouTube video?",
    a: "Yes. Paste any YouTube link, search inside NativeFlow, or pick from our suggested channels. If the video has speech, you get an interactive transcript.",
  },
  {
    q: "Is NativeFlow free?",
    a: "Yes, you can start for free. Create an account to save expressions and build your personal vocabulary list.",
  },
  {
    q: "Can beginners use it?",
    a: "Beginners can start with slower, clearer content such as BBC Learning English or short vlogs, and use explanations in their own language until native speed feels comfortable.",
  },
  {
    q: "How is this different from subtitles?",
    a: "Subtitles only show the words. NativeFlow explains the sentence: what it actually means, the idiom or phrasal verb inside it, and how natives use it in context.",
  },
];

const STRUGGLES = [
  { icon: Repeat, text: "Native speakers talking too fast" },
  { icon: MessageSquareQuote, text: "Idioms and phrasal verbs" },
  { icon: Headphones, text: "Connected speech that blends words together" },
  { icon: Sparkles, text: "Different accents — American, British, Australian" },
  { icon: Play, text: "Following YouTube videos without constantly pausing" },
];

const STEPS = [
  { icon: Search, title: "Search any English video", body: "Paste a YouTube link, search, or pick from our suggestions." },
  { icon: MousePointerClick, title: "Click any subtitle", body: "Tap the sentence you didn't catch — the video stays right there." },
  { icon: Sparkles, title: "See instant explanations", body: "Meaning, translation, idioms and phrasal verbs, explained in context." },
  { icon: Bookmark, title: "Save useful expressions", body: "One tap adds a word or phrase to your personal vocabulary list." },
  { icon: Repeat, title: "Keep learning naturally", body: "Return to the flow and let comprehension build video after video." },
];

const SOURCES = [
  "TED Talks",
  "BBC News",
  "BBC Learning English",
  "Kurzgesagt",
  "Vox",
  "MrBeast",
  "English podcasts",
  "Daily vlogs",
  "Interviews",
  "Business presentations",
];

const BENEFITS = [
  { title: "Learn from authentic English", body: "Real speech from real creators — not scripted textbook dialogue." },
  { title: "Improve listening comprehension", body: "Train your ear on natural pace, rhythm and accents." },
  { title: "Build vocabulary in context", body: "Words stick when you meet them inside a sentence you cared about." },
  { title: "Understand idioms and phrasal verbs", body: "The expressions dictionaries never explain well, decoded in context." },
  { title: "Practice with content you enjoy", body: "Your usual YouTube habit becomes your study session." },
];

const CREATOR_TILES = [
  { src: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=500&q=75", alt: "Speaker on a conference stage" },
  { src: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=500&q=75", alt: "Podcast microphone setup" },
  { src: "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=500&q=75", alt: "News desk" },
  { src: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&q=75", alt: "Interview in progress" },
  { src: "https://images.unsplash.com/photo-1531058020387-3be344556be6?w=500&q=75", alt: "YouTube creator filming" },
  { src: "https://images.unsplash.com/photo-1494059980473-813e73ee784b?w=500&q=75", alt: "Talk with an audience" },
];

/* ------------------------------ page ------------------------------ */

function go(target: "app" | "demo") {
  if (typeof window === "undefined") return;
  window.location.href = target === "demo" ? "/?start=demo" : "/?start=app";
}

function EnglishLearnersLanding() {
  useEffect(() => {
    setLandingVariant(VARIANT);
    track("landing_page_viewed", { landing_variant: VARIANT, page: "english_learners" });
  }, []);

  const onTryFree = () => {
    track("try_free_clicked", { landing_variant: VARIANT });
    go("app");
  };
  const onDemo = () => {
    track("demo_clicked", { landing_variant: VARIANT });
    go("demo");
  };

  return (
    <div
      className="relative w-full overflow-hidden bg-[#F8FAFC] text-slate-900 selection:bg-accent"
      style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}
    >
      <Hero onTryFree={onTryFree} onDemo={onDemo} />
      <Audience />
      <HowItWorks />
      <Suggested />
      <Benefits />
      <SocialProof />
      <Faq />
      <FinalCta onTryFree={onTryFree} />
    </div>
  );
}

/* ------------------------------- hero ------------------------------- */

function Hero({ onTryFree, onDemo }: { onTryFree: () => void; onDemo: () => void }) {
  return (
    <section className="relative overflow-hidden">
      {/* Background — a wall of English-speaking creator content */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="grid h-full w-full grid-cols-3 gap-1 opacity-[0.18] sm:grid-cols-6">
          {[...CREATOR_TILES, ...CREATOR_TILES].map((t, i) => (
            <img
              key={`${t.src}-${i}`}
              src={t.src}
              alt=""
              loading={i > 5 ? "lazy" : undefined}
              className="h-full w-full object-cover"
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#F8FAFC]/85 via-[#F8FAFC]/93 to-[#F8FAFC]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pt-12 pb-16 sm:pt-16 sm:pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.95fr] lg:gap-12">
          <div className="max-w-xl">
            <span
              className="mb-5 inline-block text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80"
              style={heading}
            >
              For English learners who watch YouTube
            </span>
            <h1
              className="text-3xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-4xl lg:text-[2.6rem]"
              style={heading}
            >
              Master Real English Through YouTube
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-700 sm:text-lg">
              Stop memorizing textbook English. Learn naturally from YouTube videos, podcasts,
              interviews, TED Talks, and everyday conversations.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:max-w-sm">
              <button
                onClick={onTryFree}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
                style={heading}
              >
                Try It Free
              </button>
              <button
                onClick={onDemo}
                className="inline-flex items-center gap-1.5 self-center text-sm font-medium text-slate-600 underline-offset-4 transition-colors hover:text-slate-900 hover:underline"
                style={heading}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Watch a 60-Second Demo
              </button>
            </div>
          </div>

          <div className="relative mx-auto w-full overflow-hidden rounded-2xl shadow-md">
            <img
              src={productMock.url}
              alt="NativeFlow turning an English YouTube video into an interactive transcript"
              width={1658}
              height={949}
              fetchPriority="high"
              className="block h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- audience ----------------------------- */

function Audience() {
  return (
    <section className="border-t border-slate-200">
      <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
        <h2
          className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl"
          style={heading}
        >
          Built for English Learners Who Want Real Conversations
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base text-slate-600 sm:text-lg">
          You know the grammar. You passed the tests. Then a native speaker opens their mouth and
          half of it disappears. That gap isn't a knowledge problem — it's a real-speech problem.
        </p>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {STRUGGLES.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5"
            >
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="text-sm leading-relaxed text-slate-700">{text}</span>
            </li>
          ))}
        </ul>

        <div className="relative mt-6 overflow-hidden rounded-2xl border border-primary/20 bg-accent/70 p-7 text-center">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
          <p className="relative text-base font-semibold text-slate-900 sm:text-lg">
            NativeFlow turns authentic videos into interactive learning material — so real English
            becomes something you can actually follow.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- how it works ---------------------------- */

function HowItWorks() {
  return (
    <section className="border-t border-slate-200">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <h2
          className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl"
          style={heading}
        >
          How It Works
        </h2>
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex flex-col items-start">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400"
                  style={heading}
                >
                  Step {i + 1}
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-900" style={heading}>
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------------------- suggested ---------------------------- */

function Suggested() {
  return (
    <section className="border-t border-slate-200 bg-white/60">
      <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
        <h2
          className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          style={heading}
        >
          Learn From Content You'd Watch Anyway
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-base text-slate-600">
          Any English video on YouTube works. Here's where learners usually start.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-2.5">
          {SOURCES.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
            >
              <Youtube className="h-4 w-4 text-red-500" />
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- benefits ---------------------------- */

function Benefits() {
  return (
    <section className="border-t border-slate-200">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <h2
          className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl"
          style={heading}
        >
          What You Actually Gain
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 transition-all hover:border-slate-300 hover:bg-white"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
                <Check className="h-5 w-5" />
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

/* --------------------------- social proof --------------------------- */

function SocialProof() {
  return (
    <section className="border-t border-slate-200 bg-white/60">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <h2
          className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          style={heading}
        >
          What learners are saying
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-500">
          We're just getting started — the first learner stories will land here soon.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-dashed border-slate-300 bg-white p-6"
            >
              <Quote className="h-5 w-5 text-slate-300" />
              <div className="mt-4 space-y-2" aria-hidden>
                <div className="h-2.5 w-full rounded bg-slate-100" />
                <div className="h-2.5 w-11/12 rounded bg-slate-100" />
                <div className="h-2.5 w-3/5 rounded bg-slate-100" />
              </div>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-slate-100" aria-hidden />
                <div className="space-y-1.5">
                  <div className="h-2.5 w-24 rounded bg-slate-100" aria-hidden />
                  <span className="block text-[11px] uppercase tracking-widest text-slate-400">
                    Testimonial coming soon
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- faq -------------------------------- */

function Faq() {
  return (
    <section className="border-t border-slate-200">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <h2
          className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          style={heading}
        >
          Frequently Asked Questions
        </h2>
        <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {FAQS.map((f) => (
            <details key={f.q} className="group p-6">
              <summary
                className="cursor-pointer list-none text-base font-semibold text-slate-900 marker:hidden"
                style={heading}
              >
                {f.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- final CTA ----------------------------- */

function FinalCta({ onTryFree }: { onTryFree: () => void }) {
  return (
    <section className="border-t border-slate-200 bg-[#F8FAFC]">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center sm:py-24">
        <h2
          className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl"
          style={heading}
        >
          Start Learning English with Real Videos Today
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base text-slate-600 sm:text-lg">
          Pick a video you already want to watch. Understand every sentence in it.
        </p>
        <button
          onClick={onTryFree}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
          style={heading}
        >
          Try NativeFlow Free
        </button>
      </div>
    </section>
  );
}
