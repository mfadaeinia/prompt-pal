import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Loader2,
  CheckCircle2,
  Gauge,
  Clock,
} from "lucide-react";
import {
  listCuratedVideos,
  listMyInteractions,
  toggleInteraction,
  type CuratedVideo,
} from "@/lib/curated-library.functions";
import { LEVEL_META, NEXT_LEVEL, parseLevel } from "@/lib/cefr-meta";
import { curatedVideosQuery } from "@/lib/curated-videos.query";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/AuthDialog";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/library/$level")({
  head: ({ params }) => {
    const level = parseLevel(params.level) ?? "A1";
    const meta = LEVEL_META[level];
    const title = `${level} Dutch Learning Library — NativeFlow`;
    const description = `${meta.name} Dutch: curated YouTube videos at CEFR ${level}. ${meta.short}`;
    const url = `https://nativeflow.life/library/${level}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  loader: ({ params, context }) => {
    if (!parseLevel(params.level)) throw notFound();
    void context.queryClient.ensureQueryData(curatedVideosQuery(300));
  },

  component: LevelPage,
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

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-1 gap-2 overflow-x-auto pb-1">{children}</div>
    </div>
  );
}

/* ---------------------------------- page ---------------------------------- */

function LevelPage() {
  const params = Route.useParams();
  const level = parseLevel(params.level)!;
  const meta = LEVEL_META[level];
  const nextLevel = NEXT_LEVEL[level];

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
    mutationFn: (p: { videoId: string; kind: "watched"; on: boolean }) =>
      saveInteraction({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["curated-interactions"] }),
  });

  const levelVideos = useMemo(
    () => (videosQ.data?.items ?? []).filter((v) => v.cefr_level === level),
    [videosQ.data, level],
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

  const done = levelVideos.filter((v) => watched.has(v.id)).length;
  const total = levelVideos.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  useEffect(() => {
    track("library_level_viewed", { level, video_count: levelVideos.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, videosQ.isSuccess]);

  const [topics, setTopics] = useState<string[]>([]);
  const [durations, setDurations] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("popular");
  useEffect(() => {
    setTopics([]);
    setDurations([]);
    setSort("popular");
  }, [level]);

  const topicsPresent = useMemo(() => {
    const set = new Set<string>();
    for (const v of levelVideos) if (v.category) set.add(v.category);
    return [...set].sort();
  }, [levelVideos]);

  const filtered = useMemo(() => {
    const rows = levelVideos.filter((v) => {
      if (topics.length && !topics.includes(v.category ?? "")) return false;
      if (durations.length && !durations.includes(durationBucket(v.duration_sec))) return false;
      return true;
    });
    return [...rows].sort((a, b) =>
      sort === "recent"
        ? (b.added_at ?? "").localeCompare(a.added_at ?? "")
        : b.popularity - a.popularity,
    );
  }, [levelVideos, topics, durations, sort]);

  const continueVideo = useMemo(
    () => levelVideos.find((v) => !watched.has(v.id)) ?? null,
    [levelVideos, watched],
  );

  const openVideo = (v: CuratedVideo) => {
    track("video_started", {
      source: "library_level",
      level,
      video_id: v.external_id,
      topic: v.category,
    });
    navigate({ to: "/", search: { v: v.url } as never });
  };

  const markComplete = (v: CuratedVideo, on: boolean) => {
    if (!isAuthenticated) return setAuthOpen(true);
    if (on)
      track("video_completed", {
        source: "library_level",
        level,
        video_id: v.external_id,
        topic: v.category,
        completion_rate: total ? (done + 1) / total : 0,
      });
    interactMut.mutate({ videoId: v.id, kind: "watched", on });
  };

  const readyForNext = pct >= 50;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to="/library">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Levels
            </Link>
          </Button>
          <span
            className={cn("rounded-md border px-2 py-0.5 text-xs font-bold", meta.badge)}
          >
            {level}
          </span>
          <Link to="/" className="ml-auto" aria-label="NativeFlow home">
            <BrandLogo markClassName="h-7 w-7" wordClassName="hidden sm:inline" gradientId="nf-level" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24">
        <section className="py-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {level} Dutch Learning Library
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{meta.who}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Estimated vocabulary: {meta.vocab}
          </p>

          {isAuthenticated && total > 0 && (
            <div className="mt-5 max-w-xl rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium">
                You've completed {done} of {total} {level} videos
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", meta.bar)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {continueVideo && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => openVideo(continueVideo)}
                >
                  <Play className="mr-1 h-3.5 w-3.5" />
                  {done > 0 ? "Continue where you left off" : "Start the first video"}
                </Button>
              )}
            </div>
          )}
        </section>

        {videosQ.isLoading ? (
          <div className="flex items-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading {level} videos…
          </div>
        ) : total === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            New lessons for this level are coming soon.
          </div>
        ) : (
          <>
            <section className="mb-6 space-y-3">
              {topicsPresent.length > 0 && (
                <FilterRow label="Topic">
                  {topicsPresent.map((t) => (
                    <Chip
                      key={t}
                      active={topics.includes(t)}
                      onClick={() => {
                        track("library_topic_filter_used", { level, topic: t });
                        setTopics((p) =>
                          p.includes(t) ? p.filter((x) => x !== t) : [...p, t],
                        );
                      }}
                    >
                      {t}
                    </Chip>
                  ))}
                </FilterRow>
              )}
              <FilterRow label="Length">
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
                      setDurations((p) =>
                        p.includes(k) ? p.filter((x) => x !== k) : [...p, k],
                      )
                    }
                  >
                    {label}
                  </Chip>
                ))}
              </FilterRow>
              <FilterRow label="Sort">
                {(
                  [
                    ["popular", "Most popular"],
                    ["recent", "Recently added"],
                  ] as const
                ).map(([k, label]) => (
                  <Chip key={k} active={sort === k} onClick={() => setSort(k)}>
                    {label}
                  </Chip>
                ))}
              </FilterRow>
            </section>

            <p className="mb-3 text-xs text-muted-foreground">
              {filtered.length} video{filtered.length === 1 ? "" : "s"} at {level}
            </p>

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                No {level} videos match these filters. Try clearing a filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((v) => (
                  <VideoCard
                    key={v.id}
                    v={v}
                    meta={meta}
                    completed={watched.has(v.id)}
                    onOpen={() => openVideo(v)}
                    onToggleComplete={(on) => markComplete(v, on)}
                  />
                ))}
              </div>
            )}

            {nextLevel && (
              <section className="mt-12 rounded-2xl border border-border bg-card p-6 text-center">
                <h2 className="text-lg font-semibold">Ready for the next challenge?</h2>
                {readyForNext ? (
                  <>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You've completed {pct}% of {level}. {LEVEL_META[nextLevel].short}
                    </p>
                    <Button asChild className="mt-4">
                      <Link
                        to="/library/$level"
                        params={{ level: nextLevel.toLowerCase() }}
                        onClick={() =>
                          track("cefr_level_selected", {
                            source: "level_upsell",
                            level: nextLevel,
                            from_level: level,
                          })
                        }
                      >
                        Continue to {nextLevel} <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Watch at least half of the {level} videos and we'll unlock{" "}
                    {nextLevel} for you. {done} of {total} done so far.
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

function VideoCard({
  v,
  meta,
  completed,
  onOpen,
  onToggleComplete,
}: {
  v: CuratedVideo;
  meta: (typeof LEVEL_META)[keyof typeof LEVEL_META];
  completed: boolean;
  onOpen: () => void;
  onToggleComplete: (on: boolean) => void;
}) {
  const dur = fmtDuration(v.duration_sec);
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-sm hover:shadow-primary/5">
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-video w-full overflow-hidden bg-muted"
      >
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
        <span className="absolute bottom-2 left-2 flex gap-1">
          <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-bold", meta.badge)}>
            {meta.dot} {v.cefr_level}
          </span>
          {dur ? (
            <span className="rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
              {dur}
            </span>
          ) : null}
        </span>
        {completed ? (
          <span className="absolute right-2 top-2 rounded-full bg-emerald-500 p-1 text-white">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{v.title}</h3>
        <p className="text-xs text-muted-foreground">{v.channel}</p>

        <div className="flex flex-wrap gap-1">
          {v.category ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {v.category}
            </span>
          ) : null}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {meta.vocab}
          </span>
        </div>

        <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {v.speaking_speed ? (
            <span className="flex items-center gap-1">
              <Gauge className="h-3 w-3" /> {v.speaking_speed} pace
            </span>
          ) : null}
          {dur ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {dur}
            </span>
          ) : null}
        </p>

        <div className="mt-auto flex items-center gap-1 pt-2">
          <Button size="sm" className="h-8 flex-1 text-xs" onClick={onOpen}>
            <Play className="mr-1 h-3.5 w-3.5" /> Watch
          </Button>
          <button
            type="button"
            title={completed ? "Mark as not completed" : "Mark as completed"}
            aria-label={completed ? "Mark as not completed" : "Mark as completed"}
            aria-pressed={completed}
            onClick={() => onToggleComplete(!completed)}
            className={cn(
              "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted",
              completed && "text-emerald-500",
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
