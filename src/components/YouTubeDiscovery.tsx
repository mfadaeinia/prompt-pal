import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Play, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchYouTube, type YouTubeSearchResult } from "@/lib/youtube-search.functions";

type Platform = "youtube" | "spotify" | "netflix";

const POPULAR_EXAMPLES: YouTubeSearchResult[] = [
  {
    videoId: "8jPQjjsBbIc",
    url: "https://www.youtube.com/watch?v=8jPQjjsBbIc",
    title: "Inside the mind of a master procrastinator | Tim Urban",
    channel: "TED",
    thumbnail: "https://i.ytimg.com/vi/8jPQjjsBbIc/hqdefault.jpg",
    durationSec: 853,
    language: "en",
  },
  {
    videoId: "ZSt9tm3RoUU",
    url: "https://www.youtube.com/watch?v=ZSt9tm3RoUU",
    title: "Steve Jobs' 2005 Stanford Commencement Address",
    channel: "Stanford",
    thumbnail: "https://i.ytimg.com/vi/ZSt9tm3RoUU/hqdefault.jpg",
    durationSec: 902,
    language: "en",
  },
  {
    videoId: "Ks-_Mh1QhMc",
    url: "https://www.youtube.com/watch?v=Ks-_Mh1QhMc",
    title: "Your body language may shape who you are | Amy Cuddy",
    channel: "TED",
    thumbnail: "https://i.ytimg.com/vi/Ks-_Mh1QhMc/hqdefault.jpg",
    durationSec: 1262,
    language: "en",
  },
  {
    videoId: "5MgBikgcWnY",
    url: "https://www.youtube.com/watch?v=5MgBikgcWnY",
    title: "The first 20 hours — how to learn anything | Josh Kaufman",
    channel: "TEDx Talks",
    thumbnail: "https://i.ytimg.com/vi/5MgBikgcWnY/hqdefault.jpg",
    durationSec: 1163,
    language: "en",
  },
];

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
  {
    videoId: "isimFyR9MnI",
    url: "https://www.youtube.com/watch?v=isimFyR9MnI",
    title: "Lina is 12 en zit nu al op de universiteit",
    channel: "NOS Jeugdjournaal",
    thumbnail: "https://i.ytimg.com/vi/isimFyR9MnI/hqdefault.jpg",
    durationSec: 82,
    language: "nl",
  },
  {
    videoId: "W3Pu2RuTZ8A",
    url: "https://www.youtube.com/watch?v=W3Pu2RuTZ8A",
    title: "Oeps! Dit is de grappigste taalvout van het jaar",
    channel: "NOS Jeugdjournaal",
    thumbnail: "https://i.ytimg.com/vi/W3Pu2RuTZ8A/hqdefault.jpg",
    durationSec: 99,
    language: "nl",
  },
];

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function PlatformTabs({
  value,
  onChange,
}: {
  value: Platform;
  onChange: (p: Platform) => void;
}) {
  const tabs: { id: Platform; label: string; soon?: boolean }[] = [
    { id: "youtube", label: "YouTube" },
    { id: "spotify", label: "Spotify", soon: true },
    { id: "netflix", label: "Netflix", soon: true },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = value === t.id;
        const disabled = !!t.soon;
        return (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(t.id)}
            className={[
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-foreground hover:bg-muted",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            {t.label}
            {t.soon && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Soon
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
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
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<YouTubeSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const search = useServerFn(searchYouTube);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      setError(null);
      setSearching(false);
      return;
    }
    const myId = ++reqIdRef.current;
    setSearching(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const res = await search({ data: { q: term } });
        if (myId !== reqIdRef.current) return;
        setResults(res.results);
        if (res.results.length === 0) setError("No results. Try different keywords.");
      } catch {
        if (myId !== reqIdRef.current) return;
        setError("Search is temporarily unavailable. Try a popular example below.");
        setResults([]);
      } finally {
        if (myId === reqIdRef.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, search]);

  const showExamples = false;

  return (
    <div className="space-y-4">
      <PlatformTabs value={platform} onChange={setPlatform} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search any YouTube video…"
          className="h-12 w-full rounded-xl bg-background pl-11 pr-11 text-base"
          inputMode="search"
          autoComplete="off"
        />
        {searching && (
          <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {!showExamples && (
        <div className="space-y-2">
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
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Popular examples</h3>
              <span className="text-xs text-muted-foreground">Tap to analyze instantly</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {POPULAR_EXAMPLES.map((r) => (
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
                      <Sparkles className="mr-1 h-3 w-3" /> Try now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Learn Dutch 🇳🇱</h3>
              <span className="text-xs text-muted-foreground">NPO / Jeugdjournaal</span>
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
                      <Sparkles className="mr-1 h-3 w-3" /> Try now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
