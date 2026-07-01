import { useEffect, useRef, useState } from "react";
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
  Settings as SettingsIcon,
  Star,
  ArrowRight,
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
          className="mt-auto h-8 rounded-full text-xs font-medium text-primary hover:bg-primary/5"
        >
          <Play className="mr-1 h-3 w-3" fill="currentColor" /> Try now
        </Button>
      </div>
    </div>
  );
}

export function AppOnboarding({
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
  const [q, setQ] = useState("");
  const [results, setResults] = useState<YouTubeSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const search = useServerFn(searchYouTube);
  const reqIdRef = useRef(0);

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
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-5xl">
            Welcome to NativeFlow
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:mt-3 sm:text-lg">
            Turn any{" "}
            <span className="font-semibold text-primary">Dutch YouTube</span>{" "}
            video into an interactive lesson.
          </p>
        </div>

        {/* Stepper — desktop above search */}
        <StepperDesktop />

        {/* Primary action — search box (dominant on mobile) */}
        <form
          onSubmit={submit}
          className="mx-auto mt-4 max-w-3xl rounded-2xl border border-border/60 bg-card p-2 shadow-sm sm:mt-6 sm:p-4"
        >

          <div className="flex items-stretch gap-2 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted sm:h-14 sm:w-14">
              <img src={youtubeIcon.url} alt="YouTube" className="h-5 w-5 sm:h-7 sm:w-7" />
            </div>
            <div className="relative flex-1">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Paste a Dutch YouTube URL…"
                className="h-10 w-full rounded-lg border-border bg-background pl-3 pr-10 text-sm sm:h-14 sm:pl-4 sm:text-[15px]"
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
              className="h-10 w-10 shrink-0 rounded-lg sm:h-14 sm:w-14 sm:rounded-xl"
            >
              {loading || searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            or search by title
          </p>
        </form>

        {/* Stepper — mobile below search, supports rather than competes */}
        <div className="mx-auto max-w-3xl">
          <StepperMobile />
        </div>


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
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {visibleRecommended.map((r) => (
                <RecommendedCard key={r.videoId} item={r} onPick={onPick} loading={loading} />
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        <details className="group mx-auto mt-14 max-w-3xl rounded-2xl border border-border bg-card/60 px-5 py-3 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
            <span className="flex items-center gap-2 text-muted-foreground">
              <SettingsIcon className="h-4 w-4" />
              Settings
            </span>
            <span className="text-xs text-muted-foreground">
              Explanation language:{" "}
              <span className="font-semibold text-primary">{targetLang}</span>
            </span>
          </summary>
          <div className="mt-4 border-t border-border pt-4">
            <label
              htmlFor="onboarding-target-lang"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Explanation language
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Sentence explanations and translations will be shown in this language.
            </p>
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger
                id="onboarding-target-lang"
                className="mt-2 h-11 w-full rounded-xl bg-background px-4 sm:max-w-xs"
              >
                <SelectValue placeholder="Select language" />
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
        </details>
      </div>
    </section>
  );
}
