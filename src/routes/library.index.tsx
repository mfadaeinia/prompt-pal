import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight, Loader2, GraduationCap, BookOpen } from "lucide-react";
import {
  listCuratedVideos,
  listMyInteractions,
  CEFR_LEVELS,
  type CefrLevel,
} from "@/lib/curated-library.functions";
import { LEVEL_META } from "@/lib/cefr-meta";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/library/")({
  head: () => ({
    meta: [
      { title: "Choose Your Dutch Level — NativeFlow Library" },
      {
        name: "description",
        content:
          "Pick your CEFR level from A1 to C2 and browse curated Dutch YouTube videos matched to your proficiency.",
      },
      { property: "og:title", content: "Choose Your Dutch Level — NativeFlow Library" },
      {
        property: "og:description",
        content:
          "A guided Dutch learning path: choose A1–C2 and watch curated native videos at exactly your level.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryLevelsPage,
});

function LibraryLevelsPage() {
  const { isAuthenticated } = useAuth();
  const fetchVideos = useServerFn(listCuratedVideos);
  const fetchInteractions = useServerFn(listMyInteractions);

  const videosQ = useQuery({
    queryKey: ["curated-videos", 300],
    queryFn: () => fetchVideos({ data: { limit: 300 } }),
    staleTime: 5 * 60_000,
  });
  const interactionsQ = useQuery({
    queryKey: ["curated-interactions"],
    queryFn: () => fetchInteractions({ data: {} as never }),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    track("library_opened", { source: "library_levels" });
  }, []);

  const all = videosQ.data?.items ?? [];

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
    const map = {} as Record<CefrLevel, { total: number; done: number }>;
    for (const l of CEFR_LEVELS) map[l] = { total: 0, done: 0 };
    for (const v of all) {
      if (!v.cefr_level || !(v.cefr_level in map)) continue;
      map[v.cefr_level].total += 1;
      if (watched.has(v.id)) map[v.cefr_level].done += 1;
    }
    return map;
  }, [all, watched]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" /> Home
            </Link>
          </Button>
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-primary" /> Library
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24">
        <section className="py-10 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5 text-primary" /> Guided learning path
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Choose Your Dutch Level
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Browse curated YouTube videos selected for your current proficiency level.
          </p>
        </section>

        {videosQ.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading levels…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CEFR_LEVELS.map((level) => {
              const meta = LEVEL_META[level];
              const { total, done } = stats[level];
              return (
                <Link
                  key={level}
                  to="/library/$level"
                  params={{ level: level.toLowerCase() }}
                  onClick={() =>
                    track("cefr_level_selected", {
                      source: "library_levels",
                      level,
                      video_count: total,
                    })
                  }
                  className={cn(
                    "group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-all",
                    "hover:-translate-y-1 hover:shadow-lg",
                    meta.ring,
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-lg font-black tracking-tight",
                        meta.badge,
                      )}
                    >
                      {level}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>

                  <h2 className="mt-3 text-lg font-semibold">{meta.name}</h2>
                  <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {meta.short}
                  </p>

                  <dl className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <dd className="font-medium text-foreground">
                      {total} curated video{total === 1 ? "" : "s"}
                    </dd>
                    <dd>{meta.vocab}</dd>
                  </dl>

                  {isAuthenticated && total > 0 && (
                    <div className="mt-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all", meta.bar)}
                          style={{ width: `${Math.round((done / total) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {done} of {total} completed
                      </p>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
