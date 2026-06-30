import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Play, Sparkles, Link2, AlertCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchYouTube, type YouTubeSearchResult } from "@/lib/youtube-search.functions";



// Curated Dutch-native examples — replaces the previous TED-talk popular row
// so first-time visitors immediately see that NativeFlow is for Dutch content.
const DUTCH_EXAMPLES: YouTubeSearchResult[] = [
  {
    videoId: "Bt7J9fJvJ5Y",
    url: "https://www.youtube.com/watch?v=Bt7J9fJvJ5Y",
    title: "Joost Klein over zijn wereldtour, The Voice en Europapa",
    channel: "NOS Jeugdjournaal",
    thumbnail: "https://i.ytimg.com/vi/Bt7J9fJvJ5Y/hqdefault.jpg",
    durationSec: 246,
    language: "nl",
  },
  {
    videoId: "yKKSoD9beaQ",
    url: "https://www.youtube.com/watch?v=yKKSoD9beaQ",
    title: "Onderzoekers weten het: 'Deze man verraadde Anne Frank'",
    channel: "NOS Jeugdjournaal",
    thumbnail: "https://i.ytimg.com/vi/yKKSoD9beaQ/hqdefault.jpg",
    durationSec: 283,
    language: "nl",
  },
  {
    videoId: "4ngmE-BV5sE",
    url: "https://www.youtube.com/watch?v=4ngmE-BV5sE",
    title: "Ninthe (11) is 1,70 meter en wordt nog veel langer",
    channel: "NOS Jeugdjournaal",
    thumbnail: "https://i.ytimg.com/vi/4ngmE-BV5sE/hqdefault.jpg",
    durationSec: 151,
    language: "nl",
  },
];

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/** Loose detector — if the input looks like it could be a YouTube link
 *  (any URL-ish string containing youtube/youtu.be), route it through the
 *  URL preview path instead of full-text search. */
function looksLikeYouTubeUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (/(^|\s)(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(s)) return true;
  return false;
}

function extractYouTubeId(input: string): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (VIDEO_ID_RE.test(raw)) return raw;
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const segs = u.pathname.split("/").filter(Boolean);
  const valid = (s: string | null | undefined) => (s && VIDEO_ID_RE.test(s) ? s : null);
  if (host === "youtu.be") return valid(segs[0] ?? null);
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    if (segs[0] === "watch") {
      const v = valid(u.searchParams.get("v"));
      if (v) return v;
    }
    if (["shorts", "embed", "live", "v"].includes(segs[0] ?? "")) {
      return valid(segs[1] ?? null);
    }
  }
  return null;
}

type UrlPreview = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
};

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}


