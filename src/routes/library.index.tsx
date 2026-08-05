import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Clock,
  Lightbulb,
  Loader2,
  Play,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  SearchX,
} from "lucide-react";
import {
  listMyInteractions,
  toggleInteraction,
  CEFR_LEVELS,
  type CefrLevel,
  type CuratedVideo,
} from "@/lib/curated-library.functions";
import { LEVEL_META } from "@/lib/cefr-meta";
import { curatedVideosQuery } from "@/lib/curated-videos.query";
import { LEVEL_PALETTE } from "@/lib/cefr-palette";

import { LibraryShell } from "@/components/library/LibraryShell";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/AuthDialog";
import { useAuth } from "@/hooks/use-auth";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const LIBRARY_TITLE = "Browse Dutch Videos by Level — NativeFlow Library";
const LIBRARY_DESCRIPTION =
  "Discover carefully selected Dutch YouTube videos matched to your CEFR level, from A1 beginner to C2 proficient.";

export const Route = createFileRoute("/library/")({
  head: () => ({
    meta: [
      { title: LIBRARY_TITLE },
      { name: "description", content: LIBRARY_DESCRIPTION },
      { property: "og:title", content: LIBRARY_TITLE },
      { property: "og:description", content: LIBRARY_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://nativeflow.life/library" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: LIBRARY_TITLE },
      { name: "twitter:description", content: LIBRARY_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://nativeflow.life/library" }],
  }),
  // Prime the cache during SSR so the server-rendered HTML already contains the
  // curated videos instead of an indefinite "Loading…" skeleton.
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(curatedVideosQuery(300));
  },
  component: BrowsePage,

});

/* --------------------------------- helpers -------------------------------- */

function fmtDuration(s: number | null) {
  if (!s) return null;
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}
function durationBucket(s: number | null) {
  if (!s) return "unknown";
  const m = s / 60;
  if (m < 10) return "<10";
  if (m < 20) return "10-20";
  if (m < 40) return "20-40";
  return "40+";
}

type Sort = "popular" | "recent";

/* -------------------------------- video card ------------------------------- */

function VideoCard({
  v,
  saved,
  onOpen,
  onToggleSave,
  className,
}: {
  v: CuratedVideo;
  saved: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
  className?: string;
}) {
  const dur = fmtDuration(v.duration_sec);
  const level = v.cefr_level;
  const pal = level ? LEVEL_PALETTE[level] : null;
  const tags = [v.category, ...(v.topics ?? [])].filter(Boolean).slice(0, 2) as string[];

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200",
        "hover:-translate-y-1 hover:shadow-md",
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Watch ${v.title}`}
        className="relative block aspect-video w-full overflow-hidden bg-muted"
      >
        {v.thumbnail_url ? (
          <img
            src={v.thumbnail_url}
            alt={v.title}
            loading="lazy"
            width={480}
            height={270}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
        {level && pal ? (
          <span
            className={cn(
              "absolute left-3 top-3 rounded-lg px-2 py-0.5 text-[11px] font-bold",
              pal.badge,
            )}
          >
            {level}
          </span>
        ) : null}
        {dur ? (
          <span className="absolute bottom-3 right-3 rounded-lg bg-foreground/80 px-1.5 py-0.5 text-[11px] font-medium text-background">
            {dur}
          </span>
        ) : null}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-md transition group-hover:scale-105">
            <Play className="ml-0.5 h-4 w-4 text-primary" fill="currentColor" />
          </span>
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {v.title}
        </h3>
        <p className="truncate text-xs text-muted-foreground">{v.channel}</p>
        <div className="mt-auto flex items-center gap-1.5 pt-1">
          {tags.map((t) => (
            <span
              key={t}
              className="truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {t}
            </span>
          ))}
          <button
            type="button"
            onClick={onToggleSave}
            aria-label={saved ? "Remove bookmark" : "Bookmark video"}
            aria-pressed={saved}
            className={cn(
              "ml-auto rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground",
              saved && "text-primary",
            )}
          >
            <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    </article>
  );
}

/* ---------------------------------- page ---------------------------------- */

function BrowsePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  
  const fetchInteractions = useServerFn(listMyInteractions);
  const saveInteraction = useServerFn(toggleInteraction);

  const videosQ = useQuery(curatedVideosQuery(300));

  const interactionsQ = useQuery({
    queryKey: ["curated-interactions"],
    queryFn: () => fetchInteractions({ data: {} as never }),
    enabled: isAuthenticated,
  });
  const interactMut = useMutation({
    mutationFn: (p: { videoId: string; kind: "bookmark" | "watched"; on: boolean }) =>
      saveInteraction({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["curated-interactions"] }),
  });

  useEffect(() => {
    track("library_opened", { source: "browse_dashboard" });
  }, []);

  const all = videosQ.data?.items ?? [];

  const [level, setLevel] = useState<CefrLevel | "all">("all");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [durations, setDurations] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("popular");

  const bookmarked = useMemo(
    () =>
      new Set(
        (interactionsQ.data?.items ?? [])
          .filter((i) => i.kind === "bookmark")
          .map((i) => i.curated_video_id),
      ),
    [interactionsQ.data],
  );
  const watched = useMemo(
    () =>
      new Set(
        (interactionsQ.data?.items ?? [])
          .filter((i) => i.kind === "watched")
          .map((i) => i.curated_video_id),
      ),
    [interactionsQ.data],
  );

  const stats = useMemo(() => {
    const map = {} as Record<CefrLevel, { total: number; avgMin: number }>;
    const sums = {} as Record<CefrLevel, { min: number; n: number }>;
    for (const l of CEFR_LEVELS) {
      map[l] = { total: 0, avgMin: 0 };
      sums[l] = { min: 0, n: 0 };
    }
    for (const v of all) {
      if (!v.cefr_level || !(v.cefr_level in map)) continue;
      map[v.cefr_level].total += 1;
      if (v.duration_sec) {
        sums[v.cefr_level].min += v.duration_sec / 60;
        sums[v.cefr_level].n += 1;
      }
    }
    for (const l of CEFR_LEVELS) {
      map[l].avgMin = sums[l].n ? Math.round(sums[l].min / sums[l].n) : 0;
    }
    return map;
  }, [all]);

  const topicsPresent = useMemo(() => {
    const set = new Set<string>();
    for (const v of all) if (v.category) set.add(v.category);
    return [...set].sort();
  }, [all]);

  const q = query.trim().toLowerCase();
  const filtering = q.length > 0 || level !== "all" || topics.length > 0 || durations.length > 0;

  const filtered = useMemo(() => {
    const rows = all.filter((v) => {
      if (level !== "all" && v.cefr_level !== level) return false;
      if (topics.length && !topics.includes(v.category ?? "")) return false;
      if (durations.length && !durations.includes(durationBucket(v.duration_sec))) return false;
      if (q) {
        const hay = [v.title, v.channel, v.category ?? "", ...(v.topics ?? [])]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...rows].sort((a, b) =>
      sort === "recent"
        ? (b.added_at ?? "").localeCompare(a.added_at ?? "")
        : b.popularity - a.popularity,
    );
  }, [all, level, topics, durations, q, sort]);

  const recommended = useMemo(
    () =>
      [...all]
        .filter((v) => !watched.has(v.id))
        .sort((a, b) => Number(b.quality_score) - Number(a.quality_score))
        .slice(0, 10),
    [all, watched],
  );

  const continueVideo = useMemo(() => {
    if (!isAuthenticated || watched.size === 0) return null;
    return all.find((v) => !watched.has(v.id)) ?? null;
  }, [all, watched, isAuthenticated]);

  const openVideo = (v: CuratedVideo, source: string) => {
    track("video_started", {
      source,
      level: v.cefr_level,
      video_id: v.external_id,
      topic: v.category,
    });
    navigate({ to: "/", search: { v: v.url } as never });
  };

  const toggleSave = (v: CuratedVideo) => {
    if (!isAuthenticated) return setAuthOpen(true);
    interactMut.mutate({ videoId: v.id, kind: "bookmark", on: !bookmarked.has(v.id) });
  };

  return (
    <LibraryShell>
      {/* header */}
      <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            to="/"
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            ← Back to home
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-[2.5rem]">
            Browse by Level
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Discover carefully selected Dutch YouTube videos matched to your language level.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="group flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3 shadow-sm transition-all duration-200 focus-within:w-[260px] focus-within:border-primary/50 sm:w-[220px]">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search videos…"
              aria-label="Search videos"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-full"
            onClick={() => setShowFilters((s) => !s)}
          >
            <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-full"
            onClick={() => setSort((s) => (s === "popular" ? "recent" : "popular"))}
          >
            <ArrowUpDown className="mr-1.5 h-4 w-4" />
            {sort === "popular" ? "Popular" : "Recently added"}
          </Button>
        </div>
      </header>

      {/* level selector */}
      <div className="mt-8 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <LevelTab active={level === "all"} onClick={() => setLevel("all")} title="All" />
        {CEFR_LEVELS.map((l) => (
          <LevelTab
            key={l}
            active={level === l}
            title={l}
            subtitle={LEVEL_META[l].name}
            onClick={() => {
              setLevel(l);
              track("cefr_filter_used", { source: "browse_dashboard", level: l });
            }}
          />
        ))}
      </div>

      {showFilters && (
        <section className="nf-rise-in mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <FilterRow label="Topic">
            {topicsPresent.map((t) => (
              <Chip
                key={t}
                active={topics.includes(t)}
                onClick={() =>
                  setTopics((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
                }
              >
                {t}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Duration">
            {[
              ["<10", "< 10 min"],
              ["10-20", "10–20 min"],
              ["20-40", "20–40 min"],
              ["40+", "40+ min"],
            ].map(([k, label]) => (
              <Chip
                key={k}
                active={durations.includes(k)}
                onClick={() =>
                  setDurations((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))
                }
              >
                {label}
              </Chip>
            ))}
          </FilterRow>
          {(topics.length > 0 || durations.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setTopics([]);
                setDurations([]);
              }}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </section>
      )}

      {videosQ.isLoading ? (
        <div className="flex items-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading curated videos…
        </div>
      ) : videosQ.isError ? (
        <div className="my-10 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            We couldn't load the library just now.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check your connection and try again, the videos are still there.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => videosQ.refetch()}>
            Try again
          </Button>
        </div>
      ) : (

        <>
          {/* continue learning */}
          {continueVideo && !filtering && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-foreground">Continue learning</h2>
              <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => openVideo(continueVideo, "continue_learning")}
                  className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-56"
                >
                  {continueVideo.thumbnail_url ? (
                    <img
                      src={continueVideo.thumbnail_url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Continue where you left off
                  </p>
                  <p className="mt-1 line-clamp-2 text-base font-semibold text-foreground">
                    {continueVideo.title}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {continueVideo.channel}
                    {continueVideo.duration_sec ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtDuration(continueVideo.duration_sec)}
                      </span>
                    ) : null}
                  </p>
                  <div className="mt-3 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.min(95, Math.round((watched.size / Math.max(1, all.length)) * 100) + 5)}%`,
                      }}
                    />
                  </div>
                </div>
                <Button
                  className="rounded-full sm:self-center"
                  onClick={() => openVideo(continueVideo, "continue_learning")}
                >
                  <Play className="mr-1.5 h-4 w-4" /> Resume
                </Button>
              </div>
            </section>
          )}

          {/* recommended carousel */}
          {!filtering && recommended.length > 0 && (
            <section className="mt-10">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Recommended for you</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Hand-picked videos based on your level and interests.
                  </p>
                </div>
              </div>
              <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
                {recommended.map((v) => (
                  <VideoCard
                    key={v.id}
                    v={v}
                    saved={bookmarked.has(v.id)}
                    onOpen={() => openVideo(v, "browse_recommended")}
                    onToggleSave={() => toggleSave(v)}
                    className="w-[76%] shrink-0 snap-start sm:w-[280px]"
                  />
                ))}
              </div>
            </section>
          )}

          {/* level tiles */}
          {!filtering && (
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-foreground">Browse by level</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Explore all videos in each level.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CEFR_LEVELS.map((l) => {
                  const pal = LEVEL_PALETTE[l];
                  const meta = LEVEL_META[l];
                  const s = stats[l];
                  return (
                    <Link
                      key={l}
                      to="/library/$level"
                      params={{ level: l.toLowerCase() }}
                      onClick={() =>
                        track("cefr_level_selected", {
                          source: "browse_dashboard",
                          level: l,
                          video_count: s.total,
                        })
                      }
                      className={cn(
                        "group flex flex-col overflow-hidden rounded-[20px] border shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md",
                        pal.tile,
                      )}
                    >
                      <div className="p-5">
                        <p className="text-2xl font-bold tracking-tight text-foreground">{l}</p>
                        <p className="text-sm font-semibold text-foreground/80">{meta.name}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{pal.blurb}</p>
                      </div>
                      <div className={cn("px-5", pal.art)}>
                        <svg viewBox="0 0 240 60" className="h-14 w-full" aria-hidden="true">
                          <path
                            d="M0 55 L40 30 L70 45 L110 15 L150 40 L190 20 L240 45 L240 60 L0 60 Z"
                            fill="currentColor"
                            opacity="0.5"
                          />
                          <circle cx="200" cy="16" r="8" fill="currentColor" />
                        </svg>
                      </div>
                      <div className="flex items-center justify-between border-t border-border/50 bg-card/60 px-5 py-3">
                        <div className="text-xs text-muted-foreground">
                          <p className="font-medium text-foreground">{s.total} videos</p>
                          <p>{s.avgMin || "—"} min average</p>
                        </div>
                        <span className="flex items-center gap-1 text-xs font-semibold text-foreground transition group-hover:translate-x-0.5">
                          Explore <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* results grid */}
          {filtering && (
            <section className="mt-8">
              <p className="text-sm text-muted-foreground">
                {filtered.length} video{filtered.length === 1 ? "" : "s"}
                {level !== "all" ? ` at ${level}` : ""}
              </p>
              {filtered.length === 0 ? (
                <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                    <SearchX className="h-7 w-7 text-muted-foreground" />
                  </span>
                  <p className="mt-4 text-base font-semibold text-foreground">No videos found.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try another level or remove filters.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-full"
                    onClick={() => {
                      setQuery("");
                      setLevel("all");
                      setTopics([]);
                      setDurations([]);
                    }}
                  >
                    Reset everything
                  </Button>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((v) => (
                    <VideoCard
                      key={v.id}
                      v={v}
                      saved={bookmarked.has(v.id)}
                      onOpen={() => openVideo(v, "browse_results")}
                      onToggleSave={() => toggleSave(v)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* learning tip */}
          <aside className="mt-12 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 lg:fixed lg:bottom-6 lg:right-6 lg:mt-0 lg:max-w-xs lg:shadow-md">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Lightbulb className="h-4 w-4 text-primary" />
            </span>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Tip. </span>
              Click any subtitle while watching to instantly understand vocabulary, expressions,
              grammar and context.
            </p>
          </aside>
        </>
      )}

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </LibraryShell>
  );
}

/* ------------------------------ small pieces ------------------------------ */

function LevelTab({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-2xl border px-4 py-2 text-center transition-all duration-200",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-foreground hover:border-primary/40 hover:shadow-sm",
      )}
    >
      <span className="block text-sm font-semibold">{title}</span>
      {subtitle && (
        <span
          className={cn(
            "block text-[11px]",
            active ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {subtitle}
        </span>
      )}
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-1 gap-2 overflow-x-auto pb-1">{children}</div>
    </div>
  );
}
