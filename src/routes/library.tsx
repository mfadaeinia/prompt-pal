import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Play,
  Heart,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Search,
  Flame,
  ArrowLeft,
  Loader2,
  Gauge,
} from "lucide-react";
import {
  listCuratedVideos,
  listMyInteractions,
  toggleInteraction,
  getLearningPrefs,
  setLearningPrefs,
  CEFR_LEVELS,
  LIBRARY_CATEGORIES,
  type CuratedVideo,
  type CefrLevel,
  type InteractionKind,
} from "@/lib/curated-library.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/AuthDialog";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Curated Dutch Video Library — NativeFlow" },
      {
        name: "description",
        content:
          "A weekly-refreshed library of Dutch YouTube videos graded by CEFR level, category, speaking speed and length — pick one and start learning.",
      },
      { property: "og:title", content: "Curated Dutch Video Library — NativeFlow" },
      {
        property: "og:description",
        content:
          "Netflix-style discovery for Dutch learners: CEFR-graded YouTube videos with AI summaries, refreshed every week.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

/* ---------------------------------- utils --------------------------------- */

const LEVEL_STYLE: Record<string, string> = {
  A1: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  A2: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  B1: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  B2: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  C1: "bg-red-500/15 text-red-500 border-red-500/30",
  C2: "bg-red-500/15 text-red-500 border-red-500/30",
};
const LEVEL_DOT: Record<string, string> = {
  A1: "🟢", A2: "🟢", B1: "🔵", B2: "🟠", C1: "🔴", C2: "🔴",
};

function fmtDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}
function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function durationBucket(s: number | null) {
  if (!s) return "unknown";
  const m = s / 60;
  if (m < 10) return "<10";
  if (m < 20) return "10-20";
  if (m < 40) return "20-40";
  return "40+";
}

type Filters = {
  q: string;
  levels: string[];
  categories: string[];
  durations: string[];
  speeds: string[];
  sort: "personal" | "newest" | "popular";
};

/* ------------------------------- small parts ------------------------------- */

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
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function VideoCard({
  v,
  interactions,
  onInteract,
  featured,
}: {
  v: CuratedVideo;
  interactions: Set<string>;
  onInteract: (v: CuratedVideo, kind: InteractionKind, on: boolean) => void;
  featured?: boolean;
}) {
  const has = (k: InteractionKind) => interactions.has(`${v.id}:${k}`);
  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300",
        "hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5",
        featured ? "w-[280px] shrink-0 snap-start" : "",
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {v.thumbnail_url ? (
          <img
            src={v.thumbnail_url}
            alt={v.title}
            loading="lazy"
            width={480}
            height={270}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2">
          {v.cefr_level ? (
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[11px] font-bold backdrop-blur",
                LEVEL_STYLE[v.cefr_level],
              )}
            >
              {LEVEL_DOT[v.cefr_level]} {v.cefr_level}
            </span>
          ) : <span />}
          <span className="rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {fmtDuration(v.duration_sec)}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{v.title}</h3>
        <p className="text-xs text-muted-foreground">
          {v.channel}
          {v.published_at ? ` · ${fmtDate(v.published_at)}` : ""}
        </p>
        {v.summary ? (
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{v.summary}</p>
        ) : null}

        <div className="flex flex-wrap gap-1">
          {v.category ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {v.category}
            </span>
          ) : null}
          {(v.topics ?? []).slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>

        {v.speaking_speed ? (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Gauge className="h-3 w-3" />
            {v.speaking_speed} pace
            {v.words_per_minute ? ` · ~${v.words_per_minute} wpm` : ""}
          </p>
        ) : null}

        <div className="mt-auto flex items-center gap-1 pt-2">
          <Button asChild size="sm" className="h-8 flex-1 text-xs">
            <Link to="/" search={{ v: v.external_id } as never}>
              <Play className="mr-1 h-3.5 w-3.5" /> Open in NativeFlow
            </Link>
          </Button>
          <IconToggle
            title="Save"
            active={has("bookmark")}
            activeClass="text-rose-500"
            onClick={() => onInteract(v, "bookmark", !has("bookmark"))}
          >
            <Heart className={cn("h-4 w-4", has("bookmark") && "fill-current")} />
          </IconToggle>
          <IconToggle
            title="Mark as watched"
            active={has("watched")}
            activeClass="text-sky-500"
            onClick={() => onInteract(v, "watched", !has("watched"))}
          >
            <Eye className="h-4 w-4" />
          </IconToggle>
          <IconToggle
            title="More like this"
            active={has("like")}
            activeClass="text-emerald-500"
            onClick={() => onInteract(v, "like", !has("like"))}
          >
            <ThumbsUp className="h-4 w-4" />
          </IconToggle>
          <IconToggle
            title="Fewer like this"
            active={has("dislike")}
            activeClass="text-amber-500"
            onClick={() => onInteract(v, "dislike", !has("dislike"))}
          >
            <ThumbsDown className="h-4 w-4" />
          </IconToggle>
        </div>
      </div>
    </article>
  );
}

