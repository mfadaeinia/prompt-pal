import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTranscript, type TranscriptSentence } from "@/lib/transcript.functions";
import { explainSentence } from "@/lib/explain.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, X } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lingua — understand native videos, one sentence at a time" },
      {
        name: "description",
        content:
          "Paste a YouTube link. Tap any sentence in the transcript to get a quick, plain explanation in your language.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const fetchTx = useServerFn(fetchTranscript);
  const explainFx = useServerFn(explainSentence);

  const [url, setUrl] = useState("");
  const [targetLang, setTargetLang] = useState("English");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [sentences, setSentences] = useState<TranscriptSentence[]>([]);
  const [selected, setSelected] = useState<TranscriptSentence | null>(null);

  const loadMutation = useMutation({
    mutationFn: async (u: string) => fetchTx({ data: { url: u } }),
    onSuccess: (res) => {
      setVideoId(res.videoId);
      setSentences(res.sentences);
      setSelected(null);
    },
  });

  const explainMutation = useMutation({
    mutationFn: async (s: TranscriptSentence) => {
      const idx = sentences.findIndex((x) => x.id === s.id);
      const ctx = sentences
        .slice(Math.max(0, idx - 1), Math.min(sentences.length, idx + 2))
        .map((x) => x.text)
        .join(" ");
      return explainFx({
        data: { sentence: s.text, context: ctx, targetLanguage: targetLang },
      });
    },
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const embedSrc = useMemo(
    () =>
      videoId
        ? `https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0`
        : null,
    [videoId]
  );

  // Load YT IFrame API and create player
  useEffect(() => {
    if (!videoId || !iframeRef.current) return;
    let cancelled = false;
    let pollId: number | null = null;

    const ensureApi = () =>
      new Promise<any>((resolve) => {
        const w = window as any;
        if (w.YT && w.YT.Player) return resolve(w.YT);
        const prev = w.onYouTubeIframeAPIReady;
        w.onYouTubeIframeAPIReady = () => {
          prev?.();
          resolve(w.YT);
        };
        if (!document.getElementById("yt-iframe-api")) {
          const tag = document.createElement("script");
          tag.id = "yt-iframe-api";
          tag.src = "https://www.youtube.com/iframe_api";
          document.body.appendChild(tag);
        }
      });

    ensureApi().then((YT) => {
      if (cancelled || !iframeRef.current) return;
      playerRef.current = new YT.Player(iframeRef.current, {
        events: {
          onReady: () => {
            pollId = window.setInterval(() => {
              const p = playerRef.current;
              if (p && typeof p.getCurrentTime === "function") {
                setCurrentTime(p.getCurrentTime() || 0);
              }
            }, 250);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
    };
  }, [videoId]);

  const playingId = useMemo(() => {
    if (!sentences.length) return null;
    // find last sentence whose offset <= currentTime
    let found: TranscriptSentence | null = null;
    for (const s of sentences) {
      if (s.offset <= currentTime + 0.05) found = s;
      else break;
    }
    return found?.id ?? null;
  }, [currentTime, sentences]);

  // Auto-scroll active sentence into view
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (!playingId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-sid="${playingId}"]`
    );
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [playingId]);

  function jumpTo(s: TranscriptSentence) {
    setSelected(s);
    explainMutation.reset();
    explainMutation.mutate(s);
    const p = playerRef.current;
    if (p?.seekTo) {
      p.seekTo(Math.max(0, Math.floor(s.offset)), true);
      p.playVideo?.();
    }
  }


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">Lingua</h1>
              <p className="text-xs text-muted-foreground">
                Tap any sentence. Get the gist.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-muted px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            prototype
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) loadMutation.mutate(url.trim());
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube URL (e.g. https://youtu.be/...)"
            className="flex-1"
          />
          <Input
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            placeholder="Your language"
            className="sm:w-44"
          />
          <Button type="submit" disabled={loadMutation.isPending || !url.trim()}>
            {loadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
              </>
            ) : (
              "Load video"
            )}
          </Button>
        </form>
        {loadMutation.isError && (
          <p className="mt-2 text-sm text-destructive">
            {(loadMutation.error as Error).message}
          </p>
        )}

        {!videoId && !loadMutation.isPending && (
          <EmptyState />
        )}

        {videoId && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
                {embedSrc && (
                  <iframe
                    ref={iframeRef}
                    src={embedSrc}
                    title="YouTube video"
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>

              {selected && (
                <ExplanationPanel
                  sentence={selected}
                  loading={explainMutation.isPending}
                  error={
                    explainMutation.isError
                      ? (explainMutation.error as Error).message
                      : null
                  }
                  text={explainMutation.data?.explanation ?? null}
                  onClose={() => setSelected(null)}
                />
              )}
            </div>

            <aside className="flex max-h-[70vh] flex-col overflow-hidden rounded-lg border border-border">
              <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                Transcript · {sentences.length} sentences
              </div>
              <ol className="flex-1 overflow-y-auto">
                {sentences.map((s) => {
                  const active = selected?.id === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => jumpTo(s)}
                        className={`block w-full border-b border-border/60 px-3 py-2 text-left text-sm leading-relaxed transition hover:bg-accent ${
                          active ? "bg-accent" : ""
                        }`}
                      >
                        <span className="mr-2 text-[10px] tabular-nums text-muted-foreground">
                          {formatTime(s.offset)}
                        </span>
                        {s.text}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-lg border border-dashed border-border p-8 text-center">
      <p className="text-sm text-muted-foreground">
        Paste a YouTube URL to load the video and its transcript. Then click any
        sentence to get a quick explanation.
      </p>
    </div>
  );
}

function ExplanationPanel({
  sentence,
  loading,
  error,
  text,
  onClose,
}: {
  sentence: TranscriptSentence;
  loading: boolean;
  error: string | null;
  text: string | null;
  onClose: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Sentence
          </p>
          <p className="mt-1 text-sm font-medium">{sentence.text}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-accent"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 border-t border-border pt-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {text && (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {text}
          </pre>
        )}
      </div>
    </div>
  );
}

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
