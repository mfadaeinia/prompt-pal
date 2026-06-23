import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, Trash2, Play, ArrowLeft, Bookmark, Film, X, LogOut, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import {
  listSavedExpressions,
  deleteSavedExpression,
} from "@/lib/saved-expressions.functions";
import { listSavedVideos, deleteSavedVideo } from "@/lib/saved-videos.functions";
import { generateWordExamples } from "@/lib/word-examples.functions";
import { logLibraryEvent } from "@/lib/library-events.functions";
import { getBrowserId } from "@/lib/browser-id";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/AuthDialog";
import { supabase } from "@/integrations/supabase/client";

function isWordItem(item: any): boolean {
  const notes = (item?.expression_notes ?? "").toString();
  if (notes.trim().toLowerCase().startsWith("from:")) return true;
  const text = (item?.sentence_text ?? "").toString().trim();
  if (!text) return false;
  // Treat short entries (1–4 tokens, no terminal punctuation) as words/expressions.
  const wordCount = text.split(/\s+/).length;
  return wordCount <= 4 && !/[.!?]$/.test(text);
}

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "My Library — NativeFlow" },
      {
        name: "description",
        content:
          "Your personal collection of saved YouTube videos and language expressions.",
      },
      { property: "og:title", content: "My Library — NativeFlow" },
      { property: "og:description", content: "Your saved YouTube videos and language expressions." },
      { property: "og:url", content: "https://native-lens.lovable.app/saved" },
      { name: "twitter:title", content: "My Library — NativeFlow" },
      { name: "twitter:description", content: "Your saved YouTube videos and language expressions." },
    ],
    links: [
      { rel: "canonical", href: "https://native-lens.lovable.app/saved" },
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
  const { user, isAuthenticated, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Bookmark className="h-4 w-4 text-primary" /> My Library
            </h1>
            <span className="w-12" />
          </div>
        </header>
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bookmark className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-foreground">Sign in to see your library</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Save videos and expressions to your account so you can pick up where you left off, on any device.
          </p>
          <Button className="mt-6" onClick={() => setAuthOpen(true)}>Sign in</Button>
          <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
        </main>
      </div>
    );
  }

  return <LibraryView userEmail={user?.email ?? null} />;
}

