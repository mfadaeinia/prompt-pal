import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchTranscript,
  saveManualTranscript,
  type TranscriptSentence,
  type TranscriptSource,
} from "@/lib/transcript.functions";

import { explainSentence } from "@/lib/explain.functions";
import { submitEarlyAccess } from "@/lib/early-access.functions";
import { recordVideoSession } from "@/lib/video-sessions.functions";
import {
  saveExpression,
  listSavedExpressions,
} from "@/lib/saved-expressions.functions";
import { getBrowserId } from "@/lib/browser-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlayCircle, Repeat, Sparkles, X, Play, MousePointerClick, Brain, Tv, Zap, ArrowRight, Bookmark, BookmarkCheck, Check } from "lucide-react";
import { track, setUserProperties } from "@/lib/analytics";
import { FeedbackWidget, FeedbackFab } from "@/components/FeedbackWidget";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { DevAnalyticsPanel, isDevPanelEnabled } from "@/components/DevAnalyticsPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { BookOpen, ChevronDown, ArrowDownToLine } from "lucide-react";


const DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=ucsSnoeTPMc";
const DEMO_VIDEO_ID = "ucsSnoeTPMc";
const DEMO_LANGUAGE = "English";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NativeFlow — Learn languages from YouTube" },
      {
        name: "description",
        content:
          "Turn any YouTube video into an interactive language lesson. Get sentence-by-sentence explanations, translations, and expression notes while you watch.",
      },
      { property: "og:title", content: "NativeFlow — Learn languages from YouTube" },
      { property: "og:description", content: "Turn any YouTube video into an interactive language lesson." },
      { name: "twitter:title", content: "NativeFlow — Learn languages from YouTube" },
      { name: "twitter:description", content: "Turn any YouTube video into an interactive language lesson." },
    ],
  }),
  component: Index,
});

