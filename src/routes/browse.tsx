import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactElement } from "react";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Gem,
  GraduationCap,
  History,
  LayoutGrid,
  Lightbulb,
  Menu,
  NotebookPen,
  Search,
  Settings,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/curated-library.functions";
import { LEVEL_META } from "@/lib/cefr-meta";
import { LEVEL_PALETTE } from "@/lib/cefr-palette";
import { BROWSE_VIDEOS, LEVEL_STATS } from "@/lib/browse-static";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/browse")({
  head: () => ({
    meta: [
      { title: "Browse Dutch Videos by Level — NativeFlow" },
      {
        name: "description",
        content:
          "Curated Dutch YouTube videos for every CEFR level. Learn with authentic content at exactly the right difficulty.",
      },
      { property: "og:title", content: "Browse Dutch Videos by Level — NativeFlow" },
      {
        property: "og:description",
        content:
          "Pick a level that matches your Dutch and click any subtitle to learn instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrowseByLevelPage,
});

/* --------------------------------- top nav -------------------------------- */

function TopNav({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onOpenSidebar}
          className="rounded-xl border border-border p-2 text-muted-foreground transition hover:text-foreground lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <Link to="/" aria-label="NativeFlow home">
          <BrandLogo markClassName="h-8 w-8" gradientId="nf-browse-nav" />
        </Link>
        <nav className="ml-auto hidden items-center gap-8 md:flex">
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Why NativeFlow
          </Link>
          <span className="border-b-2 border-primary pb-1 text-sm font-semibold text-primary">
            Browse by Level
          </span>
        </nav>
        <div className="ml-auto flex items-center gap-3 md:ml-6">
          <Link to="/">
            <Button className="rounded-full px-5">Start for free</Button>
          </Link>
          <button
            type="button"
            aria-label="Account menu"
            className="flex items-center gap-1 rounded-full border border-border p-1 pr-2 text-muted-foreground transition hover:text-foreground"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <User className="h-4 w-4" />
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

/* --------------------------------- sidebar -------------------------------- */

const SIDE_NAV = [
  { label: "Browse", icon: LayoutGrid, active: true },
  { label: "My Learning", icon: GraduationCap },
  { label: "Saved", icon: Bookmark },
  { label: "History", icon: History },
  { label: "Vocabulary", icon: BookOpen },
  { label: "Notebook", icon: NotebookPen },
];

function SidebarInner() {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <nav className="flex flex-col gap-1">
        {SIDE_NAV.map(({ label, icon: Icon, active }) => (
          <span
            key={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
              active
                ? "bg-primary/10 text-primary"
                : "cursor-default text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
        ))}
      </nav>
      <div className="mt-auto space-y-3">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Gem className="h-4 w-4 text-primary" />
          </span>
          <p className="mt-2 text-sm font-semibold leading-snug text-foreground">
            Unlock more learning features
          </p>
          <Button size="sm" variant="outline" className="mt-3 w-full rounded-full text-xs">
            Upgrade
          </Button>
        </div>
        <span className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground">
          <Settings className="h-4 w-4" /> Settings
        </span>
      </div>
    </div>
  );
}

/* ------------------------------ level artwork ----------------------------- */

function LevelArt({ level, className }: { level: CefrLevel; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const art: Record<CefrLevel, ReactElement> = {
    A1: (
      <g {...common}>
        <circle cx="60" cy="26" r="16" />
        <path d="M60 42v8M52 50h16v10H52z" />
        <path d="M48 26c0-9 5-16 12-16s12 7 12 16" />
      </g>
    ),
    A2: (
      <g {...common}>
        <path d="M8 62l22-30 14 18 10-12 18 24z" />
        <circle cx="86" cy="20" r="8" />
      </g>
    ),
    B1: (
      <g {...common}>
        <path d="M6 54h96" />
        <path d="M28 54V16M76 54V16" />
        <path d="M28 22c16 10 32 10 48 0" />
        <path d="M40 54V34M52 54V30M64 54V34" />
      </g>
    ),
    B2: (
      <g {...common}>
        <path d="M8 62h96" />
        <path d="M20 62V34l10-10 10 10v28" />
        <path d="M52 62V26l12-12 12 12v36" />
        <path d="M84 62V40h12v22" />
      </g>
    ),
    C1: (
      <g {...common}>
        <path d="M8 62h96" />
        <path d="M14 62V38h16v24M38 62V28h18v34M64 62V20h14v42M86 62V44h12v18" />
      </g>
    ),
    C2: (
      <g {...common}>
        <path d="M8 62h96" />
        <path d="M16 62V30h14v32M38 62V18h16v44M62 62V36h14v26M84 62V24h12v38" />
      </g>
    ),
  };
  return (
    <svg viewBox="0 0 110 70" className={className} aria-hidden="true" focusable="false">
      {art[level]}
    </svg>
  );
}

/* -------------------------------- video card ------------------------------ */

function VideoCard({ video }: { video: (typeof BROWSE_VIDEOS)[number] }) {
  const pal = LEVEL_PALETTE[video.level];
  return (
    <article className="group relative flex w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <img
          src={video.thumbnail}
          alt={video.title}
          loading="lazy"
          width={480}
          height={270}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            pal.badge,
          )}
        >
          {video.level}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full bg-foreground/80 px-2 py-0.5 text-[11px] font-medium text-background">
          {video.duration}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 pr-7 text-sm font-semibold leading-snug text-foreground">
          {video.title}
        </h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">{video.description}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          {video.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {t}
            </span>
          ))}
          <button
            type="button"
            aria-label={`Save ${video.title}`}
            className="ml-auto text-muted-foreground transition hover:text-primary"
          >
            <Bookmark className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

/* ---------------------------------- page --------------------------------- */

function BrowseByLevelPage() {
  const [level, setLevel] = useState<CefrLevel | "all">("all");
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  const videos = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BROWSE_VIDEOS.filter(
      (v) =>
        (level === "all" || v.level === level) &&
        (!q ||
          v.title.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }, [level, query]);

  return (
    <div className="min-h-screen bg-background">
      <TopNav onOpenSidebar={() => setMobileNav(true)} />

      <aside className="fixed bottom-0 left-0 top-16 z-40 hidden w-[248px] border-r border-border bg-card lg:block">
        <SidebarInner />
      </aside>

      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileNav(false)}
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
          />
          <div className="animate-slide-in-right absolute inset-y-0 left-0 w-[264px] border-r border-border bg-card">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileNav(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="pt-10">
              <SidebarInner />
            </div>
          </div>
        </div>
      )}

      <main className="lg:pl-[248px]">
        <div className="mx-auto max-w-[1200px] px-4 pb-24 pt-8 sm:px-8">
          {/* header + how it works */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Browse by Level
              </h1>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                Curated Dutch YouTube videos for every level. Learn with authentic content, at
                the right difficulty for you.
              </p>
            </div>
            <div className="flex max-w-sm items-start gap-3 rounded-2xl bg-muted/70 p-4">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Lightbulb className="h-4 w-4 text-primary" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">How it works</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Pick a level that matches your Dutch. Click any subtitle to learn instantly.
                </p>
              </div>
            </div>
          </div>

          {/* level tabs */}
          <div className="mt-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLevel("all")}
              className={cn(
                "min-w-[104px] rounded-xl border px-4 py-2.5 text-sm transition-all duration-200",
                level === "all"
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-foreground hover:border-primary/40",
              )}
            >
              <span className="font-semibold">All Levels</span>
            </button>
            {CEFR_LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                className={cn(
                  "min-w-[104px] rounded-xl border px-4 py-2 text-center transition-all duration-200",
                  level === l
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-foreground hover:border-primary/40",
                )}
              >
                <span className="block text-sm font-bold">{l}</span>
                <span
                  className={cn(
                    "block text-[11px]",
                    level === l ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {LEVEL_META[l].name}
                </span>
              </button>
            ))}
          </div>

          {/* search + filters */}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <div className="relative w-full sm:w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search videos..."
                aria-label="Search videos"
                className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/50"
              />
            </div>
            <Button variant="outline" className="h-10 gap-2 rounded-xl text-sm">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </Button>
          </div>

          {/* recommended */}
          <section className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Recommended for you
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hand-picked videos based on your level and interests.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLevel("all")}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View all <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {videos.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No videos match this level or search yet.
              </p>
            ) : (
              <div className="relative mt-5">
                <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {videos.map((v) => (
                    <VideoCard key={v.id} video={v} />
                  ))}
                </div>
                <span className="pointer-events-none absolute right-0 top-[80px] hidden h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm lg:flex">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            )}
          </section>

          {/* browse by level */}
          <section className="mt-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Browse by level
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Explore all videos in each level.
                </p>
              </div>
              <Link
                to="/library"
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View all levels <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {LEVEL_STATS.map((s) => {
                const pal = LEVEL_PALETTE[s.level];
                return (
                  <button
                    key={s.level}
                    type="button"
                    onClick={() => {
                      setLevel(s.level);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={cn(
                      "group flex flex-col overflow-hidden rounded-2xl border text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md",
                      pal.tile,
                      level === s.level && "ring-2 ring-primary/40",
                    )}
                  >
                    <div className="relative px-5 pb-2 pt-5">
                      <p className="font-display text-2xl font-bold text-foreground">{s.level}</p>
                      <p className="text-sm font-medium text-foreground/80">{s.label}</p>
                      <p className="mt-3 text-xs text-muted-foreground">{s.blurb}</p>
                      <LevelArt
                        level={s.level}
                        className={cn("mt-4 h-24 w-full", pal.art)}
                      />
                    </div>
                    <div className="flex items-center gap-3 border-t border-border/60 bg-card px-5 py-3">
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">{s.videos} videos</p>
                        <p>{s.duration}</p>
                      </div>
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