function ResultCard({
  item,
  onPick,
  loading,
}: {
  item: YouTubeSearchResult;
  onPick: (url: string, language?: string) => void;
  loading?: boolean;
}) {
  const dur = formatDuration(item.durationSec);
  return (
    <button
      type="button"
      onClick={() => onPick(item.url, item.language)}
      disabled={loading}
      className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition hover:border-primary/40 hover:bg-muted/50 sm:p-3"
    >
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-muted sm:w-40">
        <img
          src={item.thumbnail}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
        />
        {dur && (
          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {dur}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
          <Play className="h-7 w-7 text-white opacity-0 transition group-hover:opacity-100" fill="currentColor" />
        </span>
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="line-clamp-2 text-sm font-semibold text-foreground sm:text-[15px]">
          {item.title}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{item.channel}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
          <Sparkles className="h-3 w-3" /> Analyze with NativeFlow
        </span>
      </div>
    </button>
  );
}

export function YouTubeDiscovery({
  onPick,
  loading,
}: {
  onPick: (url: string, language?: string) => void;
  loading?: boolean;
}) {
  
  const [q, setQ] = useState("");
  const [results, setResults] = useState<YouTubeSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URL-paste mode state
  const [urlMode, setUrlMode] = useState(false);
  const [urlPreview, setUrlPreview] = useState<UrlPreview | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const search = useServerFn(searchYouTube);
  const reqIdRef = useRef(0);
  const urlReqIdRef = useRef(0);

  useEffect(() => {
    const raw = q.trim();
    if (!raw) {
      setResults(null);
      setError(null);
      setSearching(false);
      setUrlMode(false);
      setUrlPreview(null);
      setUrlError(null);
      setUrlLoading(false);
      return;
    }

    // ---- URL-paste path ----
    if (looksLikeYouTubeUrl(raw)) {
      setUrlMode(true);
      setResults(null);
      setError(null);
      setSearching(false);

      const id = extractYouTubeId(raw);
      if (!id) {
        setUrlPreview(null);
        setUrlLoading(false);
        setUrlError("That doesn't look like a valid YouTube link.");
        return;
      }

      const myId = ++urlReqIdRef.current;
      setUrlError(null);
      setUrlLoading(true);
      setUrlPreview(null);

      (async () => {
        try {
          const r = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(
              `https://www.youtube.com/watch?v=${id}`,
            )}&format=json`,
          );
          if (myId !== urlReqIdRef.current) return;
          if (!r.ok) {
            setUrlPreview({
              videoId: id,
              title: "YouTube video",
              channel: "",
              thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            });
            setUrlLoading(false);
            return;
          }
          const json = (await r.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
          if (myId !== urlReqIdRef.current) return;
          setUrlPreview({
            videoId: id,
            title: json.title ?? "YouTube video",
            channel: json.author_name ?? "",
            thumbnail: json.thumbnail_url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          });
          setUrlLoading(false);
        } catch {
          if (myId !== urlReqIdRef.current) return;
          setUrlPreview({
            videoId: id,
            title: "YouTube video",
            channel: "",
            thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          });
          setUrlLoading(false);
        }
      })();
      return;
    }

    // ---- Search path ----
    setUrlMode(false);
    setUrlPreview(null);
    setUrlError(null);
    setUrlLoading(false);

    const myId = ++reqIdRef.current;
    setSearching(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const res = await search({ data: { q: raw } });
        if (myId !== reqIdRef.current) return;
        setResults(res.results);
        if (res.results.length === 0) setError("No results. Try different keywords.");
      } catch {
        if (myId !== reqIdRef.current) return;
        setError("Search is temporarily unavailable. Try an example below.");
        setResults([]);
      } finally {
        if (myId === reqIdRef.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, search]);

  const showExamples = q.trim().length === 0;

  return (
    <div className="space-y-4">
      <form
        className="flex items-stretch gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          // If URL preview is ready, pressing Enter analyzes it.
          if (urlMode && urlPreview && !loading) {
            onPick(`https://www.youtube.com/watch?v=${urlPreview.videoId}`, "nl");
            return;
          }
          (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.blur();
        }}
      >
        <div className="relative flex-1">
          {urlMode ? (
            <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          ) : (
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Paste a YouTube link, or search…"
            className="h-12 w-full rounded-xl bg-background pl-11 pr-11 text-base"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
          />
          {(searching || urlLoading) && (
            <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          {!searching && !urlLoading && q && (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          type="submit"
          disabled={!q.trim() || searching || loading || (urlMode && !urlPreview)}
          className="h-12 rounded-xl px-4"
        >
          {urlMode ? (
            <>
              <Sparkles className="mr-1.5 h-4 w-4" />
              Analyze
            </>
          ) : (
            <>
              <Search className="mr-1.5 h-4 w-4" />
              Search
            </>
          )}
        </Button>
      </form>

      {/* URL paste — preview / error */}
      {urlMode && (
        <div>
          {urlError && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{urlError}</span>
            </div>
          )}
          {!urlError && urlPreview && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                Ready to analyze
              </p>
              <div className="flex items-start gap-3">
                <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-muted sm:w-40">
                  <img
                    src={urlPreview.thumbnail}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-foreground sm:text-[15px]">
                    {urlPreview.title}
                  </p>
                  {urlPreview.channel && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {urlPreview.channel}
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={loading}
                    onClick={() =>
                      onPick(`https://www.youtube.com/watch?v=${urlPreview.videoId}`)
                    }
                    className="mt-2 h-8 rounded-full px-3 text-xs"
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    {loading ? "Loading…" : "Analyze this video"}
                  </Button>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    If the video has no subtitles or captions we can't transcribe yet,
                    we'll let you know on the next screen.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!urlMode && !showExamples && (
        <div className="space-y-2">
          {searching && (!results || results.length === 0) && (
            <p className="text-sm text-muted-foreground">Searching…</p>
          )}
          {error && !searching && (
            <p className="text-sm text-muted-foreground">{error}</p>
          )}
          {results && results.length > 0 && (
            <div className="grid gap-2.5">
              {results.map((r) => (
                <ResultCard key={r.videoId} item={r} onPick={onPick} loading={loading} />
              ))}
            </div>
          )}
        </div>
      )}

      {showExamples && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Try an example 🇳🇱</h3>
            <span className="text-xs text-muted-foreground">
              Dutch samples — or paste your own above
            </span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {DUTCH_EXAMPLES.map((r) => (
              <div
                key={r.videoId}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-2.5 transition hover:border-primary/40"
              >
                <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-muted sm:w-32">
                  <img
                    src={r.thumbnail}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-foreground">
                    {r.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {r.channel}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => onPick(r.url, r.language)}
                    className="mt-2 h-7 rounded-full px-3 text-xs"
                  >
                    <Sparkles className="mr-1 h-3 w-3" /> Try this example
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