function LibraryView({ userEmail }: { userEmail: string | null }) {
  const listFn = useServerFn(listSavedExpressions);
  const deleteFn = useServerFn(deleteSavedExpression);
  const listVideosFn = useServerFn(listSavedVideos);
  const deleteVideoFn = useServerFn(deleteSavedVideo);
  const logEventFn = useServerFn(logLibraryEvent);
  const qc = useQueryClient();
  const [browserId, setBrowserId] = useState("");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<"videos" | "sentences" | "words">("videos");

  useEffect(() => {
    setBrowserId(getBrowserId());
  }, []);

  const openedRef = useRef(false);
  useEffect(() => {
    if (!browserId || openedRef.current) return;
    openedRef.current = true;
    track("library_opened", { session_id: browserId });
    void logEventFn({ data: { eventName: "library_opened", sessionId: browserId } }).catch(() => {});
  }, [browserId, logEventFn]);

  const { data, isLoading } = useQuery({
    queryKey: ["saved-expressions"],
    queryFn: () => listFn(),
  });

  const { data: videosData, isLoading: videosLoading } = useQuery({
    queryKey: ["saved-videos"],
    queryFn: () => listVideosFn(),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: (_res, id) => {
      track("expression_removed", { expression_id: id });
      if (activeId === id) setActiveId(null);
      qc.invalidateQueries({ queryKey: ["saved-expressions"] });
    },
  });

  const removeVideoMutation = useMutation({
    mutationFn: (id: string) => deleteVideoFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-videos"] }),
  });

  const allItems = data?.items ?? [];
  const videos = videosData?.items ?? [];

  const sentenceItems = useMemo(() => allItems.filter((it: any) => !isWordItem(it)), [allItems]);
  const wordItems = useMemo(() => allItems.filter((it: any) => isWordItem(it)), [allItems]);

  function matchQuery(it: any, q: string) {
    return [it.sentence_text, it.translation, it.meaning, it.expression_notes, it.video_title]
      .filter(Boolean)
      .some((v: string) => v.toLowerCase().includes(q));
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sentenceItems;
    return sentenceItems.filter((it: any) => matchQuery(it, q));
  }, [sentenceItems, query]);

  const filteredWords = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return wordItems;
    return wordItems.filter((it: any) => matchQuery(it, q));
  }, [wordItems, query]);

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((v: any) =>
      [v.video_title, v.video_id].filter(Boolean).some((s: string) => s.toLowerCase().includes(q)),
    );
  }, [videos, query]);

  function watchAgain(item: any) {
    const vid = extractVideoId(item);
    track("watch_again_clicked", {
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

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
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
            <Bookmark className="h-4 w-4 text-primary" /> My Library
          </h1>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            title={userEmail ?? "Sign out"}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library…"
            className="pl-9"
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "videos" | "sentences" | "words")}>
          <TabsList className="mb-5">
            <TabsTrigger value="videos">
              Videos{videos.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({videos.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="sentences">
              Sentences{sentenceItems.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({sentenceItems.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="words">
              Words{wordItems.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({wordItems.length})</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videos">
            {videosLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your videos…
              </div>
            ) : filteredVideos.length === 0 ? (
              <EmptyState
                title={videos.length === 0 ? "No saved videos yet" : "No matches"}
                body={
                  videos.length === 0
                    ? "Paste a YouTube link on the home page and tap “Save video” to keep it here."
                    : "Try a different search term."
                }
              />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVideos.map((v: any) => (
                  <li key={v.id} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <a
                      href={`/?url=${encodeURIComponent(v.video_url)}`}
                      className="block"
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-muted">
                        <img
                          src={v.thumbnail_url ?? `https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`}
                          alt={v.video_title ?? "YouTube thumbnail"}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                          <div className="rounded-full bg-white/95 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                            <Play className="h-5 w-5 text-foreground" />
                          </div>
                        </div>
                      </div>
                    </a>
                    <div className="flex items-start justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium text-foreground">
                          {v.video_title ?? "Untitled video"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Saved {new Date(v.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => removeVideoMutation.mutate(v.id)}
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove from library"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="sentences">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your expressions…
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={items.length === 0 ? "No saved expressions yet" : "No matches"}
                body={
                  items.length === 0
                    ? "Highlight any text in a transcript, or tap ★ Save on an explanation to bookmark it here."
                    : "Try a different search term."
                }
              />
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
                        (isActive ? "border-primary/40 sm:col-span-2" : "border-border")
                      }
                    >
                      <div className={isActive ? "grid gap-4 md:grid-cols-2" : "contents"}>
                        {isActive && (
                          <div className="order-first md:order-last">
                            <EmbeddedPlayer item={item} videoId={vid!} onClose={closeVideo} />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <p className="text-lg font-semibold leading-snug text-foreground">{item.sentence_text}</p>
                          {item.translation && (
                            <p className="mt-2 text-sm text-foreground/85">{item.translation}</p>
                          )}
                          <div className="mt-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Source</p>
                            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground/90">
                              <Film className="h-3.5 w-3.5 shrink-0 text-primary" />
                              <span className="truncate">{item.video_title ?? "Untitled video"}</span>
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Saved at {fmtTime(item.timestamp_seconds ?? 0)}
                              {item.created_at && (<> · {new Date(item.created_at).toLocaleDateString()}</>)}
                            </p>
                          </div>
                          {(item.meaning || (item.expression_notes && item.expression_notes !== "—")) && (
                            <div className="mt-3 space-y-2 border-t border-border pt-3">
                              {item.meaning && (
                                <p className="text-xs text-foreground/80">
                                  <span className="font-semibold text-foreground/70">Meaning:</span> {item.meaning}
                                </p>
                              )}
                              {item.expression_notes && item.expression_notes !== "—" && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-semibold text-foreground/70">Notes:</span> {item.expression_notes}
                                </p>
                              )}
                            </div>
                          )}
                          <div className="mt-4 flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {isActive ? (
                                <Button size="sm" variant="outline" onClick={closeVideo} className="gap-1.5">
                                  <X className="h-3.5 w-3.5" /> Close video
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => watchAgain(item)}
                                  disabled={!vid}
                                  className="gap-1.5"
                                  title="Play this saved moment"
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
          </TabsContent>
        </Tabs>
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
  const start = Math.max(0, Math.floor(item.timestamp_seconds ?? 0));
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
        <p className="truncate text-xs text-muted-foreground">From {fmtTime(start)}</p>
        <Button size="sm" variant="ghost" onClick={onClose} className="h-7 gap-1 px-2 text-xs">
          <X className="h-3.5 w-3.5" /> Close video
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bookmark className="h-6 w-6" />
      </div>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <Link
        to="/"
        className="mt-5 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Browse videos
      </Link>
    </div>
  );
}
