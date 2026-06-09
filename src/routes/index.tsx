import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchTranscript,
  saveManualTranscript,
  type TranscriptSentence,
  type TranscriptSource,
} from "@/lib/transcript.functions";
import { explainSentence } from "@/lib/explain.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Repeat, Sparkles, X } from "lucide-react";
import { track, setUserProperties } from "@/lib/analytics";

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
  const saveManualTx = useServerFn(saveManualTranscript);
  const explainFx = useServerFn(explainSentence);

  const [url, setUrl] = useState("");
  const [targetLang, setTargetLang] = useState("English");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [sentences, setSentences] = useState<TranscriptSentence[]>([]);
  const [selected, setSelected] = useState<TranscriptSentence | null>(null);
  const [transcriptSource, setTranscriptSource] = useState<TranscriptSource | null>(null);
  const [manualText, setManualText] = useState("");

  const loadMutation = useMutation({
    mutationFn: async (u: string) => fetchTx({ data: { url: u } }),
    onSuccess: (res) => {
      setVideoId(res.videoId);
      setSentences(res.sentences);
      setSelected(null);
      setTranscriptSource(res.source);
      setUserProperties({ selected_language: targetLang });
      const evt =
        res.source === "cache"
          ? "transcript_loaded_from_cache"
          : "transcript_loaded_from_youtube";
      track(evt, {
        video_url: url,
        video_id: res.videoId,
        selected_language: targetLang,
      });
      track("video_loaded", {
        video_url: url,
        video_id: res.videoId,
        selected_language: targetLang,
        source: res.source,
      });
    },
    onError: (err: any) => {
      track("transcript_fetch_failed", {
        video_url: url,
        error_type: err?.errorType ?? "unknown",
        error_message: err?.message ?? String(err),
      });
    },
  });

  const manualMutation = useMutation({
    mutationFn: async (vars: { url: string; text: string }) =>
      saveManualTx({ data: vars }),
    onSuccess: (res) => {
      setVideoId(res.videoId);
      setSentences(res.sentences);
      setSelected(null);
      setTranscriptSource("manual");
      setManualText("");
      loadMutation.reset();
      setUserProperties({ selected_language: targetLang });
      track("transcript_loaded_manually", {
        video_url: url,
        video_id: res.videoId,
        sentences_count: res.sentences.length,
      });
      track("video_loaded", {
        video_url: url,
        video_id: res.videoId,
        selected_language: targetLang,
        source: "manual",
      });
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
          onStateChange: (e: any) => {
            const p = playerRef.current;
            const t = p?.getCurrentTime?.() ?? 0;
            if (e.data === YT.PlayerState.PLAYING) {
              track("video_played", { video_id: videoId, current_time: t });
            } else if (e.data === YT.PlayerState.PAUSED) {
              track("video_paused", { video_id: videoId, current_time: t });
            }
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

  // Active sentence id, derived from currentTime range, with manual override
  // when the user clicks (so the click feels instant even before the player
  // has actually seeked).
  const [manualActiveId, setManualActiveId] = useState<number | null>(null);
  const manualUntilRef = useRef(0);

  // Small tuning knob: negative = highlight lags playback, positive = leads.
  const SYNC_OFFSET_SECONDS = 0;

  const playingId = useMemo(() => {
    if (!sentences.length) return null;
    if (manualActiveId !== null && performance.now() < manualUntilRef.current) {
      return manualActiveId;
    }
    const adjustedTime = currentTime + SYNC_OFFSET_SECONDS;
    // Strict range match: only highlight a sentence once playback has actually
    // reached its startTime, and stop highlighting at the next sentence's start.
    for (const s of sentences) {
      if (adjustedTime >= s.offset && adjustedTime < s.endTime) {
        return s.id;
      }
      if (s.offset > adjustedTime) break;
    }
    return null;
  }, [currentTime, sentences, manualActiveId]);

  // Auto-scroll active sentence into view, but pause while the user scrolls.
  const listRef = useRef<HTMLOListElement>(null);
  const userScrollingUntilRef = useRef(0);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      // Mark as user-driven; suppress autoscroll for 2s after last interaction.
      userScrollingUntilRef.current = performance.now() + 2000;
    };
    // Only treat real user gestures (wheel/touch/keys) as user scrolling, not
    // the smooth-scroll we trigger ourselves.
    const mark = () => onScroll();
    el.addEventListener("wheel", mark, { passive: true });
    el.addEventListener("touchmove", mark, { passive: true });
    el.addEventListener("keydown", mark);
    return () => {
      el.removeEventListener("wheel", mark);
      el.removeEventListener("touchmove", mark);
      el.removeEventListener("keydown", mark);
    };
  }, [videoId]);

  useEffect(() => {
    if (!playingId || !listRef.current) return;
    if (performance.now() < userScrollingUntilRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-sid="${playingId}"]`
    );
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [playingId]);

  // Optional auto-pause for replay-until-end-of-sentence.
  const pauseAtRef = useRef<number | null>(null);
  useEffect(() => {
    const target = pauseAtRef.current;
    if (target !== null && currentTime >= target) {
      pauseAtRef.current = null;
      playerRef.current?.pauseVideo?.();
    }
  }, [currentTime]);

  function seekAndPlay(s: TranscriptSentence, pauseAtEnd = false) {
    const p = playerRef.current;
    if (p?.seekTo) {
      p.seekTo(Math.max(0, s.offset), true);
      p.playVideo?.();
    }
    pauseAtRef.current = pauseAtEnd ? s.endTime : null;
    // Make the click feel instant: pin manual highlight briefly.
    setManualActiveId(s.id);
    manualUntilRef.current = performance.now() + 1200;
    setCurrentTime(s.offset);
  }

  const clickCountRef = useRef(0);
  const replayCountRef = useRef(0);
  const milestoneFiredRef = useRef(false);

  useEffect(() => {
    if (!videoId) return;
    milestoneFiredRef.current = false;
    clickCountRef.current = 0;
    replayCountRef.current = 0;
    const t = window.setTimeout(() => {
      if (milestoneFiredRef.current) return;
      milestoneFiredRef.current = true;
      track("session_3_minutes", {
        total_sentences_clicked: clickCountRef.current,
        total_replays: replayCountRef.current,
        video_id: videoId,
      });
    }, 3 * 60 * 1000);
    return () => window.clearTimeout(t);
  }, [videoId]);

  function jumpTo(s: TranscriptSentence) {
    setSelected(s);
    explainMutation.reset();
    explainMutation.mutate(s);
    seekAndPlay(s);
    const idx = sentences.findIndex((x) => x.id === s.id);
    clickCountRef.current += 1;
    track("transcript_sentence_clicked", {
      sentence_index: idx,
      sentence_text: s.text,
      sentence_start_time: s.offset,
      video_id: videoId,
    });
  }

  function replaySelected() {
    if (selected) {
      seekAndPlay(selected, true);
      const idx = sentences.findIndex((x) => x.id === selected.id);
      replayCountRef.current += 1;
      track("sentence_replayed", {
        sentence_index: idx,
        sentence_start_time: selected.offset,
        video_id: videoId,
      });
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
                  onReplay={replaySelected}
                />
              )}
            </div>

            <aside className="flex max-h-[70vh] flex-col overflow-hidden rounded-lg border border-border">
              <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                Transcript · {sentences.length} sentences
              </div>
              <ol ref={listRef} className="flex-1 overflow-y-auto">
                {sentences.map((s) => {
                  const active = selected?.id === s.id;
                  const playing = playingId === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        data-sid={s.id}
                        onClick={() => jumpTo(s)}
                        className={`block w-full border-l-2 border-b border-border/60 px-3 py-2 text-left text-sm leading-relaxed transition hover:bg-accent ${
                          playing
                            ? "border-l-primary bg-primary/10 font-medium"
                            : "border-l-transparent"
                        } ${active ? "bg-accent" : ""}`}
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

        <EarlyAccessSection />
      </main>
    </div>
  );
}

function EarlyAccessSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    track("waitlist_joined", { source: "early_access_section" });
    setSubmitted(true);
  }

  return (
    <section className="mt-12 rounded-lg border border-border bg-card p-6 sm:p-8">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-xl font-semibold tracking-tight">
          Learn Dutch from Real YouTube Videos
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Click any subtitle sentence to instantly understand its meaning,
          translation, and expressions in context.
        </p>
        <p className="mt-4 text-sm text-foreground">
          I'm building Lingua to make language learning through real videos
          faster and more enjoyable.
        </p>
        <p className="text-sm text-foreground">
          Join the early access list and help shape the product.
        </p>

        {submitted ? (
          <p className="mt-6 rounded-md bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
            Thanks! You're on the early access list. I'll let you know when new
            features are available.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-start"
          >
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1"
            />
            <Button type="submit" className="shrink-0">
              Join Early Access
            </Button>
          </form>
        )}
      </div>
    </section>
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
  onReplay,
}: {
  sentence: TranscriptSentence;
  loading: boolean;
  error: string | null;
  text: string | null;
  onClose: () => void;
  onReplay: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Sentence
          </p>
          <p className="mt-1 text-sm font-medium">{sentence.text}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReplay}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Repeat className="h-3.5 w-3.5" /> Replay
          </Button>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
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
