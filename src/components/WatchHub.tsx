import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Clock,
  Library,
  Loader2,
  Play,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCuratedVideos } from "@/components/LibraryStrip";
import type { CuratedVideo } from "@/lib/curated-library.functions";
import { track } from "@/lib/analytics";
import { setContentEntryPath } from "@/lib/content-entry";
import {
  searchYouTube,
  type YouTubeSearchResult,
} from "@/lib/youtube-search.functions";

type PickFn = (url: string, language?: string) => void;

type LastVideo = {
  videoId: string;
  videoTitle: string | null;
  url: string;
  targetLang: string | null;
  thumbnail?: string;
  channel?: string;
  ts: number;
};


export const SEARCH_STATE_KEY = "nativeflow_hub_search";
const LAST_VIDEO_KEY = "nativeflow_last_video";
const RECENT_SEARCHES_KEY = "nativeflow_recent_searches";

export function looksLikeUrl(term: string) {
  return /^https?:\/\//i.test(term) || /youtu\.?be/i.test(term);
}

/**
 * The post-demo product destination ("Watch").
 *
 * One question: what do you want to watch? One primary input that accepts
 * either a search query or a YouTube URL, an optional Continue-watching card,
 * and a compact curated strip. History/recent-search UI is intentionally not
 * rendered here (data is still recorded and preserved).
 */
