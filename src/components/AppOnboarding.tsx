import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Link2,
  MousePointerClick,
  BookOpen,
  Target,
  Search,
  Loader2,
  Play,
  Sparkles,
  Star,
  ArrowRight,
  History,
  Clock,
} from "lucide-react";
import youtubeIcon from "@/assets/youtube-icon.png.asset.json";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  searchYouTube,
  type YouTubeSearchResult,
} from "@/lib/youtube-search.functions";

type PickFn = (url: string, language?: string) => void;

const DUTCH_RECOMMENDED: YouTubeSearchResult[] = [
  {
    videoId: "Lim8683TbuU",
    url: "https://www.youtube.com/watch?v=Lim8683TbuU",
    title: "Zondag met Lubach",
    channel: "VPRO",
    thumbnail: "https://i.ytimg.com/vi/Lim8683TbuU/hqdefault.jpg",
    durationSec: null,
    language: "nl",
  },
  {
    videoId: "Bt7J9fJvJ5Y",
    url: "https://www.youtube.com/watch?v=Bt7J9fJvJ5Y",
    title: "NOS Jeugdjournaal",
    channel: "NOS",
    thumbnail: "https://i.ytimg.com/vi/Bt7J9fJvJ5Y/hqdefault.jpg",
    durationSec: null,
    language: "nl",
  },
  {
    videoId: "rTMJP9Um8Bs",
    url: "https://www.youtube.com/watch?v=rTMJP9Um8Bs",
    title: "Easy Dutch",
    channel: "Easy Languages",
    thumbnail: "https://i.ytimg.com/vi/rTMJP9Um8Bs/hqdefault.jpg",
    durationSec: null,
    language: "nl",
  },
  {
    videoId: "hLLMgVTeWXM",
    url: "https://www.youtube.com/watch?v=hLLMgVTeWXM",
    title: "Op1 — Highlights",
    channel: "NPO",
    thumbnail: "https://i.ytimg.com/vi/hLLMgVTeWXM/hqdefault.jpg",
    durationSec: null,
    language: "nl",
  },
];

const STEPS = [
  {
    icon: Link2,
    title: "Paste a YouTube link",
    desc: "Paste or search for a Dutch YouTube video.",
  },
  {
    icon: MousePointerClick,
    title: "Click any subtitle",
    desc: "Click a subtitle while watching.",
  },
  {
    icon: BookOpen,
    title: "Get instant explanations",
    desc: "Understand meaning, expressions and context.",
  },
  {
    icon: Target,
    title: "Keep watching",
    desc: "Stay immersed without constantly pausing.",
  },
];

