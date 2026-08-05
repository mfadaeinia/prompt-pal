import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Library, Play, Flame, ArrowRight, Loader2 } from "lucide-react";
import {
  listCuratedVideos,
  CEFR_LEVELS,
  type CuratedVideo,
  type CefrLevel,
} from "@/lib/curated-library.functions";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const LEVEL_DOT: Record<string, string> = {
  A1: "🟢", A2: "🟢", B1: "🔵", B2: "🟠", C1: "🔴", C2: "🔴",
};

function fmtDuration(s: number | null) {
  if (!s) return null;
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export function useCuratedVideos(limit = 60) {
  return useQuery(curatedVideosQuery(limit));
}


function LibraryCard({
  v,
  onOpen,
  featured,
}: {
  v: CuratedVideo;
  onOpen: (v: CuratedVideo) => void;
  featured?: boolean;
}) {
  const dur = fmtDuration(v.duration_sec);
  return (
    <button
      type="button"
      onClick={() => onOpen(v)}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        featured && "ring-1 ring-primary/30",
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {v.thumbnail_url ? (
          <img
            src={v.thumbnail_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
          />
        ) : null}
        <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/25">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-lg">
            <Play className="ml-0.5 h-4 w-4 text-primary" fill="currentColor" />
          </span>
        </span>
        <span className="absolute bottom-2 left-2 flex gap-1">
          {v.cefr_level ? (
            <span className="rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {LEVEL_DOT[v.cefr_level]} {v.cefr_level}
            </span>
          ) : null}
          {dur ? (
            <span className="rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {dur}
            </span>
          ) : null}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold text-foreground">{v.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {v.channel}
          {v.category ? ` · ${v.category}` : ""}
        </p>
      </div>
    </button>
  );
}

/**
 * Curated-library discovery strip, reused across the Learning Hub, the
 * post-demo screen, the player ("You may also like") and the landing page.
 * Search always stays the primary action — this is the secondary path for
 * users who don't know what to watch yet.
 */
export function LibraryStrip({
  title = "Not sure what to watch?",
  subtitle = "Browse our curated learning library.",
  onPick,
  showLevels = true,
  showFeatured = true,
  limit = 8,
  source,
  similarTo,
  className,
}: {
  title?: string;
  subtitle?: string;
  /** When provided, videos open inside the app instead of navigating. */
  onPick?: (url: string, language?: string) => void;
  showLevels?: boolean;
  showFeatured?: boolean;
  limit?: number;
  /** Analytics context: "hub" | "post_demo" | "player" | "landing" | "empty_state" */
  source: string;
  /** YouTube id of the video currently being watched — enables similarity ranking. */
  similarTo?: string | null;
  className?: string;
}) {
  const q = useCuratedVideos(60);
  const [level, setLevel] = useState<CefrLevel | null>(null);
  const all = q.data?.items ?? [];

  const featured = useMemo(() => {
    if (!showFeatured || all.length === 0) return null;
    const weeks = all.map((v) => v.featured_week ?? "").filter(Boolean).sort();
    const latest = weeks[weeks.length - 1];
    const pool = latest ? all.filter((v) => v.featured_week === latest) : all;
    return (
      [...pool].sort((a, b) => Number(b.quality_score) - Number(a.quality_score))[0] ?? null
    );
  }, [all, showFeatured]);

  const items = useMemo(() => {
    let rows = all.filter((v) => v.external_id !== similarTo);
    if (level) rows = rows.filter((v) => v.cefr_level === level);

    if (similarTo) {
      const current = all.find((v) => v.external_id === similarTo);
      if (current) {
        const topics = new Set(current.topics ?? []);
        const score = (v: CuratedVideo) =>
          (v.cefr_level && v.cefr_level === current.cefr_level ? 3 : 0) +
          (v.category && v.category === current.category ? 2 : 0) +
          (v.topics ?? []).filter((t) => topics.has(t)).length +
          (v.speaking_speed === current.speaking_speed ? 0.5 : 0) +
          Number(v.quality_score) * 0.2;
        rows = [...rows].sort((a, b) => score(b) - score(a));
      }
    } else {
      rows = [...rows].sort((a, b) => Number(b.quality_score) - Number(a.quality_score));
    }
    return rows.filter((v) => v.id !== featured?.id).slice(0, limit);
  }, [all, level, limit, similarTo, featured]);

  const open = (v: CuratedVideo, kind: "card" | "featured") => {
    track("library_video_selected", {
      source,
      video_id: v.external_id,
      level: v.cefr_level,
      category: v.category,
      featured: kind === "featured",
    });
    if (kind === "featured") track("weekly_featured_clicked", { source, video_id: v.external_id });
    if (onPick) {
      track("library_to_watch", { source, video_id: v.external_id });
      // Pass the SPOKEN language of the video as an ISO-639-1 code so the
      // transcript pipeline fetches the original (Dutch) captions — never a
      // human-readable label, which would be an invalid caption track.
      onPick(v.url, (v.language || "nl").toLowerCase().split(/[-_]/)[0]);
    } else if (typeof window !== "undefined") {
      window.location.href = `/?v=${encodeURIComponent(v.url)}`;
    }
  };

  if (q.isLoading) {
    return (
      <div className={cn("flex items-center gap-2 py-8 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading curated lessons…
      </div>
    );
  }
  if (all.length === 0) return null;

  return (
    <section className={cn("rounded-2xl border border-border/60 bg-muted/30 p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground sm:text-base">
            <Library className="h-4 w-4 text-primary" />
            {title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/library" onClick={() => track("library_opened", { source })}>
            Browse Library <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {showLevels && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {CEFR_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                const next = level === l ? null : l;
                setLevel(next);
                if (next) track("cefr_filter_used", { source, level: next });
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                level === l
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {LEVEL_DOT[l]} {l}
            </button>
          ))}
        </div>
      )}

      {featured && !level && (
        <button
          type="button"
          onClick={() => open(featured, "featured")}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3 text-left transition hover:bg-primary/10"
        >
          <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-muted sm:w-40">
            {featured.thumbnail_url ? (
              <img src={featured.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-orange-500">
              <Flame className="h-3.5 w-3.5" /> Weekly featured
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{featured.title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {featured.channel}
              {featured.cefr_level ? ` · ${featured.cefr_level}` : ""}
            </p>
          </div>
        </button>
      )}

      {items.length > 0 && (
        <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
          {items.map((v) => (
            <div key={v.id} className="w-[62%] shrink-0 snap-start sm:w-auto">
              <LibraryCard v={v} onOpen={(x) => open(x, "card")} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