export function WatchHub({
  onPick,
  loading,
  targetLang,
  setTargetLang,
}: {
  onPick: PickFn;
  loading?: boolean;
  targetLang: string;
  setTargetLang: (l: string) => void;
}) {
  const [q, setQ] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return sessionStorage.getItem(SEARCH_STATE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [results, setResults] = useState<YouTubeSearchResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const search = useServerFn(searchYouTube);
  const reqIdRef = useRef(0);

  const [lastVideo, setLastVideo] = useState<LastVideo | null>(null);
  useEffect(() => {
    function refresh() {
      try {
        const raw = sessionStorage.getItem(LAST_VIDEO_KEY);
        setLastVideo(raw ? (JSON.parse(raw) as LastVideo) : null);
      } catch {}
    }
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  // Search history is still recorded (data preserved) — just not rendered.
  function recordSearch(term: string) {
    const t = term.trim();
    if (!t) return;
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      const prev: string[] = raw ? JSON.parse(raw) : [];
      const next = [t, ...prev.filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, 8);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {}
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (q) sessionStorage.setItem(SEARCH_STATE_KEY, q);
      else sessionStorage.removeItem(SEARCH_STATE_KEY);
    } catch {}
  }, [q]);

  useEffect(() => {
    const term = q.trim();
    if (!term || looksLikeUrl(term)) {
      setResults(null);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const myId = ++reqIdRef.current;
    setSearching(true);
    setSearchError(null);
    const t = setTimeout(async () => {
      try {
        const res = await search({ data: { q: term } });
        if (myId !== reqIdRef.current) return;
        setResults(res.results);
        if (res.results.length === 0)
          setSearchError(
            "No videos matched that search. Try different keywords, or paste a YouTube link.",
          );
        recordSearch(term);
        track("youtube_search_submitted", { query_length: term.length, results: res.results.length });
      } catch {
        if (myId !== reqIdRef.current) return;
        setResults([]);
        setSearchError(
          "Search is temporarily unavailable. You can still paste a YouTube link, or pick a curated video below.",
        );
      } finally {
        if (myId === reqIdRef.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, search]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    if (looksLikeUrl(term)) {
      setContentEntryPath("pasted_url", { url: term });
      track("own_video_url_submitted", { source: "watch_hub" });
      onPick(term);
    }
  }

  function resumeLast() {
    if (!lastVideo || loading) return;
    setContentEntryPath("continue_watching", { url: lastVideo.url });
    track("continue_watching_clicked", { video_id: lastVideo.videoId });
    onPick(lastVideo.url, lastVideo.targetLang ?? undefined);
  }


  return (
    <section className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 0%, color-mix(in oklab, var(--primary) 10%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-5xl px-5 pb-20 pt-6 sm:pt-12">
        <div className="text-center">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            What do you want to watch?
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
            Search Dutch YouTube or paste a video link.
          </p>
        </div>

        <form onSubmit={submit} className="mx-auto mt-6 max-w-2xl">
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search Dutch YouTube or paste a YouTube link"
                placeholder="Search Dutch YouTube or paste a link…"
                className="h-13 w-full rounded-xl border-border bg-card pl-11 pr-10 text-[15px] shadow-sm sm:h-14"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear"
                >
                  ×
                </button>
              )}
            </div>
            <Button
              type="submit"
              disabled={!q.trim() || loading}
              aria-label="Watch"
              className="h-13 w-13 shrink-0 rounded-xl sm:h-14 sm:w-14"
            >
              {loading || searching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowRight className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Secondary, non-competing preference. */}
          <div className="mt-2.5 flex items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">Explain in</span>
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger className="h-7 w-auto min-w-[104px] rounded-lg border-transparent bg-transparent px-2 text-xs text-muted-foreground hover:bg-muted">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {[
                  { value: "English", label: "English" },
                  { value: "Dutch", label: "Dutch (Nederlands)" },
                  { value: "Persian", label: "Persian (فارسی)" },
                ].map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </form>

        {/* Search results */}
        {q.trim() && !looksLikeUrl(q.trim()) && (
          <div className="mx-auto mt-6 max-w-2xl">
            {searching && (!results || results.length === 0) && (
              <p className="text-sm text-muted-foreground">Searching…</p>
            )}
            {!searching && searchError && (!results || results.length === 0) && (
              <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                {searchError}
              </p>
            )}
            {results && results.length > 0 && (
              <div className="grid gap-2.5">
                {results.slice(0, 6).map((r) => (
                  <button
                    key={r.videoId}
                    type="button"
                    onClick={() => {
                      setContentEntryPath("youtube_search", { url: r.url });
                      track("youtube_search_result_selected", { video_id: r.videoId });
                      onPick(r.url, r.language);
                    }}
                    disabled={loading}
                    className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition hover:border-primary/40 hover:bg-muted/40"
                  >
                    <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <img src={r.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1 py-1">
                      <p className="line-clamp-2 text-sm font-semibold text-foreground">{r.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.channel}</p>
                      <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                        <Sparkles className="h-3 w-3" /> Watch with NativeFlow
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Continue watching — only when there is genuinely resumable content */}
        {!q.trim() && lastVideo && (
          <section className="mx-auto mt-10 max-w-3xl">
            <div className="rounded-3xl border border-primary/25 bg-primary/[0.06] p-4 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
                <Clock className="h-4 w-4 text-primary" />
                Continue watching
              </h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <button
                  type="button"
                  onClick={resumeLast}
                  disabled={loading}
                  className="group relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl bg-muted sm:w-44"
                  aria-label="Resume last video"
                >
                  <img
                    src={
                      lastVideo.thumbnail ??
                      `https://i.ytimg.com/vi/${lastVideo.videoId}/hqdefault.jpg`
                    }
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/30">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-lg">
                      <Play className="ml-0.5 h-4 w-4 text-primary" fill="currentColor" />
                    </span>
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[15px] font-semibold text-foreground">
                    {lastVideo.videoTitle || "Last watched video"}
                  </p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {lastVideo.channel ?? "YouTube"}
                  </p>
                  <Button
                    type="button"
                    onClick={resumeLast}
                    disabled={loading}
                    className="mt-3 h-10 rounded-full px-5 text-sm font-semibold"
                  >
                    Resume <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Featured Dutch videos — a small, calm selection */}
        {!q.trim() && (
          <div className="mx-auto mt-12 max-w-5xl">
            <FeaturedDutchVideos
              loading={loading}
              onPick={(u, lang) => {
                setContentEntryPath("curated_library", { url: u });
                track("curated_video_selected", { source: "watch_hub" });
                onPick(u, lang);
              }}
            />
          </div>
        )}

      </div>
    </section>
  );
}