function StepperDesktop() {
  return (
    <div className="mx-auto mt-3 hidden max-w-3xl sm:block">
      <ol className="grid grid-cols-4 gap-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.title} className="relative flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-3 py-2.5 text-center">
              <div className="relative shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/8 text-primary ring-1 ring-primary/15">
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </div>
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                  {i + 1}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight text-foreground">{s.title}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{s.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepperMobile() {
  return (
    <ol className="mt-4 flex items-center justify-between gap-1 sm:hidden">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        return (
          <li key={s.title} className="flex flex-1 items-center gap-1">
            <div className="flex min-w-0 flex-col items-center gap-1 text-center">
              <div className="relative">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                </div>
                <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] font-semibold text-primary-foreground">
                  {i + 1}
                </span>
              </div>
              <p className="line-clamp-1 text-[10px] font-medium leading-tight text-muted-foreground">
                {s.title.replace("Get instant explanations", "Get explanations").replace("Paste a YouTube link", "Paste link")}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mb-4 h-px flex-1 bg-border" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}


function RecommendedCard({
  item,
  onPick,
  loading,
}: {
  item: YouTubeSearchResult;
  onPick: PickFn;
  loading?: boolean;
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <button
        type="button"
        onClick={() => onPick(item.url, item.language)}
        disabled={loading}
        className="relative block aspect-video w-full overflow-hidden bg-muted text-left"
      >
        <img
          src={item.thumbnail}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-[1.03]"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/25">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-lg">
            <Play className="ml-0.5 h-5 w-5 text-primary" fill="currentColor" />
          </span>
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-semibold text-foreground">{item.title}</p>
        <p className="text-xs text-muted-foreground">{item.channel}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => onPick(item.url, item.language)}
          className="mt-auto hidden h-8 rounded-full text-xs font-medium text-primary hover:bg-primary/5 sm:inline-flex"
        >
          <Play className="mr-1 h-3 w-3" fill="currentColor" /> Try now
        </Button>
      </div>
    </div>
  );
}

type SavedVideo = {
  id?: string;
  video_id: string;
  video_url: string;
  video_title?: string | null;
  thumbnail_url?: string | null;
  target_language?: string | null;
  created_at?: string;
};

type LastVideo = {
  videoId: string;
  videoTitle: string | null;
  url: string;
  targetLang: string | null;
  thumbnail?: string;
  ts: number;
};

const SEARCH_STATE_KEY = "nativeflow_hub_search";
const LAST_VIDEO_KEY = "nativeflow_last_video";
const RECENT_SEARCHES_KEY = "nativeflow_recent_searches";

export function AppOnboarding({
  onPick,
  loading,
  targetLang,
  setTargetLang,
  savedVideos = [],
  isAuthenticated = false,
}: {
  onPick: PickFn;
  loading?: boolean;
  targetLang: string;
  setTargetLang: (l: string) => void;
  savedVideos?: SavedVideo[];
  isAuthenticated?: boolean;
}) {
  // Restore any previously-entered search query so returning to the Hub
  // from a video keeps the user's search context.
  const [q, setQ] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return sessionStorage.getItem(SEARCH_STATE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [results, setResults] = useState<YouTubeSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const search = useServerFn(searchYouTube);
  const reqIdRef = useRef(0);

  // Continue-watching pointer from sessionStorage (last video the user opened).
  const [lastVideo, setLastVideo] = useState<LastVideo | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(LAST_VIDEO_KEY);
      return raw ? (JSON.parse(raw) as LastVideo) : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    // Refresh on focus in case the user came back from a watch view.
    function refresh() {
      try {
        const raw = sessionStorage.getItem(LAST_VIDEO_KEY);
        setLastVideo(raw ? (JSON.parse(raw) as LastVideo) : null);
      } catch {}
    }
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  // Recent searches (local, small).
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
    } catch {
      return [];
    }
  });
  function recordSearch(term: string) {
    const t = term.trim();
    if (!t) return;
    setRecentSearches((prev) => {
      const next = [t, ...prev.filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  // Persist query so navigation away/back preserves it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (q) sessionStorage.setItem(SEARCH_STATE_KEY, q);
      else sessionStorage.removeItem(SEARCH_STATE_KEY);
    } catch {}
  }, [q]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      setSearching(false);
      return;
    }
    // If it looks like a URL, don't search — let user press the button to load.
    if (/^https?:\/\//i.test(term) || /youtu\.?be/i.test(term)) {
      setResults(null);
      return;
    }
    const myId = ++reqIdRef.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await search({ data: { q: term } });
        if (myId !== reqIdRef.current) return;
        setResults(res.results);
        recordSearch(term);
      } catch {
        if (myId !== reqIdRef.current) return;
        setResults([]);
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
    if (/^https?:\/\//i.test(term) || /youtu\.?be/i.test(term)) {
      onPick(term);
    }
  }

  const visibleRecommended = showAll
    ? DUTCH_RECOMMENDED
    : DUTCH_RECOMMENDED.slice(0, 4);

  return (
    <section className="relative">
      {/* Subtle blue radial backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 0%, color-mix(in oklab, var(--primary) 12%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-5xl px-5 pt-4 pb-20 sm:pt-10">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
            Start learning from any{" "}
            <span className="text-primary">Dutch YouTube</span> video
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-snug text-muted-foreground sm:mt-3 sm:text-lg">
            Paste a YouTube link or search for a Dutch video to turn it into an
            interactive lesson.
          </p>
        </div>


        {/* Stepper — desktop above search */}
        <StepperDesktop />

        {/* Primary action — search box (dominant on mobile) */}
        <form
          onSubmit={submit}
          className="mx-auto mt-5 max-w-3xl rounded-2xl border border-border/60 bg-card p-3 shadow-md sm:mt-6 sm:p-4"
        >

          <div className="flex items-stretch gap-2 sm:gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted sm:h-14 sm:w-14">
              <img src={youtubeIcon.url} alt="YouTube" className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="relative flex-1">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Paste a Dutch YouTube URL..."
                className="h-12 w-full rounded-xl border-border bg-background pl-3 pr-10 text-[15px] sm:h-14 sm:pl-4"
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
              aria-label="Search"
              className="h-12 w-12 shrink-0 rounded-xl sm:h-14 sm:w-14"
            >
              {loading || searching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="mt-2.5 text-center text-xs text-muted-foreground">
            or search by title
          </p>


          {/* Explanation language — compact inline selector */}
          <div className="mt-3 flex items-center justify-center gap-2 sm:mt-4">
            <span className="text-xs text-muted-foreground">Explain in</span>
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger className="h-8 w-auto min-w-[120px] rounded-lg border-border bg-background px-3 text-xs sm:h-9 sm:min-w-[140px]">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {[
                  "English","Dutch","Spanish","French","German","Italian","Portuguese",
                  "Japanese","Chinese","Korean","Russian","Arabic","Turkish","Polish",
                  "Swedish","Norwegian","Danish","Finnish","Hindi","Indonesian",
                  "Vietnamese","Thai","Greek","Czech","Persian",
                ].map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </form>

        {/* Stepper — mobile below search, supports rather than competes */}
        <div className="mx-auto max-w-3xl">
          <StepperMobile />
        </div>

        {/* Learning Hub sections — shown when the user isn't actively searching. */}
        {!q.trim() && (lastVideo || savedVideos.length > 0 || recentSearches.length > 0) && (
          <div className="mx-auto mt-8 max-w-5xl space-y-8">
            {/* Continue watching */}
            {lastVideo && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground sm:text-base">
                  <Play className="h-4 w-4 text-primary" fill="currentColor" />
                  Continue watching
                </h2>
                <button
                  type="button"
                  onClick={() => onPick(lastVideo.url, lastVideo.targetLang ?? undefined)}
                  disabled={loading}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3 text-left transition hover:bg-primary/10"
                >
                  <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-xl bg-muted">
                    <img
                      src={lastVideo.thumbnail ?? `https://i.ytimg.com/vi/${lastVideo.videoId}/hqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-lg">
                        <Play className="ml-0.5 h-4 w-4 text-primary" fill="currentColor" />
                      </span>
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">
                      {lastVideo.videoTitle || "Last watched video"}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      Resume <ArrowRight className="h-3 w-3" />
                    </p>
                  </div>
                </button>
              </section>
            )}

            {/* Recently watched (from saved videos) */}
            {isAuthenticated && savedVideos.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground sm:text-base">
                  <History className="h-4 w-4 text-primary" />
                  Recently watched
                </h2>
                <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 sm:gap-4 lg:grid-cols-4">
                  {savedVideos
                    .filter((v) => v.video_id !== lastVideo?.videoId)
                    .slice(0, 8)
                    .map((v) => (
                      <div key={v.video_id} className="w-[62%] shrink-0 snap-start sm:w-auto">
                        <RecommendedCard
                          item={{
                            videoId: v.video_id,
                            url: v.video_url,
                            title: v.video_title || v.video_id,
                            channel: "",
                            thumbnail: v.thumbnail_url || `https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`,
                            durationSec: null,
                            language: v.target_language ?? null,
                          }}
                          onPick={onPick}
                          loading={loading}
                        />
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground sm:text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  Recent searches
                </h2>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setQ(s)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}


        {/* Search results */}
        {q.trim() && results && results.length > 0 && (
          <div className="mx-auto mt-6 grid max-w-3xl gap-2.5">
            {results.slice(0, 6).map((r) => (
              <button
                key={r.videoId}
                type="button"
                onClick={() => onPick(r.url, r.language)}
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
                    <Sparkles className="h-3 w-3" /> Analyze with NativeFlow
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Recommended Dutch videos */}
        {!q.trim() && (
          <div className="mt-12">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground sm:text-base">
                <Star className="h-4 w-4 text-primary" fill="currentColor" />
                Recommended first videos
              </h2>
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {showAll ? "Show less" : "View more examples"}
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {/* Mobile: single horizontal-scroll row. Desktop/tablet: grid. */}
            <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 sm:gap-4 lg:grid-cols-4">
              {visibleRecommended.map((r) => (
                <div key={r.videoId} className="w-[62%] shrink-0 snap-start sm:w-auto">
                  <RecommendedCard item={r} onPick={onPick} loading={loading} />
                </div>
              ))}
            </div>

          </div>
        )}

      </div>
    </section>
  );
}