function Index() {
  const fetchTx = useServerFn(fetchTranscript);
  const saveManualTx = useServerFn(saveManualTranscript);
  const explainFx = useServerFn(explainSentence);
  const saveExpressionFx = useServerFn(saveExpression);
  const listSavedFx = useServerFn(listSavedExpressions);
  const qc = useQueryClient();



  const [url, setUrl] = useState("");
  const [targetLang, setTargetLang] = useState("English");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [sentences, setSentences] = useState<TranscriptSentence[]>([]);
  const [selected, setSelected] = useState<TranscriptSentence | null>(null);
  const [transcriptSource, setTranscriptSource] = useState<TranscriptSource | null>(null);
  const [manualText, setManualText] = useState("");
  const [view, setView] = useState<"landing" | "demo">("landing");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackTrigger, setFeedbackTrigger] = useState<string>("");
  const isMobile = useIsMobile();
  const [studyMode, setStudyMode] = useState(true);
  const [browserId, setBrowserId] = useState("");
  const [justSavedId, setJustSavedId] = useState<number | null>(null);
  const [showSavedTooltip, setShowSavedTooltip] = useState(false);
  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current && typeof crypto !== "undefined") {
    sessionIdRef.current =
      (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2);
  }
  const feedbackShownRef = useRef(false);
  const feedbackSubmittedRef = useRef(false);
  const waitlistJoinedRef = useRef(false);
  const demoStartTimeRef = useRef<number | null>(null);
  const pageLoadTimeRef = useRef<number>(
    typeof performance !== "undefined" ? performance.now() : 0
  );
  const devPanelEnabled = isDevPanelEnabled();

  useEffect(() => {
    setBrowserId(getBrowserId());
  }, []);

  // List of saved expressions for this browser — used to mark sentences as already-saved.
  const savedQuery = useQuery({
    queryKey: ["saved-expressions", browserId],
    queryFn: () => listSavedFx({ data: { sessionId: browserId } }),
    enabled: !!browserId,
  });
  const savedSentenceKeys = useMemo(() => {
    const set = new Set<string>();
    for (const it of (savedQuery.data?.items ?? []) as any[]) {
      set.add(`${it.video_id ?? ""}::${(it.sentence_text ?? "").trim()}`);
    }
    return set;
  }, [savedQuery.data]);

  // First-time onboarding tooltip for Saved items
  useEffect(() => {
    if (!browserId) return;
    const seen = localStorage.getItem("nativeflow_saved_tooltip_seen");
    if (!seen && savedQuery.data && (savedQuery.data.items ?? []).length > 0) {
      setShowSavedTooltip(true);
      const t = setTimeout(() => {
        setShowSavedTooltip(false);
        localStorage.setItem("nativeflow_saved_tooltip_seen", "1");
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [browserId, savedQuery.data]);

  function isSentenceSaved(s: TranscriptSentence | null) {
    if (!s) return false;
    return savedSentenceKeys.has(`${videoId ?? ""}::${s.text.trim()}`);
  }

  const saveExpressionMutation = useMutation({
    mutationFn: (vars: {
      sentence: TranscriptSentence;
      translation: string | null;
      meaning: string | null;
      note: string | null;
    }) =>
      saveExpressionFx({
        data: {
          sessionId: browserId,
          sentenceText: vars.sentence.text,
          translation: vars.translation,
          meaning: vars.meaning,
          expressionNotes: vars.note,
          videoTitle: videoTitle,
          videoUrl: url || null,
          videoId: videoId,
          timestampSeconds: Math.max(0, Math.round(vars.sentence.offset)),
          targetLanguage: targetLang || null,
        },
      }),
    onSuccess: (_res, vars) => {
      track("expression_saved", {
        video_id: videoId,
        sentence_index: sentences.findIndex((x) => x.id === vars.sentence.id),
        timestamp_seconds: Math.round(vars.sentence.offset),
        target_language: targetLang,
      });
      setJustSavedId(vars.sentence.id);
      window.setTimeout(() => setJustSavedId(null), 1800);
      qc.invalidateQueries({ queryKey: ["saved-expressions", browserId] });
    },
  });

  function handleSaveExpression(s: TranscriptSentence | null) {
    if (!s || !browserId) return;
    const entry = explanationCache[s.id];
    const ready = entry && entry.status === "ready" ? entry : null;
    saveExpressionMutation.mutate({
      sentence: s,
      translation: ready?.translation || null,
      meaning: ready?.meaning || null,
      note: ready?.note && ready.note !== "—" ? ready.note : null,
    });
  }

  // ── Selection-based "Save expression" floating menu ──────────────────────
  // When the user highlights text inside the transcript, show a contextual
  // action to save just the selected text (not the whole sentence).
  const [selectionPopover, setSelectionPopover] = useState<{
    text: string;
    sentence: TranscriptSentence;
    x: number;
    y: number;
  } | null>(null);
  const [selSaving, setSelSaving] = useState(false);
  const [selJustSaved, setSelJustSaved] = useState(false);

  useEffect(() => {
    if (!studyMode) {
      setSelectionPopover(null);
      return;
    }
    const handler = () => {
      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelectionPopover(null);
        return;
      }
      const container = listRef.current;
      if (!container) return;
      const node = sel.focusNode ?? sel.anchorNode;
      if (!node || !container.contains(node)) {
        setSelectionPopover(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text || text.length > 500) {
        setSelectionPopover(null);
        return;
      }
      let el: HTMLElement | null =
        node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
      while (el && !el.dataset?.sid && el !== container) el = el.parentElement;
      const sid = el?.dataset?.sid ? Number(el.dataset.sid) : null;
      if (sid == null) {
        setSelectionPopover(null);
        return;
      }
      const sentence = sentences.find((s) => s.id === sid);
      if (!sentence) {
        setSelectionPopover(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelectionPopover({
        text,
        sentence,
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [studyMode, sentences]);

  async function saveSelectedExpression() {
    if (!selectionPopover || !browserId) return;
    const { text, sentence } = selectionPopover;
    setSelSaving(true);
    try {
      await saveExpressionFx({
        data: {
          sessionId: browserId,
          sentenceText: text,
          translation: null,
          meaning: null,
          expressionNotes: `Selected from: "${sentence.text}"`,
          videoTitle: videoTitle,
          videoUrl: url || null,
          videoId: videoId,
          timestampSeconds: Math.max(0, Math.round(sentence.offset)),
          targetLanguage: targetLang || null,
        },
      });
      track("expression_saved", {
        video_id: videoId,
        source: "text_selection",
        timestamp_seconds: Math.round(sentence.offset),
        selected_length: text.length,
      });
      qc.invalidateQueries({ queryKey: ["saved-expressions", browserId] });
      setSelJustSaved(true);
      window.setTimeout(() => setSelJustSaved(false), 1400);
      window.setTimeout(() => setSelectionPopover(null), 600);
      window.getSelection()?.removeAllRanges();
    } catch {
      // best-effort
    } finally {
      setSelSaving(false);
    }
  }


  function getFeedbackContext() {
    const start = demoStartTimeRef.current ?? pageLoadTimeRef.current;
    const seconds = Math.max(
      0,
      Math.round(((typeof performance !== "undefined" ? performance.now() : 0) - start) / 1000)
    );
    const watched = demoStartTimeRef.current
      ? Math.max(
          0,
          Math.round(
            ((typeof performance !== "undefined" ? performance.now() : 0) -
              demoStartTimeRef.current) /
              1000
          )
        )
      : 0;
    return {
      sessionId: sessionIdRef.current,
      videoId,
      totalSentenceClicks: clickCountRef.current,
      uniqueSegmentsClicked: uniqueClickedRef.current.size,
      explanationsOpened: explanationsOpenedRef.current,
      timeOnPageSeconds: seconds,
      secondsWatched: watched,
      isOwnVideo: videoId !== null && videoId !== DEMO_VIDEO_ID,
      targetLanguage: targetLang || null,
      demoStarted: demoStartTimeRef.current !== null,
      pageUrl: typeof window !== "undefined" ? window.location.href : "",
    };
  }

  function maybeTriggerFeedback(reason: string) {
    if (feedbackShownRef.current) return;
    if (typeof window !== "undefined") {
      try {
        if (localStorage.getItem("clario_feedback_given") === "1") {
          feedbackShownRef.current = true;
          return;
        }
        const last = localStorage.getItem("clario_feedback_dismissed_at");
        if (last && Date.now() - Number(last) < 14 * 24 * 60 * 60 * 1000) {
          feedbackShownRef.current = true;
          return;
        }
      } catch {}
    }
    feedbackShownRef.current = true;
    setFeedbackTrigger(reason);
    setShowFeedback(true);
    track("feedback_opened", {
      trigger_reason: reason,
      video_id: videoId,
      explanations_opened: explanationsOpenedRef.current,
      is_own_video: videoId !== null && videoId !== DEMO_VIDEO_ID,
    });
  }

  function openFeedbackManually() {
    feedbackShownRef.current = true;
    setFeedbackTrigger("manual");
    setShowFeedback(true);
    track("feedback_opened", { trigger_reason: "manual", video_id: videoId });
  }

  // Pre-engagement landing-page feedback prompt removed.
  // Feedback is now triggered AFTER value (3+ explanations viewed).

  // Funnel: landing page viewed + session lifecycle logs.
  // Session starts on mount, ends on pagehide / unmount. Inactive (hidden)
  // tabs are NOT counted toward visible time — see flush() above.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sid = sessionIdRef.current;
    const startedAt = Date.now();
    track("page_view", {
      session_id: sid,
      path: window.location.pathname,
      referrer: document.referrer || null,
    });
    track("landing_page_viewed", {
      session_id: sid,
      path: window.location.pathname,
      referrer: document.referrer || null,
    });
    track("session_started", { session_id: sid, started_at: new Date(startedAt).toISOString() });
    // eslint-disable-next-line no-console
    console.info("[analytics] session_started", { session_id: sid });

    const onHide = () => {
      const seconds = Math.round(
        ((typeof performance !== "undefined" ? performance.now() : 0) -
          pageLoadTimeRef.current) /
          1000
      );
      track("session_ended", {
        session_id: sid,
        duration_seconds: seconds,
        feedback_submitted: feedbackSubmittedRef.current,
        waitlist_joined: waitlistJoinedRef.current,
        demo_started: demoStartTimeRef.current !== null,
      });
      // eslint-disable-next-line no-console
      console.info("[analytics] session_ended", { session_id: sid, seconds });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Watch again" deep-link handler: ?v=<youtube-url>&t=<seconds>&lang=<lang>
  const deepLinkSeekRef = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const v = params.get("v");
    if (!v) return;
    const t = Number(params.get("t") || 0);
    const lang = params.get("lang");
    const mode = params.get("mode");
    setUrl(v);
    if (lang) setTargetLang(lang);
    setView("demo");
    // Restore Learning Mode (transcript + explanations) for deep-links from
    // My Expressions so the original lesson context is fully reopened.
    if (mode !== "watch") setStudyMode(true);
    deepLinkSeekRef.current = isFinite(t) ? t : null;
    demoStartTimeRef.current = performance.now();
    loadMutation.mutate(v);
    // Clean the URL so refreshes don't re-seek.
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the player is ready and sentences are loaded after a deep-link, seek.
  useEffect(() => {
    const t = deepLinkSeekRef.current;
    if (t == null) return;
    if (!sentences.length) return;
    const tryer = window.setInterval(() => {
      const p = playerRef.current;
      if (p?.seekTo) {
        p.seekTo(Math.max(0, t), true);
        p.playVideo?.();
        deepLinkSeekRef.current = null;
        window.clearInterval(tryer);
      }
    }, 200);
    return () => window.clearInterval(tryer);
  }, [sentences]);


  const startDemo = () => {
    setUrl(DEMO_VIDEO_URL);
    setTargetLang(DEMO_LANGUAGE);
    setView("demo");
    track("demo_started", { video_id: DEMO_VIDEO_ID });
    if (videoId !== DEMO_VIDEO_ID) {
      loadMutation.mutate(DEMO_VIDEO_URL);
    }
    demoStartTimeRef.current = performance.now();
    // First-time onboarding
    try {
      if (typeof window !== "undefined" && !localStorage.getItem("clario_onboarded")) {
        setShowOnboarding(true);
        track("onboarding_seen", { video_id: DEMO_VIDEO_ID });
      }
    } catch {}
    // Feedback trigger now fires after 3 explanations viewed (see effect above).
    // Demo engagement milestones
    window.setTimeout(
      () => track("demo_completed_60_seconds", { video_id: DEMO_VIDEO_ID }),
      60_000
    );
    window.setTimeout(
      () => track("demo_completed_180_seconds", { video_id: DEMO_VIDEO_ID }),
      180_000
    );
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const dismissOnboarding = (completed: boolean) => {
    setShowOnboarding(false);
    try {
      localStorage.setItem("clario_onboarded", "1");
    } catch {}
    if (completed) track("onboarding_completed", { video_id: videoId });
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
    onSuccess: (res, submittedUrl) => {
      setVideoId(res.videoId);
      setSentences(res.sentences);
      setSelected(null);
      setTranscriptSource(res.source);
      setVideoTitle(null);
      // Fetch human-readable video title via YouTube oEmbed (best-effort).
      fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(
          `https://www.youtube.com/watch?v=${res.videoId}`
        )}&format=json`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j?.title) setVideoTitle(j.title as string);
        })
        .catch(() => {});
      setUserProperties({ selected_language: targetLang });


      // Cache hit/miss telemetry (per-source events are emitted below).
      track(res.cacheHit ? "cache_hit" : "cache_miss", {
        video_id: res.videoId,
        source: res.source,
      });

      // Per-layer success event.
      const evt =
        res.source === "cache"
          ? "transcript_loaded_from_cache"
          : res.source === "youtube"
          ? "transcript_loaded_from_youtube"
          : res.source === "fallback"
          ? "transcript_loaded_from_fallback_provider"
          : "transcript_loaded_manually";
      track(evt, {
        video_url: submittedUrl,
        video_id: res.videoId,
        selected_language: targetLang,
      });
      track("video_loaded", {
        video_url: submittedUrl,
        video_id: res.videoId,
        selected_language: targetLang,
        source: res.source,
      });

      // Custom-video funnel: anything that's not the bundled demo counts.
      if (submittedUrl !== DEMO_VIDEO_URL) {
        track("custom_video_loaded", {
          video_url: submittedUrl,
          video_id: res.videoId,
          source: res.source,
        });
      }
    },
    onError: (err: any, submittedUrl) => {
      const isDemo = submittedUrl === DEMO_VIDEO_URL;
      // Internal-only — never surfaced to the user.
      track("transcript_fetch_failed", {
        video_url: submittedUrl,
        error_type: err?.errorType ?? "unknown",
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




  // Explanation cache: sentenceId -> parsed explanation (or loading/error).
  type ExplanationEntry =
    | { status: "loading" }
    | { status: "ready"; translation: string; meaning: string; note: string }
    | { status: "error"; error: string };
  const [explanationCache, setExplanationCache] = useState<
    Record<number, ExplanationEntry>
  >({});
  const inFlightRef = useRef<Set<number>>(new Set());

  function ensureExplanation(s: TranscriptSentence, sList = sentences) {
    if (explanationCache[s.id] || inFlightRef.current.has(s.id)) return;
    inFlightRef.current.add(s.id);
    setExplanationCache((prev) => ({ ...prev, [s.id]: { status: "loading" } }));
    const idx = sList.findIndex((x) => x.id === s.id);
    const ctx = sList
      .slice(Math.max(0, idx - 1), Math.min(sList.length, idx + 2))
      .map((x) => x.text)
      .join(" ");
    explainFx({
      data: { sentence: s.text, context: ctx, targetLanguage: targetLang },
    })
      .then((res) => {
        const parsed = parseExplanation(res.explanation ?? null);
        setExplanationCache((prev) => ({
          ...prev,
          [s.id]: {
            status: "ready",
            translation: parsed.translation,
            meaning: parsed.meaning,
            note: parsed.note,
          },
        }));
      })
      .catch((err: any) => {
        setExplanationCache((prev) => ({
          ...prev,
          [s.id]: { status: "error", error: err?.message ?? "Failed to load" },
        }));
      })
      .finally(() => {
        inFlightRef.current.delete(s.id);
      });
  }

  // Reset explanation cache when transcript changes.
  useEffect(() => {
    setExplanationCache({});
    inFlightRef.current = new Set();
  }, [videoId]);

  // Track how long the user stays on a video session and persist to Supabase.
  // We upsert keyed by (session_id, video_id) every 15s while the tab is
  // visible, and flush a final "ended" record on hide/unload.
  useEffect(() => {
    if (!videoId) return;
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    const startedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    let visibleSince = startedAt;
    let accumulatedMs = 0;
    let lastSent = -1;

    const now = () =>
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const currentSeconds = () => {
      const live = document.visibilityState === "visible" ? now() - visibleSince : 0;
      return Math.max(0, Math.round((accumulatedMs + live) / 1000));
    };

    const flush = (ended: boolean) => {
      const seconds = currentSeconds();
      if (!ended && seconds === lastSent) return;
      lastSent = seconds;
      recordVideoSession({
        data: {
          sessionId,
          videoId,
          durationSeconds: seconds,
          videoUrl: url || null,
          targetLanguage: targetLang || null,
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
          ended,
        },
      }).catch(() => {
        // Best-effort engagement telemetry — never surface to user.
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        visibleSince = now();
      } else {
        accumulatedMs += now() - visibleSince;
        flush(false);
      }
    };
    const onPageHide = () => {
      if (document.visibilityState === "visible") {
        accumulatedMs += now() - visibleSince;
        visibleSince = now();
      }
      flush(true);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    const interval = window.setInterval(() => flush(false), 15_000);

    // Initial write so the row exists right away.
    flush(false);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(interval);
      if (document.visibilityState === "visible") {
        accumulatedMs += now() - visibleSince;
      }
      flush(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Preload all explanations for the loaded transcript (especially the demo)
  // so switching sentences during playback is instant. Concurrency-limited.
  useEffect(() => {
    if (!sentences.length) return;
    let cancelled = false;
    let cursor = 0;
    const concurrency = 4;
    const worker = async () => {
      while (!cancelled && cursor < sentences.length) {
        const s = sentences[cursor++];
        ensureExplanation(s, sentences);
        // Small gap to avoid hammering the gateway in one tick.
        await new Promise((r) => setTimeout(r, 60));
      }
    };
    for (let i = 0; i < concurrency; i++) void worker();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentences]);


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

  const [activeOutOfView, setActiveOutOfView] = useState(false);
  useEffect(() => {
    if (!playingId || !listRef.current) {
      setActiveOutOfView(false);
      return;
    }
    const container = listRef.current;
    const el = container.querySelector<HTMLElement>(`[data-sid="${playingId}"]`);
    if (!el) return;
    // On mobile: NEVER auto-scroll. Just track whether the active sentence
    // is visible so we can offer a manual "Jump to current" affordance.
    if (isMobile) {
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const inView = eRect.bottom > cRect.top + 8 && eRect.top < cRect.bottom - 8;
      setActiveOutOfView(!inView);
      return;
    }
    // Desktop: keep the existing follow-the-playback behavior, but pause
    // briefly after the user scrolls so we don't fight them.
    if (performance.now() < userScrollingUntilRef.current) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [playingId, isMobile]);

  function jumpToCurrentSentence() {
    if (!playingId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-sid="${playingId}"]`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setActiveOutOfView(false);
      track("transcript_jump_to_current_clicked", { video_id: videoId });
    }
  }

  // Auto-sync explanation panel with the currently playing sentence.
  // Fires `transcript_sentence_auto_explained` when the panel switches
  // sentence due to playback (not user click — those go via jumpTo).
  const lastAutoExplainedRef = useRef<number | null>(null);
  useEffect(() => {
    if (playingId == null) return;
    const s = sentences.find((x) => x.id === playingId);
    if (!s) return;
    setSelected((prev) => {
      if (prev?.id === s.id) return prev;
      // Only treat as auto when the manual-click pin has expired.
      if (performance.now() >= manualUntilRef.current && lastAutoExplainedRef.current !== s.id) {
        lastAutoExplainedRef.current = s.id;
        track("transcript_sentence_auto_explained", {
          sentence_index: sentences.findIndex((x) => x.id === s.id),
          video_id: videoId,
        });
      }
      return s;
    });
    ensureExplanation(s, sentences);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId, sentences]);

  // Fire `explanation_viewed` once per sentence when its explanation finishes
  // loading AND it is the currently selected sentence (i.e. actually visible).
  const viewedExplanationRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!selected) return;
    const entry = explanationCache[selected.id];
    if (entry?.status !== "ready") return;
    if (viewedExplanationRef.current.has(selected.id)) return;
    viewedExplanationRef.current.add(selected.id);
    explanationsOpenedRef.current += 1;
    track("explanation_viewed", {
      sentence_index: sentences.findIndex((x) => x.id === selected.id),
      video_id: videoId,
      explanations_opened: explanationsOpenedRef.current,
    });
    // Primary feedback trigger: after the 3rd explanation in this session.
    // Slight delay so the user has time to actually read the explanation.
    if (explanationsOpenedRef.current === 3) {
      window.setTimeout(() => maybeTriggerFeedback("3_explanations"), 1200);
    }
  }, [selected, explanationCache, sentences, videoId]);


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
  const uniqueClickedRef = useRef<Set<number>>(new Set());
  const explanationsOpenedRef = useRef(0);

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
    ensureExplanation(s, sentences);
    seekAndPlay(s);
    const idx = sentences.findIndex((x) => x.id === s.id);
    clickCountRef.current += 1;
    uniqueClickedRef.current.add(idx);
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
    // Dismiss onboarding on first interaction
    if (showOnboarding) dismissOnboarding(true);
    // Feedback trigger is now bound to explanation_viewed (after value is delivered),
    // not raw clicks. See effect above.
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
              aria-label="NativeFlow home"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-base font-semibold tracking-tight">NativeFlow</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navTo("how")} className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">How it works</button>
            <button onClick={() => navTo("why")} className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">Why NativeFlow</button>
            <button onClick={() => navTo("early-access")} className="hidden text-sm text-muted-foreground hover:text-foreground md:inline">Early access</button>
            <div className="relative">
              <Link
                to="/saved"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                onClick={() => {
                  track("my_expressions_opened", { from: view });
                  setShowSavedTooltip(false);
                  localStorage.setItem("nativeflow_saved_tooltip_seen", "1");
                }}
                aria-label="Saved learning items"
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>Saved</span>
                {savedQuery.data && (savedQuery.data.items ?? []).length > 0 && (
                  <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {(savedQuery.data.items ?? []).length > 99 ? "99+" : (savedQuery.data.items ?? []).length}
                  </span>
                )}
              </Link>
              {showSavedTooltip && (
                <div className="absolute left-1/2 top-full z-50 mt-2.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-lg animate-in fade-in zoom-in-95">
                  <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-primary" />
                  Your saved words and expressions appear here.
                </div>
              )}
            </div>
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
            <PrimaryHero
              url={url}
              setUrl={setUrl}
              targetLang={targetLang}
              setTargetLang={setTargetLang}
              loading={loadMutation.isPending}
              onSubmit={(u) => {
                track("custom_video_attempted", { video_url: u });
                setView("demo");
                loadMutation.mutate(u);
              }}
              onStartDemo={startDemo}
            />
            <LanguageSupportSection />
            <ValuePropositionSection />
            <HowItWorks />
            <WhySection />
            <EarlyAccessSection />
          </>
        )}

        {view === "demo" && loadMutation.isPending && !videoId && (
          <LoadingProgress />
        )}


        {view === "demo" && loadMutation.isError && (
          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="text-base font-semibold text-foreground">
                We couldn't automatically load subtitles for this video right now.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Try another video, the reliable demo, or paste a transcript
                manually below.
              </p>
          <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    loadMutation.reset();
                    setVideoId(null);
                    setSentences([]);
                    setView("landing");
                    requestAnimationFrame(() =>
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    );
                  }}
                  variant="outline"
                  className="rounded-full"
                >
                  Try another video
                </Button>
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    loadMutation.reset();
                    startDemo();
                  }}
                >
                  <PlayCircle className="mr-2 h-4 w-4" /> Try the Demo
                </Button>
              </div>
            </div>
            <ManualTranscriptFallback
              url={url}
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
                  ? "We couldn't use that transcript. Please double-check the format and try again."
                  : null
              }
            />
          </div>
        )}

        {view === "demo" && videoId && (
          <div className={`mt-4 space-y-4 ${isMobile ? "pb-24" : ""}`}>
            {!isDemo && <ReadinessBadges videoId={videoId} />}


            {/* Subtle secondary mode toggle — Learning Mode is the default. */}
            <div className="flex items-center justify-end">
              <button
                onClick={() => {
                  const next = !studyMode;
                  setStudyMode(next);
                  if (!next) setSelected(null);
                  track(next ? "study_mode_opened" : "study_mode_closed", { video_id: videoId });
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                aria-pressed={!studyMode}
              >
                {studyMode ? (
                  <>
                    <Tv className="h-3.5 w-3.5" />
                    Just watch
                  </>
                ) : (
                  <>
                    <BookOpen className="h-3.5 w-3.5" />
                    Back to Learning Mode
                  </>
                )}
              </button>
            </div>


            <div
              className={`grid gap-6 ${
                studyMode
                  ? "grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
                  : "grid-cols-1"
              }`}
            >

              <div className="space-y-4">
                <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black shadow-sm sticky top-[68px] z-10 lg:static">
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

                {/* Compact Learning Mode CTA (Watch Mode only, directly below video) */}
                {!studyMode && (
                  <div className="animate-clario-pulse flex items-center gap-3 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-3 shadow-sm sm:p-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight text-foreground">
                        Want to understand every sentence?
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground line-clamp-2">
                        Open Learning Mode for translations, explanations and clickable transcript.
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        setStudyMode(true);
                        track("study_mode_opened", { video_id: videoId });
                      }}
                      size="sm"
                      className="shrink-0 rounded-full px-3 text-xs font-semibold shadow-sm sm:px-4 sm:text-sm"
                    >
                      <BookOpen className="mr-1 h-3.5 w-3.5 sm:mr-1.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Open Learning Mode</span>
                      <span className="sm:hidden">Open</span>
                    </Button>
                  </div>
                )}

                {studyMode && (
                  <ExplanationPanel
                    sentence={selected}
                    entry={
                      selected ? explanationCache[selected.id] : undefined
                    }
                    onClose={() => setSelected(null)}
                    onReplay={replaySelected}
                    onSave={() => handleSaveExpression(selected)}
                    isSaved={isSentenceSaved(selected)}
                    justSaved={!!selected && justSavedId === selected.id}
                    saving={saveExpressionMutation.isPending}
                  />
                )}
              </div>

              {studyMode && (
                <aside className="relative flex max-h-[60vh] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:max-h-[70vh]">
                  <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                    <span>Transcript · {sentences.length} sentences</span>
                    <div className="flex items-center gap-2">
                      {transcriptSource && (
                        <SourceBadge source={transcriptSource} />
                      )}
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

                  {isMobile && activeOutOfView && playingId !== null && (
                    <button
                      onClick={jumpToCurrentSentence}
                      className="absolute bottom-[72px] left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90"
                    >
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                      Jump to current sentence
                    </button>
                  )}
                </aside>
              )}
            </div>

            {/* Supporting/marketing content lives BELOW the product. */}
            <section className="space-y-4 pt-8">
              <HowItWorksStrip />
              <ValueCards />
            </section>


            {/* Mobile persistent bottom bar */}
            {isMobile && (
              <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
                {!studyMode ? (
                  <div className="space-y-2">
                    <p className="text-center text-[11px] text-muted-foreground">
                      Want translations, explanations and clickable captions?
                    </p>
                    <Button
                      onClick={() => {
                        setStudyMode(true);
                        track("study_mode_opened", { video_id: videoId });
                      }}
                      className="h-12 w-full rounded-full text-sm font-semibold shadow-lg shadow-primary/20"
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      Study This Video
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStudyMode(false);
                      setSelected(null);
                      track("study_mode_closed", { video_id: videoId });
                    }}
                    className="h-11 w-full rounded-full text-sm font-medium"
                  >
                    <Tv className="mr-2 h-4 w-4" />
                    Back to Watch Mode
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Custom-video section moved directly under DemoHero — see CustomVideoSection. */}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} NativeFlow — understand content in context.</span>
          <span>Language Learning Beta</span>
        </div>
      </footer>

      {showOnboarding && view === "demo" && (
        <OnboardingOverlay onDismiss={() => dismissOnboarding(false)} />
      )}
      {showFeedback ? (
        <FeedbackWidget
          triggerReason={feedbackTrigger}
          getContext={getFeedbackContext}
          onDismiss={() => {
            setShowFeedback(false);
            feedbackSubmittedRef.current = true;
            try {
              localStorage.setItem("clario_feedback_given", "1");
              localStorage.setItem("clario_feedback_dismissed_at", String(Date.now()));
            } catch {}
          }}
        />
      ) : (
        <FeedbackFab onClick={openFeedbackManually} />
      )}
      {devPanelEnabled && (
        <DevAnalyticsPanel
          getState={() => ({
            sessionId: sessionIdRef.current,
            videoId,
            timeOnPageSeconds: Math.round(
              ((typeof performance !== "undefined" ? performance.now() : 0) -
                pageLoadTimeRef.current) /
                1000
            ),
            transcriptClicks: clickCountRef.current,
            demoStarted: demoStartTimeRef.current !== null,
            feedbackSubmitted: feedbackSubmittedRef.current,
            waitlistJoined: waitlistJoinedRef.current || (typeof window !== "undefined" && localStorage.getItem("clario_waitlist_joined") === "1"),
          })}
        />
      )}
      {selectionPopover && (
        <div
          style={{
            position: "fixed",
            top: Math.max(8, selectionPopover.y - 44),
            left: selectionPopover.x,
            transform: "translateX(-50%)",
            zIndex: 60,
          }}
          // Don't let mousedown collapse the selection before click fires.
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            onClick={saveSelectedExpression}
            disabled={selSaving}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-lg ring-1 ring-black/10 hover:opacity-90 disabled:opacity-60"
          >
            {selJustSaved ? (
              <>
                <Check className="h-3.5 w-3.5" /> Saved
              </>
            ) : selSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Bookmark className="h-3.5 w-3.5" /> Save expression
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}


function EarlyAccessSection() {
  // Early Access signups are persisted in Supabase.
  // To view: Supabase → Table Editor → early_access_signups
  // Or SQL: SELECT * FROM early_access_signups ORDER BY created_at DESC;
  const submit = useServerFn(submitEarlyAccess);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      await submit({
        data: {
          email: trimmed,
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
          source: "early_access_section",
          sessionId: null,
          targetLanguage: null,
          currentDutchLevel: null,
        },
      });
      const eventProps = { source: "early_access_section", email_provided: true };
      // TEMP DEBUG: verify PostHog event firing for waitlist conversion
      console.log("waitlist_joined", eventProps);
      console.log("early_access_joined", eventProps);
      track("waitlist_joined", eventProps);
      track("early_access_joined", eventProps);
      // parent component reads localStorage flag below for dev panel state
      try { localStorage.setItem("clario_waitlist_joined", "1"); } catch {}
      setSubmitted(true);
    } catch (err) {
      console.error("waitlist_submit_failed", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
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
          Help shape NativeFlow.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Join the early access list to get new languages, features, and
          improvements before anyone else.
        </p>

        {submitted ? (
          <p className="mt-8 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
            You're on the early access list. Thank you!
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
              disabled={submitting}
            />
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 shrink-0 rounded-full px-6 shadow-md shadow-primary/20"
            >
              {submitting ? "Joining…" : "Join waitlist"}
            </Button>
          </form>
        )}
        {error && !submitted && (
          <p className="mt-3 text-sm font-medium text-destructive">{error}</p>
        )}
      </div>
    </section>
  );
}


function SourceBadge({ source }: { source: TranscriptSource }) {
  const map: Record<TranscriptSource, { label: string; cls: string }> = {
    cache: { label: "cached", cls: "bg-primary/10 text-primary" },
    youtube: { label: "youtube", cls: "bg-accent text-accent-foreground" },
    fallback: { label: "fallback", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
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
  manualText,
  setManualText,
  onSubmit,
  submitting,
  submitError,
}: {
  url: string;
  manualText: string;
  setManualText: (s: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">
        Or paste a transcript manually
      </p>
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
    <section className="relative pt-12 pb-14 sm:pt-16 sm:pb-18">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-20 -z-10 mx-auto h-[380px] max-w-5xl bg-[radial-gradient(ellipse_at_top,oklch(0.55_0.22_265/0.12),transparent_70%)]"
      />
      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm">
            🌍 Language Learning Beta
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[3rem] lg:leading-[1.05]">
            Understand real videos in any language{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              instantly.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Click any subtitle sentence while watching YouTube and get
            translations, explanations, and expressions in context.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              onClick={onStart}
              disabled={loading}
              className="h-11 gap-2 rounded-full px-5 text-sm font-medium shadow-lg shadow-primary/20"
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
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            See how NativeFlow works in under 30 seconds. No signup required.
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
    { t: "0:08", text: "Vandaag gaan we een nieuwe taal leren met echte content.", active: true },
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
            nativeflow.app / demo
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
                Vandaag gaan we een nieuwe taal leren…
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Translation
              </p>
              <p className="mt-1.5 text-sm font-medium text-foreground">
                "Today we're going to learn a new language with real content."
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
    { n: "01", icon: Tv, title: "Paste any YouTube video", desc: "Use any video in your target language — Dutch, English, Spanish, and more." },
    { n: "02", icon: MousePointerClick, title: "Click any subtitle sentence", desc: "Tap a line in the transcript while you watch." },
    { n: "03", icon: Brain, title: "Understand instantly", desc: "Get meaning, translation, and expressions in context." },
  ];
  return (
    <section id="how" className="border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">How it works</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Click any sentence. Understand it instantly.
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
    { emoji: "📺", icon: Tv, title: "Learn from real content", desc: "Stop relying only on textbook examples. Use videos you actually enjoy." },
    { emoji: "⚡", icon: Zap, title: "Instant understanding", desc: "No more pausing to search every phrase. Explanations appear as you watch." },
    { emoji: "🧠", icon: Brain, title: "Learn in context", desc: "Understand how natives actually speak — idioms, slang, and grammar where they appear." },
  ];
  return (
    <section id="why" className="border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Why NativeFlow</p>
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



function parseExplanation(text: string | null) {
  if (!text) return { translation: "", meaning: "", note: "" };
  const get = (label: string) => {
    const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im");
    const m = text.match(re);
    return m ? m[1].trim() : "";
  };
  return {
    translation: get("Translation"),
    meaning: get("Meaning"),
    note: get("Note") || get("Notes") || get("Expression Notes"),
  };
}

type ExplanationPanelEntry =
  | { status: "loading" }
  | { status: "ready"; translation: string; meaning: string; note: string }
  | { status: "error"; error: string };

function ExplanationPanel({
  sentence,
  entry,
  onClose,
  onReplay,
  onSave,
  isSaved,
  justSaved,
  saving,
}: {
  sentence: TranscriptSentence | null;
  entry: ExplanationPanelEntry | undefined;
  onClose: () => void;
  onReplay: () => void;
  onSave: () => void;
  isSaved: boolean;
  justSaved: boolean;
  saving: boolean;
}) {
  if (!sentence) {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-8 text-center shadow-md ring-1 ring-primary/10 animate-clario-pulse">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,oklch(0.55_0.22_265/0.12),transparent_70%)]"
        />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <MousePointerClick className="h-7 w-7" />
        </div>
        <p className="mt-5 text-lg font-semibold tracking-tight text-foreground">
          ▶︎ Press play — the explanation follows the video.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Or click any transcript sentence to jump to it. Translation, meaning, and expression notes appear right here.
        </p>
      </div>
    );
  }

  const ready = entry && entry.status === "ready" ? entry : null;
  const isLoading = !entry || entry.status === "loading";
  const error = entry && entry.status === "error" ? entry.error : null;
  const saveDisabled = saving || isSaved || !ready;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-md ring-1 ring-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Now playing
          </p>
          <p className="mt-2 text-lg font-semibold leading-snug text-foreground sm:text-xl">
            {sentence.text}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant={isSaved || justSaved ? "secondary" : "outline"}
            size="sm"
            onClick={onSave}
            disabled={saveDisabled}
            className="h-8 gap-1 px-2 text-xs"
            title={
              isSaved
                ? "Already in My Expressions"
                : ready
                  ? "Save to My Expressions"
                  : "Wait for explanation to load"
            }
          >
            {justSaved ? (
              <>
                <Check className="h-3.5 w-3.5" /> Saved
              </>
            ) : isSaved ? (
              <>
                <BookmarkCheck className="h-3.5 w-3.5" /> Saved
              </>
            ) : (
              <>
                <Bookmark className="h-3.5 w-3.5" /> Save
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReplay}
            className="h-8 gap-1 px-2 text-xs"
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

      {justSaved && (
        <p className="mt-2 text-xs font-medium text-primary">
          Saved to My Expressions ✓
        </p>
      )}


      <div className="mt-5 border-t border-border pt-5">
        {ready ? (
          <div className="space-y-5">
            {ready.translation && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                  Translation
                </h4>
                <p className="mt-1.5 text-base leading-relaxed text-foreground">
                  {ready.translation}
                </p>
              </div>
            )}
            {ready.meaning && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                  Meaning
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
                  {ready.meaning}
                </p>
              </div>
            )}
            {ready.note && ready.note !== "—" && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                  Expression Notes
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
                  {ready.note}
                </p>
              </div>
            )}
            {!ready.translation && !ready.meaning && !ready.note && (
              <FallbackHint />
            )}
          </div>
        ) : error ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <FallbackHint />
          </div>
        ) : (
          // Graceful fallback while the explanation is preloading — no spinner blocking the UI.
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Preparing translation, meaning, and notes for this sentence…
            </p>
            {isLoading && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FallbackHint() {
  return (
    <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      Explanation not available for this line — pause the video to read the
      original sentence above, or click another line.
    </p>
  );
}


function HowItWorksStrip() {
  const steps = [
    { icon: Tv, label: "Watch" },
    { icon: MousePointerClick, label: "Click a sentence" },
    { icon: Brain, label: "Understand instantly" },
  ];
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm sm:gap-3 sm:text-sm">
      {steps.map((s, i) => (
        <span key={s.label} className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <s.icon className="h-3.5 w-3.5" />
            </span>
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </span>
      ))}
    </div>
  );
}

function CustomVideoSection({
  url,
  setUrl,
  targetLang,
  setTargetLang,
  loading,
  onSubmit,
}: {
  url: string;
  setUrl: (v: string) => void;
  targetLang: string;
  setTargetLang: (v: string) => void;
  loading: boolean;
  onSubmit: (u: string) => void;
}) {
  const languages = [
    "English",
    "Dutch",
    "Spanish",
    "French",
    "German",
    "Italian",
    "Portuguese",
    "Japanese",
    "Chinese",
    "Korean",
    "Russian",
    "Arabic",
    "Turkish",
    "Polish",
    "Swedish",
    "Norwegian",
    "Danish",
    "Finnish",
    "Hindi",
    "Indonesian",
    "Vietnamese",
    "Thai",
    "Greek",
    "Czech",
  ];

  return (
    <section className="mt-2 mb-16 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Try your own YouTube video
        </h2>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
          Beta
        </span>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Beta feature. Most videos with subtitles work automatically.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const u = url.trim();
          if (!u) return;
          onSubmit(u);
        }}
        className="mt-6 space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          {/* YouTube URL */}
          <div className="space-y-1.5">
            <label
              htmlFor="custom-video-url"
              className="text-sm font-medium text-foreground"
            >
              YouTube URL
            </label>
            <Input
              id="custom-video-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste URL"
              className="h-11 w-full rounded-xl bg-background px-4"
            />
          </div>

          {/* Explanation language */}
          <div className="space-y-1.5">
            <label
              htmlFor="explanation-language"
              className="text-sm font-medium text-foreground"
            >
              Translate explanations into
            </label>
            <Select
              value={targetLang}
              onValueChange={setTargetLang}
            >
              <SelectTrigger
                id="explanation-language"
                className="h-11 w-full rounded-xl bg-background px-4"
              >
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Choose the language used for explanations and translations.
        </p>

        <Button
          type="submit"
          disabled={loading || !url.trim()}
          className="h-11 gap-2 rounded-xl px-6 text-sm font-medium"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Analyze Video
            </>
          )}
        </Button>
      </form>
    </section>
  );
}

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const HERO_LANGUAGES = [
  "English","Dutch","Spanish","French","German","Italian","Portuguese",
  "Japanese","Chinese","Korean","Russian","Arabic","Turkish","Polish",
  "Swedish","Norwegian","Danish","Finnish","Hindi","Indonesian",
  "Vietnamese","Thai","Greek","Czech",
];

function PrimaryHero({
  url, setUrl, targetLang, setTargetLang, loading, onSubmit, onStartDemo,
}: {
  url: string;
  setUrl: (v: string) => void;
  targetLang: string;
  setTargetLang: (v: string) => void;
  loading: boolean;
  onSubmit: (u: string) => void;
  onStartDemo: () => void;
}) {
  return (
    <section className="relative pt-14 pb-10 sm:pt-20 sm:pb-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-20 -z-10 mx-auto h-[520px] max-w-5xl bg-[radial-gradient(ellipse_at_top,oklch(0.55_0.22_265/0.18),transparent_70%)]"
      />
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm">
          <Sparkles className="h-3 w-3 text-primary" /> Works with any YouTube video
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
          Turn any YouTube video into an{" "}
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            interactive language lesson.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Learn Dutch, English, Spanish, French, German and more from content you already enjoy watching.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const u = url.trim();
          if (!u) return;
          onSubmit(u);
        }}
        className="mx-auto mt-10 max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-lg shadow-primary/10 sm:p-6"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <div className="space-y-1.5">
            <label htmlFor="hero-url" className="text-xs font-medium text-foreground">
              YouTube URL
            </label>
            <Input
              id="hero-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste any YouTube URL in your target language"
              className="h-12 w-full rounded-xl bg-background px-4 text-base"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="hero-lang" className="text-xs font-medium text-foreground">
              Explanation language
            </label>
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger id="hero-lang" className="h-12 w-full rounded-xl bg-background px-4">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {HERO_LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          type="submit"
          disabled={loading || !url.trim()}
          size="lg"
          className="mt-4 h-12 w-full gap-2 rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Preparing your video…</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Understand This Video</>
          )}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Works best with videos that contain subtitles.
        </p>
      </form>

      <div className="mx-auto mt-5 flex max-w-3xl flex-col items-center gap-1 text-center">
        <button
          type="button"
          onClick={onStartDemo}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
        >
          <PlayCircle className="h-4 w-4" /> Not sure where to start? Try the Dutch Demo
        </button>
      </div>
    </section>
  );
}

function LanguageSupportSection() {
  const languages = ["Dutch", "English", "Spanish", "French", "German", "Italian", "Portuguese"];
  return (
    <section className="pb-6 sm:pb-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Supported languages:</span>
          {languages.map((lang) => (
            <span
              key={lang}
              className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-sm"
            >
              {lang}
            </span>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          More languages can be added automatically when transcripts are available.
        </p>
      </div>
    </section>
  );
}

function ValuePropositionSection() {
  const items = [
    { title: "Learn from content you actually enjoy", desc: "Use the videos you already watch — no artificial lessons." },
    { title: "Follow transcripts while watching", desc: "Sentences highlight in sync with the video." },
    { title: "Instantly translate unknown words", desc: "Click any sentence for a natural translation." },
    { title: "Build vocabulary in context", desc: "Expressions and idioms explained where they appear." },
    { title: "Practice with real native content", desc: "Understand how people actually speak." },
  ];
  return (
    <section className="border-t border-border py-14 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Why it works</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Learn a language without changing your habits.
        </h2>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
          >
            <h3 className="text-sm font-semibold tracking-tight text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LoadingProgress() {
  const steps = [
    "Finding subtitles…",
    "Preparing transcript…",
    "Generating explanations…",
    "Ready to watch.",
  ];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timers = [
      window.setTimeout(() => setActive(1), 1200),
      window.setTimeout(() => setActive(2), 3000),
      window.setTimeout(() => setActive(3), 6000),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);
  const pct = Math.min(95, (active + 1) * 24);
  return (
    <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-md">
      <p className="text-center text-sm font-semibold uppercase tracking-wider text-primary">
        Preparing your video
      </p>
      <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="mt-6 space-y-3">
        {steps.map((s, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : current
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground"
                }`}
              >
                {done ? "✓" : current ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={
                  done
                    ? "text-foreground"
                    : current
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }
              >
                {s}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ValueCards() {
  const cards = [
    { emoji: "🎬", title: "Watch real content", desc: "Any YouTube video, in your target language." },
    { emoji: "💡", title: "Understand difficult sentences instantly", desc: "Translations and meaning appear as you watch." },
    { emoji: "🧠", title: "Learn expressions in context", desc: "Idioms, slang, and grammar explained where they appear." },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.title}
          className="rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="text-xl">{c.emoji}</div>
          <p className="mt-2 text-sm font-semibold tracking-tight text-foreground">
            {c.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {c.desc}
          </p>
        </div>
      ))}
    </div>
  );
}

function ReadinessBadges({ videoId }: { videoId: string | null }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(t);
  }, [videoId]);
  if (!visible || !videoId) return null;
  const items = ["Video ready", "Transcript loaded", "Explanations available"];
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs animate-fade-in">
      {items.map((label) => (
        <span
          key={label}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-medium text-primary"
        >
          ✅ {label}
        </span>
      ))}
    </div>
  );
}