function IconToggle({
  active,
  activeClass,
  onClick,
  title,
  children,
}: {
  active: boolean;
  activeClass: string;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted",
        active && activeClass,
      )}
    >
      {children}
    </button>
  );
}

/* ---------------------------------- page ---------------------------------- */

function LibraryPage() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [authOpen, setAuthOpen] = useState(false);

  const fetchVideos = useServerFn(listCuratedVideos);
  const fetchInteractions = useServerFn(listMyInteractions);
  const fetchPrefs = useServerFn(getLearningPrefs);
  const saveInteraction = useServerFn(toggleInteraction);
  const savePrefs = useServerFn(setLearningPrefs);

  const videosQ = useQuery({
    queryKey: ["curated-videos"],
    queryFn: () => fetchVideos({ data: { limit: 200 } }),
  });
  const interactionsQ = useQuery({
    queryKey: ["curated-interactions"],
    queryFn: () => fetchInteractions({ data: {} as never }),
    enabled: isAuthenticated,
  });
  const prefsQ = useQuery({
    queryKey: ["learning-prefs"],
    queryFn: () => fetchPrefs({ data: {} as never }),
    enabled: isAuthenticated,
  });

  const interactionSet = useMemo(
    () => new Set((interactionsQ.data?.items ?? []).map((i) => `${i.curated_video_id}:${i.kind}`)),
    [interactionsQ.data],
  );

  const interactMut = useMutation({
    mutationFn: (p: { videoId: string; kind: InteractionKind; on: boolean }) =>
      saveInteraction({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["curated-interactions"] }),
  });
  const prefsMut = useMutation({
    mutationFn: (targetLevel: CefrLevel | null) => savePrefs({ data: { targetLevel } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning-prefs"] }),
  });

  const targetLevel = prefsQ.data?.targetLevel ?? null;

  const [filters, setFilters] = useState<Filters>({
    q: "",
    levels: [],
    categories: [],
    durations: [],
    speeds: [],
    sort: "personal",
  });
  const toggleIn = (key: keyof Filters, value: string) =>
    setFilters((f) => {
      const arr = f[key] as string[];
      return { ...f, [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value] };
    });

  const all = videosQ.data?.items ?? [];

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const rows = all.filter((v) => {
      if (filters.levels.length && !filters.levels.includes(v.cefr_level ?? "")) return false;
      if (filters.categories.length && !filters.categories.includes(v.category ?? "")) return false;
      if (filters.durations.length && !filters.durations.includes(durationBucket(v.duration_sec)))
        return false;
      if (filters.speeds.length && !filters.speeds.includes(v.speaking_speed ?? "")) return false;
      if (q) {
        const hay = [v.title, v.channel, v.summary ?? "", (v.topics ?? []).join(" ")]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const byLevelFit = (v: CuratedVideo) => {
      if (!targetLevel || !v.cefr_level) return 1;
      const d = CEFR_LEVELS.indexOf(v.cefr_level) - CEFR_LEVELS.indexOf(targetLevel);
      if (d === 0) return 4;      // mostly the target level
      if (d === 1) return 2.5;    // some easy step-up
      if (d === -1) return 0.8;   // very little below
      return 0.15;
    };

    return [...rows].sort((a, b) => {
      if (filters.sort === "newest")
        return (b.published_at ?? "").localeCompare(a.published_at ?? "");
      if (filters.sort === "popular") return b.popularity - a.popularity;
      const scoreOf = (v: CuratedVideo) =>
        byLevelFit(v) * (0.5 + Number(v.quality_score)) +
        (interactionSet.has(`${v.id}:like`) ? 0.5 : 0) -
        (interactionSet.has(`${v.id}:dislike`) ? 3 : 0) -
        (interactionSet.has(`${v.id}:watched`) ? 1 : 0);
      return scoreOf(b) - scoreOf(a);
    });
  }, [all, filters, targetLevel, interactionSet]);

  const featured = useMemo(() => {
    const weeks = all.map((v) => v.featured_week ?? "").filter(Boolean).sort();
    const latest = weeks[weeks.length - 1];
    const pool = latest ? all.filter((v) => v.featured_week === latest) : all;
    return [...pool]
      .sort((a, b) => Number(b.quality_score) - Number(a.quality_score))
      .slice(0, 10);
  }, [all]);

  const handleInteract = (v: CuratedVideo, kind: InteractionKind, on: boolean) => {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    track("library_interaction", { kind, on, video_id: v.external_id, level: v.cefr_level });
    interactMut.mutate({ videoId: v.id, kind, on });
  };

  const categoriesPresent = useMemo(() => {
    const set = new Set(all.map((v) => v.category).filter(Boolean) as string[]);
    return LIBRARY_CATEGORIES.filter((c) => set.has(c));
  }, [all]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" /> Home
            </Link>
          </Button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search titles, channels, topics…"
              className="pl-9"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-20">
        <section className="py-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Curated Dutch video library
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Hand-picked, CEFR-graded videos from trusted Dutch channels — refreshed every week so
            there's always something new at your level.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">My level:</span>
            {CEFR_LEVELS.map((lvl) => (
              <Chip
                key={lvl}
                active={targetLevel === lvl}
                onClick={() => {
                  if (!isAuthenticated) return setAuthOpen(true);
                  prefsMut.mutate(targetLevel === lvl ? null : lvl);
                }}
              >
                {LEVEL_DOT[lvl]} {lvl}
              </Chip>
            ))}
          </div>
        </section>

        {videosQ.isLoading ? (
          <div className="flex items-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading recommendations…
          </div>
        ) : all.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            The curated library is being built. Check back after the next weekly refresh.
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <section className="mb-10">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <Flame className="h-5 w-5 text-orange-500" /> Featured this week
                </h2>
                <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
                  {featured.map((v) => (
                    <VideoCard
                      key={v.id}
                      v={v}
                      featured
                      interactions={interactionSet}
                      onInteract={handleInteract}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="mb-6 space-y-3">
              <FilterRow label="Level">
                {CEFR_LEVELS.map((l) => (
                  <Chip key={l} active={filters.levels.includes(l)} onClick={() => toggleIn("levels", l)}>
                    {LEVEL_DOT[l]} {l}
                  </Chip>
                ))}
              </FilterRow>
              <FilterRow label="Category">
                {categoriesPresent.map((c) => (
                  <Chip
                    key={c}
                    active={filters.categories.includes(c)}
                    onClick={() => toggleIn("categories", c)}
                  >
                    {c}
                  </Chip>
                ))}
              </FilterRow>
              <FilterRow label="Length">
                {[
                  ["<10", "< 10 min"],
                  ["10-20", "10–20 min"],
                  ["20-40", "20–40 min"],
                  ["40+", "40+ min"],
                ].map(([k, label]) => (
                  <Chip
                    key={k}
                    active={filters.durations.includes(k)}
                    onClick={() => toggleIn("durations", k)}
                  >
                    {label}
                  </Chip>
                ))}
              </FilterRow>
              <FilterRow label="Pace">
                {["slow", "normal", "fast"].map((s) => (
                  <Chip key={s} active={filters.speeds.includes(s)} onClick={() => toggleIn("speeds", s)}>
                    {s}
                  </Chip>
                ))}
              </FilterRow>
              <FilterRow label="Sort">
                {([
                  ["personal", "For you"],
                  ["newest", "Newest"],
                  ["popular", "Most popular"],
                ] as const).map(([k, label]) => (
                  <Chip
                    key={k}
                    active={filters.sort === k}
                    onClick={() => setFilters((f) => ({ ...f, sort: k }))}
                  >
                    {label}
                  </Chip>
                ))}
              </FilterRow>
            </section>

            <p className="mb-3 text-xs text-muted-foreground">
              {filtered.length} video{filtered.length === 1 ? "" : "s"}
              {targetLevel && filters.sort === "personal" ? ` · tuned for ${targetLevel}` : ""}
            </p>

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                No videos match these filters. Try clearing a filter or searching for something else.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((v) => (
                  <VideoCard
                    key={v.id}
                    v={v}
                    interactions={interactionSet}
                    onInteract={handleInteract}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-1 gap-2 overflow-x-auto pb-1">{children}</div>
    </div>
  );
}
