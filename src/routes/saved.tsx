import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, Trash2, Play, ArrowLeft, Bookmark, Film, X } from "lucide-react";
import {
  listSavedExpressions,
  deleteSavedExpression,
} from "@/lib/saved-expressions.functions";
import { logLibraryEvent } from "@/lib/library-events.functions";
import { getBrowserId } from "@/lib/browser-id";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "My Expressions — NativeFlow" },
      {
        name: "description",
        content:
          "Your personal collection of useful sentences and expressions saved from videos.",
      },
    ],
  }),
  component: SavedPage,
});

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function extractVideoId(item: any): string | null {
  if (item.video_id) return item.video_id;
  const url: string | undefined = item.video_url;
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    const v = u.searchParams.get("v");
    if (v) return v;
    const parts = u.pathname.split("/");
    const i = parts.findIndex((p) => p === "embed" || p === "shorts");
    if (i >= 0 && parts[i + 1]) return parts[i + 1];
  } catch {
    /* ignore */
  }
  return null;
}

function SavedPage() {
  const listFn = useServerFn(listSavedExpressions);
  const deleteFn = useServerFn(deleteSavedExpression);
  const qc = useQueryClient();
  const [browserId, setBrowserId] = useState("");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setBrowserId(getBrowserId());
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["saved-expressions", browserId],
    queryFn: () => listFn({ data: { sessionId: browserId } }),
    enabled: !!browserId,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      deleteFn({ data: { sessionId: browserId, id } }),
    onSuccess: (_res, id) => {
      track("expression_removed", { expression_id: id });
      if (activeId === id) setActiveId(null);
      qc.invalidateQueries({ queryKey: ["saved-expressions", browserId] });
    },
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it: any) =>
      [it.sentence_text, it.translation, it.meaning, it.expression_notes, it.video_title]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(q))
    );
  }, [items, query]);

  function watchAgain(item: any) {
    const vid = extractVideoId(item);
    track("library_watch_again_clicked", {
      expression_id: item.id,
      video_id: vid,
      timestamp_seconds: item.timestamp_seconds,
    });
    if (!vid) return;
    setActiveId(item.id);
  }

  function closeVideo() {
    setActiveId(null);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Bookmark className="h-4 w-4 text-primary" /> My Expressions
          </h1>
          <span className="w-12" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search expressions, translations or videos…"
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your expressions…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasAny={items.length > 0} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filtered.map((item: any) => {
              const isActive = activeId === item.id;
              const vid = extractVideoId(item);
              return (
                <li
                  key={item.id}
                  className={
                    "flex flex-col rounded-2xl border bg-card p-4 shadow-sm ring-1 ring-primary/5 " +
                    (isActive
                      ? "border-primary/40 sm:col-span-2"
                      : "border-border")
                  }
                >
                  <div
                    className={
                      isActive
                        ? "grid gap-4 md:grid-cols-2"
                        : "contents"
                    }
                  >
                    {isActive && (
                      <div className="order-first md:order-last">
                        <EmbeddedPlayer
                          item={item}
                          videoId={vid!}
                          onClose={closeVideo}
                        />
                      </div>
                    )}

                    <div className="flex flex-col">
                      {/* Expression */}
                      <p className="text-lg font-semibold leading-snug text-foreground">
                        {item.sentence_text}
                      </p>

                      {item.translation && (
                        <p className="mt-2 text-sm text-foreground/85">
                          {item.translation}
                        </p>
                      )}

                      {/* Source */}
                      <div className="mt-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Source
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground/90">
                          <Film className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="truncate">
                            {item.video_title ?? "Untitled video"}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Saved at {fmtTime(item.timestamp_seconds ?? 0)}
                          {item.created_at && (
                            <> · {new Date(item.created_at).toLocaleDateString()}</>
                          )}
                        </p>
                      </div>

                      {(item.meaning ||
                        (item.expression_notes &&
                          item.expression_notes !== "—")) && (
                        <div className="mt-3 space-y-2 border-t border-border pt-3">
                          {item.meaning && (
                            <p className="text-xs text-foreground/80">
                              <span className="font-semibold text-foreground/70">
                                Meaning:
                              </span>{" "}
                              {item.meaning}
                            </p>
                          )}
                          {item.expression_notes &&
                            item.expression_notes !== "—" && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground/70">
                                  Notes:
                                </span>{" "}
                                {item.expression_notes}
                              </p>
                            )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {isActive ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={closeVideo}
                              className="gap-1.5"
                            >
                              <X className="h-3.5 w-3.5" /> Close video
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => watchAgain(item)}
                              disabled={!vid}
                              className="gap-1.5"
                              title="Play this saved moment without leaving My Library"
                            >
                              <Play className="h-3.5 w-3.5" /> Watch again
                            </Button>
                          )}
                        </div>
                        <button
                          onClick={() => removeMutation.mutate(item.id)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function EmbeddedPlayer({
  item,
  videoId,
  onClose,
}: {
  item: any;
  videoId: string;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadedRef = useRef(false);
  const completedRef = useRef(false);
  const start = Math.max(0, Math.floor(item.timestamp_seconds ?? 0));

  useEffect(() => {
    loadedRef.current = false;
    completedRef.current = false;
  }, [item.id]);

  // Listen for YouTube iframe API postMessage events to fire analytics.
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (typeof ev.data !== "string") return;
      if (!ev.origin.includes("youtube.com")) return;
      let payload: any;
      try {
        payload = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (payload.event === "onReady" && !loadedRef.current) {
        loadedRef.current = true;
        track("library_video_loaded", {
          expression_id: item.id,
          video_id: videoId,
          timestamp_seconds: start,
        });
      }
      // info update with playerState: 0 = ended
      if (
        (payload.event === "onStateChange" && payload.info === 0) ||
        (payload.event === "infoDelivery" && payload.info?.playerState === 0)
      ) {
        if (!completedRef.current) {
          completedRef.current = true;
          track("library_replay_completed", {
            expression_id: item.id,
            video_id: videoId,
          });
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [item.id, videoId, start]);

  const src = `https://www.youtube.com/embed/${videoId}?start=${start}&autoplay=1&rel=0&enablejsapi=1`;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-black">
      <div className="relative aspect-video w-full">
        <iframe
          ref={iframeRef}
          src={src}
          title={item.video_title ?? "Saved moment"}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="flex items-center justify-between gap-2 bg-card px-3 py-2">
        <p className="truncate text-xs text-muted-foreground">
          From {fmtTime(start)}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="h-7 gap-1 px-2 text-xs"
        >
          <X className="h-3.5 w-3.5" /> Close video
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bookmark className="h-6 w-6" />
      </div>
      <p className="mt-4 text-base font-semibold text-foreground">
        {hasAny ? "No matches" : "No saved expressions yet"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasAny
          ? "Try a different search term."
          : "Highlight any text in a transcript, or tap ★ Save on an explanation to bookmark it here."}
      </p>
      {!hasAny && (
        <Link
          to="/"
          className="mt-5 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Start learning
        </Link>
      )}
    </div>
  );
}
