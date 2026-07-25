import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, Sparkles, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTodayFeed, type DutchMediaItem } from "@/lib/dutch-media.functions";

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const CATEGORY_LABEL: Record<DutchMediaItem["category"], string> = {
  top_story: "Top story",
  trending: "Trending",
  culture: "Culture",
  expat: "For expats",
};

function LevelChip({ level }: { level: string | null }) {
  if (!level) return null;
  return (
    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
      {level}
    </span>
  );
}

function HeroCard({
  item,
  onPick,
  loading,
}: {
  item: DutchMediaItem;
  onPick: (url: string, language?: string) => void;
  loading?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="grid gap-0 md:grid-cols-5">
        <button
          type="button"
          onClick={() => onPick(item.source_url, item.language)}
          className="group relative col-span-3 aspect-video w-full overflow-hidden bg-muted"
          disabled={loading}
        >
          <img
            src={item.thumbnail_url}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="eager"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/30">
            <span className="rounded-full bg-white/95 p-4 shadow-lg">
              <Play className="h-6 w-6 text-primary" fill="currentColor" />
            </span>
          </span>
          {item.duration_sec ? (
            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {formatDuration(item.duration_sec)}
            </span>
          ) : null}
        </button>
        <div className="col-span-2 flex flex-col justify-center gap-3 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-foreground/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background">
              Today's top story
            </span>
            <LevelChip level={item.difficulty} />
          </div>
          <h2 className="text-xl font-bold leading-tight text-foreground md:text-2xl">
            {item.title}
          </h2>
          {item.short_english_summary && (
            <p className="text-sm text-muted-foreground">{item.short_english_summary}</p>
          )}
          {item.why_it_matters && (
            <p className="text-xs italic text-muted-foreground">
              Why it matters: {item.why_it_matters}
            </p>
          )}
          <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
            <span className="font-medium">{item.source}</span>
          </div>
          <Button
            onClick={() => onPick(item.source_url, item.language)}
            disabled={loading}
            className="mt-2 w-full rounded-full sm:w-auto"
          >
            <Sparkles className="mr-1.5 h-4 w-4" /> Watch & Learn
          </Button>
        </div>
      </div>
    </article>
  );
}

function FeedCard({
  item,
  onPick,
  loading,
}: {
  item: DutchMediaItem;
  onPick: (url: string, language?: string) => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(item.source_url, item.language)}
      disabled={loading}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition hover:border-primary/40 hover:shadow-md"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <img
          src={item.thumbnail_url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-[1.03]"
        />
        {item.duration_sec ? (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            <Clock className="mr-0.5 inline h-2.5 w-2.5" />
            {formatDuration(item.duration_sec)}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center gap-1.5">
          <LevelChip level={item.difficulty} />
          <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {item.source}
          </span>
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {item.title}
        </h3>
        {item.short_english_summary && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {item.short_english_summary}
          </p>
        )}
        <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" /> Watch & Learn
        </span>
      </div>
    </button>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function TodayFeed({
  onPick,
  loading,
  onDiscover,
}: {
  onPick: (url: string, language?: string) => void;
  loading?: boolean;
  onDiscover: () => void;
}) {
  const fetchFeed = useServerFn(getTodayFeed);
  const { data, isLoading, error } = useQuery({
    queryKey: ["today-feed"],
    queryFn: () => fetchFeed(),
    staleTime: 5 * 60_000,
  });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-1 pb-16">
      <header className="space-y-2 pt-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {today} · Today in Dutch media
        </p>
        <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl md:text-4xl">
          What's happening in Dutch media today?
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          Discover what the Netherlands is watching, talking about and listening to — and
          understand the Dutch behind it.
        </p>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading today's feed…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Couldn't load today's feed. Try Discover to search a video directly.
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={onDiscover} className="rounded-full">
              Go to Discover
            </Button>
          </div>
        </div>
      )}

      {data && !data.topStory && data.trending.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          Today's feed is being curated. In the meantime, try Discover to search any Dutch video.
          <div className="mt-3">
            <Button size="sm" onClick={onDiscover} className="rounded-full">
              Open Discover
            </Button>
          </div>
        </div>
      )}

      {data?.topStory && (
        <HeroCard item={data.topStory} onPick={onPick} loading={loading} />
      )}

      {data && data.trending.length > 0 && (
        <Section title="Trending now" subtitle={CATEGORY_LABEL.trending}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.trending.map((item) => (
              <FeedCard key={item.id} item={item} onPick={onPick} loading={loading} />
            ))}
          </div>
        </Section>
      )}

      {data && data.culture.length > 0 && (
        <Section title="Culture & entertainment" subtitle="What Dutch people are watching">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.culture.map((item) => (
              <FeedCard key={item.id} item={item} onPick={onPick} loading={loading} />
            ))}
          </div>
        </Section>
      )}

      {data && data.expat.length > 0 && (
        <Section title="Good to know as an expat" subtitle="Context for daily life in NL">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.expat.map((item) => (
              <FeedCard key={item.id} item={item} onPick={onPick} loading={loading} />
            ))}
          </div>
        </Section>
      )}

      {data && (data.topStory || data.trending.length > 0) && (
        <div className="rounded-xl border border-border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Looking for something specific?
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 rounded-full"
            onClick={onDiscover}
          >
            <Sparkles className="mr-1.5 h-4 w-4" /> Search any Dutch video
          </Button>
        </div>
      )}
    </div>
  );
}
