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
import { Loader2, PlayCircle, Repeat, Sparkles, X, Play, MousePointerClick, Brain, Tv, Zap, ArrowRight } from "lucide-react";
import { track, setUserProperties } from "@/lib/analytics";

const DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=ucsSnoeTPMc";
const DEMO_VIDEO_ID = "ucsSnoeTPMc";
const DEMO_LANGUAGE = "English";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clario — Understand content in context" },
      {
        name: "description",
        content:
          "Clario helps people understand content in context. Click any subtitle sentence and instantly see translations, meaning, and expression notes.",
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
  const [view, setView] = useState<"landing" | "demo">("landing");

  const startDemo = () => {
    setUrl(DEMO_VIDEO_URL);
    setTargetLang(DEMO_LANGUAGE);
    setView("demo");
    track("demo_started", { video_id: DEMO_VIDEO_ID });
    if (videoId !== DEMO_VIDEO_ID) {
      loadMutation.mutate(DEMO_VIDEO_URL);
    }
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const goHome = () => {
    setView("landing");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const navTo = (hash: string) => {
    const scroll = () => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (view === "demo") {
      setView("landing");
      setTimeout(scroll, 80);
    } else {
      scroll();
    }
  };

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
    onError: (err: any, submittedUrl) => {
      const isDemo = submittedUrl === DEMO_VIDEO_URL;
      track("transcript_fetch_failed", {
        video_url: submittedUrl,
        error_type: err?.errorType ?? "unknown",
        error_message: err?.message ?? String(err),
      });
      if (!isDemo) {
        track("custom_video_failed", {
          video_url: submittedUrl,
          error_type: err?.errorType ?? "unknown",
        });
      }

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

  const isDemo = videoId === DEMO_VIDEO_ID;

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
    if (isDemo) {
      track("demo_sentence_clicked", {
        sentence_index: idx,
        video_id: videoId,
      });
    }
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
      if (isDemo) {
        track("demo_replay_clicked", {
          sentence_index: idx,
          video_id: videoId,
        });
      }
    }
  }





  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2">
            {view === "demo" && (
              <button
                onClick={goHome}
                className="mr-1 inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                ← Back to Home
              </button>
            )}
            <button
              onClick={goHome}
              className="flex items-center gap-2.5"
              aria-label="Clario home"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-base font-semibold tracking-tight">Clario</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navTo("how")} className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">How it works</button>
            <button onClick={() => navTo("why")} className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">Why Clario</button>
            <button onClick={() => navTo("early-access")} className="hidden text-sm text-muted-foreground hover:text-foreground md:inline">Early access</button>
            {view === "landing" && (
              <Button size="sm" onClick={startDemo} className="h-9 rounded-full px-4 text-xs">
                <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> Try Demo
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {view === "landing" && (
          <>
            <DemoHero onStart={startDemo} loading={loadMutation.isPending} />
            <HowItWorks />
            <WhySection />
            <EarlyAccessSection />
          </>
        )}

        {view === "demo" && loadMutation.isPending && !videoId && (
          <div className="mt-10 flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading transcript…
          </div>
        )}


        {view === "demo" && loadMutation.isError && (
          <div className="mt-6 space-y-3">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <p className="font-medium text-foreground">
                Automatic transcript loading is experimental and may fail.
              </p>
              <p className="mt-1 text-muted-foreground">
                Try the Dutch demo for the reliable experience.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  loadMutation.reset();
                  startDemo();
                }}
              >
                <PlayCircle className="mr-2 h-4 w-4" /> Try the Dutch Demo
              </Button>
            </div>
            <ManualTranscriptFallback
              url={url}
              errorMessage={(loadMutation.error as Error).message}
              manualText={manualText}
              setManualText={setManualText}
              onSubmit={() => {
                if (url.trim() && manualText.trim()) {
                  manualMutation.mutate({ url: url.trim(), text: manualText });
                }
              }}
              submitting={manualMutation.isPending}
              submitError={
                manualMutation.isError
                  ? (manualMutation.error as Error).message
                  : null
              }
            />
          </div>
        )}

        {view === "demo" && videoId && (
          <div className="mt-4 space-y-4">
            <HowItWorksStrip />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black shadow-sm">
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
              </div>

              <aside className="flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <span>Transcript · {sentences.length} sentences</span>
                  <div className="flex items-center gap-2">
                    {transcriptSource && <SourceBadge source={transcriptSource} />}
                  </div>
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
                          className={`block w-full border-l-4 border-b border-border/60 px-3 py-2.5 text-left text-sm leading-relaxed transition hover:bg-accent ${
                            active
                              ? "border-l-primary bg-primary/15 font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--color-primary)]/10"
                              : playing
                              ? "border-l-primary/70 bg-primary/10 font-medium text-foreground"
                              : "border-l-transparent text-foreground/85"
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
          </div>
        )}

        {view === "landing" && (
          <section className="mb-16 rounded-2xl border border-dashed border-border bg-muted/30 p-6 sm:p-8">
            <h3 className="text-sm font-semibold tracking-tight">
              Experimental · try your own YouTube video
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Automatic transcript loading may not work for every video. If it
              fails, fall back to the Dutch demo.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const u = url.trim();
                if (!u) return;
                track("custom_video_attempted", { video_url: u });
                setView("demo");
                loadMutation.mutate(u);
              }}
              className="mt-4 flex flex-col gap-2 sm:flex-row"
            >
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a YouTube URL (e.g. https://youtu.be/...)"
                className="h-10 flex-1 rounded-full bg-background px-4"
              />
              <Input
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                placeholder="Your language"
                className="h-10 rounded-full bg-background px-4 sm:w-44"
              />
              <Button type="submit" disabled={loadMutation.isPending || !url.trim()} className="h-10 rounded-full px-5">
                {loadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
                  </>
                ) : (
                  "Load video"
                )}
              </Button>
            </form>
          </section>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Lingua — built for language learners.</span>
          <span>Dutch Learning Beta</span>
        </div>
      </footer>
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
    track("early_access_joined", { source: "early_access_section" });
    setSubmitted(true);
  }

  return (
    <section
      id="early-access"
      className="my-20 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-10 shadow-sm sm:p-14"
    >
      <div className="mx-auto max-w-xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" /> Early Access
        </span>
        <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
          Help shape Lingua.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Join the early access list to get new languages, features, and
          improvements before anyone else.
        </p>

        {submitted ? (
          <p className="mt-8 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
            Thanks! You're on the early access list.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-8 flex max-w-md flex-col gap-2 sm:flex-row"
          >
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 flex-1 rounded-full bg-background px-5"
            />
            <Button type="submit" className="h-11 shrink-0 rounded-full px-6 shadow-md shadow-primary/20">
              Join waitlist
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}


function SourceBadge({ source }: { source: TranscriptSource }) {
  const map: Record<TranscriptSource, { label: string; cls: string }> = {
    cache: { label: "cached", cls: "bg-primary/10 text-primary" },
    youtube: { label: "youtube", cls: "bg-accent text-accent-foreground" },
    manual: { label: "manual", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  };
  const m = map[source];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium normal-case ${m.cls}`}>
      {m.label}
    </span>
  );
}

function ManualTranscriptFallback({
  url,
  errorMessage,
  manualText,
  setManualText,
  onSubmit,
  submitting,
  submitError,
}: {
  url: string;
  errorMessage: string;
  manualText: string;
  setManualText: (s: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  return (
    <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm text-destructive">{errorMessage}</p>
      <div className="mt-3">
        <label className="text-xs font-medium text-foreground">
          Paste transcript manually
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          One line per sentence. Optionally prefix each line with a timestamp,
          e.g. <code className="rounded bg-muted px-1">[0:15] Hallo, hoe gaat het?</code>
        </p>
        <Textarea
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder={"[0:00] First sentence.\n[0:04] Second sentence."}
          rows={6}
          className="mt-2 font-mono text-xs"
        />
        {submitError && (
          <p className="mt-2 text-xs text-destructive">{submitError}</p>
        )}
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={submitting || !url.trim() || !manualText.trim()}
            onClick={onSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading
              </>
            ) : (
              "Use this transcript"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}


function DemoHero({ onStart, loading }: { onStart: () => void; loading: boolean }) {
  return (
    <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-20 -z-10 mx-auto h-[480px] max-w-5xl bg-[radial-gradient(ellipse_at_top,oklch(0.55_0.22_265/0.15),transparent_70%)]"
      />
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm">
            🇳🇱 Dutch Learning Beta
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
            Understand real Dutch videos{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              instantly.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Click any subtitle sentence while watching YouTube and get
            translations, explanations, and expressions in context.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              onClick={onStart}
              disabled={loading}
              className="h-12 gap-2 rounded-full px-6 text-sm font-medium shadow-lg shadow-primary/20"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading demo…
                </>
              ) : (
                <>
                  Try the Demo <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-12 gap-2 rounded-full px-5 text-sm font-medium text-foreground hover:bg-accent"
              onClick={onStart}
            >
              <Play className="h-4 w-4 fill-current" /> Watch 30-second walkthrough
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No signup required · Try it in under 30 seconds
          </p>
        </div>

        <ProductMockup />
      </div>
    </section>
  );
}

function ProductMockup() {
  const lines = [
    { t: "0:04", text: "Hallo allemaal, welkom bij deze video.", active: false },
    { t: "0:08", text: "Vandaag gaan we Nederlands leren met echte content.", active: true },
    { t: "0:13", text: "Het is veel leuker dan een saai tekstboek.", active: false },
    { t: "0:17", text: "Klik gewoon op een zin om de betekenis te zien.", active: false },
  ];
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent blur-2xl"
      />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10">
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 truncate text-[11px] text-muted-foreground">
            lingua.app / dutch-demo
          </span>
        </div>
        <div className="grid grid-cols-[1.4fr_1fr] gap-0">
          <div className="space-y-3 border-r border-border p-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 to-slate-700">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-lg">
                  <Play className="ml-0.5 h-6 w-6 fill-primary text-primary" />
                </div>
              </div>
              <div className="absolute bottom-3 left-3 right-3 rounded-md bg-black/60 px-3 py-1.5 text-center text-xs text-white backdrop-blur-sm">
                Vandaag gaan we Nederlands leren…
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Translation
              </p>
              <p className="mt-1.5 text-sm font-medium text-foreground">
                "Today we're going to learn Dutch with real content."
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">echte content</span>{" "}
                — "real content"; common in informal speech to contrast with
                textbook material.
              </p>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Transcript
            </div>
            <div className="flex-1 divide-y divide-border">
              {lines.map((l, i) => (
                <div
                  key={i}
                  className={`flex gap-2 px-3 py-2.5 text-xs leading-relaxed ${
                    l.active
                      ? "border-l-2 border-primary bg-primary/10 font-medium text-foreground"
                      : "border-l-2 border-transparent text-foreground/80"
                  }`}
                >
                  <span className="tabular-nums text-[10px] text-muted-foreground">
                    {l.t}
                  </span>
                  <span className="min-w-0">{l.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", icon: Tv, title: "Watch a real Dutch video", desc: "Pick any YouTube video in your target language." },
    { n: "02", icon: MousePointerClick, title: "Click any subtitle sentence", desc: "Tap a line in the transcript while you watch." },
    { n: "03", icon: Brain, title: "Understand instantly", desc: "Get meaning, translation, and expressions in context." },
  ];
  return (
    <section id="how" className="border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">How it works</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          From "lost in audio" to "got it" in three clicks.
        </h2>
      </div>
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="group relative rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-mono text-muted-foreground">{s.n}</span>
            </div>
            <h3 className="mt-5 text-base font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhySection() {
  const cards = [
    { emoji: "📺", icon: Tv, title: "Learn from real content", desc: "Stop relying only on textbook examples." },
    { emoji: "⚡", icon: Zap, title: "Instant understanding", desc: "No more pausing to search every phrase." },
    { emoji: "🧠", icon: Brain, title: "Learn in context", desc: "Understand how natives actually speak." },
  ];
  return (
    <section id="why" className="border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Why Lingua</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Built for learners who want to actually enjoy the language.
        </h2>
      </div>
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/30 p-6 shadow-sm"
          >
            <div className="text-2xl">{c.emoji}</div>
            <h3 className="mt-4 text-base font-semibold tracking-tight">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
          </div>
        ))}
      </div>
    </section>
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
