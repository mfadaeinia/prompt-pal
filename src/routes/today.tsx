import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Flame, Sparkles, Clock, BookOpen, Play } from "lucide-react";
import { track } from "@/lib/analytics";
import {
  TODAY_ITEMS,
  CATEGORY_META,
  TODAY_DATE_LABEL,
  type TodayCategory,
  type TodayItem,
} from "@/lib/today-content";

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Today's Dutch — What the Netherlands is talking about | NativeFlow" },
      {
        name: "description",
        content:
          "A daily discovery feed of Dutch videos, podcasts, and expressions. Learn Dutch through what people are actually talking about today.",
      },
      {
        property: "og:title",
        content: "Today's Dutch — Learn Dutch through today's news, videos and conversations",
      },
      {
        property: "og:description",
        content:
          "Discover the Dutch videos, podcasts and stories people are watching right now — and learn the language through them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TodayPage,
});

const heading = { fontFamily: "'Sora', system-ui, sans-serif" } as const;

const CATEGORIES: TodayCategory[] = [
  "trending",
  "talking",
  "watch",
  "listen",
  "expressions",
];

type RecentItem = { id: string; title: string; at: number };

function TodayPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<TodayCategory | "all">("all");
  const [recents, setRecents] = useState<RecentItem[]>([]);

  useEffect(() => {
    track("today_page_seen", {});
    try {
      const raw = localStorage.getItem("nativeflow_today_recents");
      if (raw) setRecents(JSON.parse(raw));
    } catch {}
  }, []);

  const filtered = useMemo(() => {
    if (activeCategory === "all") return TODAY_ITEMS;
    return TODAY_ITEMS.filter((i) => i.category === activeCategory);
  }, [activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<TodayCategory, TodayItem[]>();
    for (const cat of CATEGORIES) map.set(cat, []);
    for (const item of filtered) map.get(item.category)?.push(item);
    return map;
  }, [filtered]);

  function openItem(item: TodayItem) {
    track("today_item_clicked", { id: item.id, category: item.category });
    // Record in "Continue learning"
    try {
      const next: RecentItem[] = [
        { id: item.id, title: item.title, at: Date.now() },
        ...recents.filter((r) => r.id !== item.id),
      ].slice(0, 6);
      localStorage.setItem("nativeflow_today_recents", JSON.stringify(next));
      setRecents(next);
    } catch {}
    if (item.youtubeId) {
      navigate({ to: "/", search: { v: item.youtubeId } as never });
    } else {
      // No video attached — send them into the app to search for the topic.
      navigate({ to: "/" });
    }
  }

  return (
    <div
      className="relative min-h-screen bg-[#F8FAFC] text-slate-900"
      style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}
    >
      <TopNav />

      <Hero
        onExplore={() => {
          const el = document.getElementById("today-feed");
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      {recents.length > 0 && (
        <ContinueLearning items={recents} allItems={TODAY_ITEMS} onOpen={openItem} />
      )}

      <section id="today-feed" className="relative mx-auto max-w-6xl px-5 pb-24 sm:px-6">
        <CategoryTabs active={activeCategory} onChange={setActiveCategory} />

        <div className="mt-10 space-y-16">
          {CATEGORIES.map((cat) => {
            const items = grouped.get(cat) ?? [];
            if (items.length === 0) return null;
            const meta = CATEGORY_META[cat];
            return (
              <section key={cat}>
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <h2
                      className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
                      style={heading}
                    >
                      <span className="mr-2">{meta.emoji}</span>
                      {meta.label}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{meta.description}</p>
                  </div>
                </div>
                <div
                  className={
                    cat === "expressions"
                      ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                      : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                  }
                >
                  {items.map((item) =>
                    cat === "expressions" ? (
                      <ExpressionCard key={item.id} item={item} onOpen={openItem} />
                    ) : (
                      <ContentCard key={item.id} item={item} onOpen={openItem} />
                    ),
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ============================== NAV ============================== */

function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-6">
        <Link
          to="/"
          className="text-base font-bold tracking-tight text-slate-900"
          style={heading}
        >
          NativeFlow
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/today"
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-slate-900"
            activeProps={{ className: "bg-slate-900 text-white" }}
            style={heading}
          >
            Today's Dutch
          </Link>
          <Link
            to="/"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
            style={heading}
          >
            My Learning
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* ============================== HERO ============================== */

function Hero({ onExplore }: { onExplore: () => void }) {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-5 pt-14 pb-14 sm:px-6 sm:pt-20 sm:pb-16">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
          <Flame className="h-3.5 w-3.5" />
          {TODAY_DATE_LABEL}
        </div>

        <h1
          className="max-w-3xl text-3xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl"
          style={heading}
        >
          What is the Netherlands talking about today?
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
          Discover the Dutch videos, podcasts, stories and conversations people are actually
          watching and talking about today — and learn the language through them.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            onClick={onExplore}
            className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.98]"
            style={heading}
          >
            Explore today's content
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            style={heading}
          >
            <Sparkles className="h-4 w-4" />
            Go to my learning
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ============================== CATEGORY TABS ============================== */

function CategoryTabs({
  active,
  onChange,
}: {
  active: TodayCategory | "all";
  onChange: (v: TodayCategory | "all") => void;
}) {
  const tabs: Array<{ id: TodayCategory | "all"; label: string; emoji?: string }> = [
    { id: "all", label: "All" },
    ...CATEGORIES.map((c) => ({
      id: c,
      label: CATEGORY_META[c].label,
      emoji: CATEGORY_META[c].emoji,
    })),
  ];

  return (
    <div className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5 pt-10 sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
            style={heading}
          >
            {t.emoji && <span className="mr-1">{t.emoji}</span>}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============================== CARDS ============================== */

function DifficultyBadge({ level }: { level: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
      {level}
    </span>
  );
}

function ContentCard({ item, onOpen }: { item: TodayItem; onOpen: (i: TodayItem) => void }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      {item.imageUrl && (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-white backdrop-blur">
            {item.contentType === "video" && <Play className="h-3 w-3 fill-white" />}
            {item.contentType === "podcast" && <span>🎧</span>}
            {item.contentType === "article" && <BookOpen className="h-3 w-3" />}
            {item.contentType}
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-slate-500">
          <span>{item.source}</span>
          <span>·</span>
          <DifficultyBadge level={item.difficulty} />
        </div>
        <h3
          className="text-lg font-bold leading-snug tracking-tight text-slate-900"
          style={heading}
        >
          {item.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.summaryEn}</p>
        <div className="mt-3 rounded-lg bg-orange-50/70 px-3 py-2 text-xs text-orange-900">
          <span className="font-semibold">Why you're seeing this: </span>
          {item.whyRelevant}
        </div>

        <div className="mt-4">
          <div
            className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400"
            style={heading}
          >
            Learn
          </div>
          <ul className="space-y-1.5">
            {item.vocab.slice(0, 3).map((v) => (
              <li key={v.nl} className="flex items-baseline gap-2 text-sm">
                <span className="font-semibold text-slate-900">{v.nl}</span>
                <span className="text-slate-400">—</span>
                <span className="text-slate-600">{v.en}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={() => onOpen(item)}
          className="mt-5 inline-flex items-center justify-center gap-2 self-start rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98]"
          style={heading}
        >
          {item.cta ?? "Learn through this content"}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

function ExpressionCard({
  item,
  onOpen,
}: {
  item: TodayItem;
  onOpen: (i: TodayItem) => void;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm transition-all hover:shadow-md">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-slate-500">
        <span>{item.source}</span>
        <span>·</span>
        <DifficultyBadge level={item.difficulty} />
      </div>
      <h3
        className="text-base font-bold leading-snug tracking-tight text-slate-900"
        style={heading}
      >
        "{item.title}"
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.summaryEn}</p>
      <p className="mt-3 text-xs italic text-slate-500">{item.whyRelevant}</p>

      <ul className="mt-4 space-y-1">
        {item.vocab.map((v) => (
          <li key={v.nl} className="text-xs text-slate-600">
            <span className="font-semibold text-slate-900">{v.nl}</span>
            <span className="mx-1.5 text-slate-400">—</span>
            {v.en}
          </li>
        ))}
      </ul>
      <button
        onClick={() => onOpen(item)}
        className="mt-4 inline-flex items-center gap-1 self-start text-xs font-semibold text-slate-900 hover:underline"
        style={heading}
      >
        Explore <ArrowRight className="h-3 w-3" />
      </button>
    </article>
  );
}

/* ============================== CONTINUE LEARNING ============================== */

function ContinueLearning({
  items,
  allItems,
  onOpen,
}: {
  items: RecentItem[];
  allItems: TodayItem[];
  onOpen: (i: TodayItem) => void;
}) {
  const resolved = items
    .map((r) => allItems.find((i) => i.id === r.id))
    .filter((i): i is TodayItem => Boolean(i));
  if (resolved.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-6">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-slate-500" />
        <h2
          className="text-sm font-semibold uppercase tracking-widest text-slate-500"
          style={heading}
        >
          Continue learning
        </h2>
      </div>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {resolved.map((item) => (
          <button
            key={item.id}
            onClick={() => onOpen(item)}
            className="flex min-w-[220px] max-w-[260px] flex-col rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {item.source}
            </span>
            <span
              className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900"
              style={heading}
            >
              {item.title}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ============================== FOOTER ============================== */

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white/60">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-5 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6">
        <span>© {new Date().getFullYear()} NativeFlow · Today's Dutch</span>
        <div className="flex items-center gap-4">
          <Link to="/" className="hover:text-slate-900">
            Back to NativeFlow
          </Link>
        </div>
      </div>
    </footer>
  );
}
