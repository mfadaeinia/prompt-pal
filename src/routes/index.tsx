import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchTranscript,
  fetchTranscriptFast,
  saveManualTranscript,
  type TranscriptSentence,
  type TranscriptSource,
  type TranscriptQualityReport,
  type FetchTranscriptFastResult,
  type FetchTranscriptResult,
} from "@/lib/transcript.functions";


import { explainSentence } from "@/lib/explain.functions";
import { submitEarlyAccess } from "@/lib/early-access.functions";
import { recordVideoSession } from "@/lib/video-sessions.functions";
import {
  saveExpression,
  listSavedExpressions,
} from "@/lib/saved-expressions.functions";
import { logLibraryEvent } from "@/lib/library-events.functions";
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
import { MarketingLanding } from "@/components/MarketingLanding";

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
      { property: "og:url", content: "https://native-lens.lovable.app/" },
      { name: "twitter:title", content: "NativeFlow — Learn languages from YouTube" },
      { name: "twitter:description", content: "Turn any YouTube video into an interactive language lesson." },
    ],
    links: [
      { rel: "canonical", href: "https://native-lens.lovable.app/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "NativeFlow",
          applicationCategory: "EducationApplication",
          operatingSystem: "Web",
          url: "https://native-lens.lovable.app/",
          description:
            "Turn any YouTube video into an interactive language lesson with sentence-level translations and explanations.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  const fetchTx = useServerFn(fetchTranscript);
  const fetchTxFast = useServerFn(fetchTranscriptFast);
  const saveManualTx = useServerFn(saveManualTranscript);
  const explainFx = useServerFn(explainSentence);
  const saveExpressionFx = useServerFn(saveExpression);
  const listSavedFx = useServerFn(listSavedExpressions);
  const logLibraryEventFx = useServerFn(logLibraryEvent);
  const qc = useQueryClient();




  const [url, setUrl] = useState("");
  // targetLang = learner's help/translation language (used by explainSentence).
  const [targetLang, setTargetLang] = useState("English");
  // spokenLang = language ACTUALLY spoken in the video, sent to the transcript
  // provider. "" means auto/original (let the provider pick the original track).
  // MUST be ISO-639-1 (e.g. "en", "nl") because that's what YouTube/OpenAI
  // expect. Never pass `targetLang` here — it would request an auto-translated
  // caption track and produce the wrong-language transcript bug.
  const [spokenLang, setSpokenLang] = useState<string>("");
  const [transcriptLanguage, setTranscriptLanguage] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [sentences, setSentences] = useState<TranscriptSentence[]>([]);
  const [selected, setSelected] = useState<TranscriptSentence | null>(null);
  const [transcriptSource, setTranscriptSource] = useState<TranscriptSource | null>(null);
  const [cachedFromProvider, setCachedFromProvider] = useState<string | null>(null);
  const [transcriptQuality, setTranscriptQuality] = useState<TranscriptQualityReport | null>(null);
  // Anti-stale-transcript guards. requestSeqRef monotonically increments per
  // user-initiated load; only the latest seq is allowed to write to UI state.
  // requestedVideoId tracks what the user just asked for so we can compare
  // against the server response and refuse mismatches.
  const requestSeqRef = useRef(0);
  const [requestedVideoId, setRequestedVideoId] = useState<string | null>(null);
  const [transcriptVideoId, setTranscriptVideoId] = useState<string | null>(null);
  const [transcriptCacheRowId, setTranscriptCacheRowId] = useState<string | null>(null);
  const [transcriptCacheKey, setTranscriptCacheKey] = useState<string | null>(null);
  const [transcriptLoadedAt, setTranscriptLoadedAt] = useState<string | null>(null);
  const [transcriptRawChunks, setTranscriptRawChunks] = useState<{ text: string; offset: number; duration: number }[]>([]);
  const [limitedMode, setLimitedMode] = useState(false);
  const [qualityBannerDismissed, setQualityBannerDismissed] = useState(false);
  const [manualText, setManualText] = useState("");
  const [view, setView] = useState<"landing" | "demo">(() => {
    if (typeof window === "undefined") return "landing";
    return new URLSearchParams(window.location.search).get("v") ? "demo" : "landing";
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackTrigger, setFeedbackTrigger] = useState<string>("");
  const isMobile = useIsMobile();
  const [studyMode, setStudyMode] = useState(true);
  // Focus Mode: transcript auto-follows. Transcript Mode: user controls scrolling.
  const [focusMode, setFocusMode] = useState(true);
  const [browserId, setBrowserId] = useState("");
  const [justSavedId, setJustSavedId] = useState<number | null>(null);
  const [showSavedTooltip, setShowSavedTooltip] = useState(false);
  const [showManualTranscript, setShowManualTranscript] = useState(false);
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

  // ── Transcript loading state machine ───────────────────────────────────
  // idle → checking_cache → looking_for_captions → generating_transcript
  //      → building_sentences → (ready | partial | failed)
  // The fast path resolves to ready directly when cache or YouTube captions
  // hit. Only ASR fallbacks pass through "generating_transcript".
  type TranscriptStatus =
    | "idle"
    | "checking_cache"
    | "looking_for_captions"
    | "generating_transcript"
    | "building_sentences"
    | "ready"
    | "partial"
    | "failed";
  const [transcriptStatus, setTranscriptStatus] = useState<TranscriptStatus>("idle");
  const [slowTimeoutLevel, setSlowTimeoutLevel] = useState<0 | 1 | 2>(0); // 0 normal, 1 "still working", 2 timed out
  const loadStartedAtRef = useRef<number | null>(null);
  const slowStartedAtRef = useRef<number | null>(null);
  const [perfTimings, setPerfTimings] = useState<{
    time_to_video_ready_ms: number | null;
    time_to_first_sentence_ms: number | null;
    time_to_full_transcript_ms: number | null;
    time_to_transcript_ms: number | null;
    time_to_first_clickable_sentence_ms: number | null;
    time_to_first_explanation_ms: number | null;
    provider_used: string | null;
    cache_hit: boolean | null;
  }>({
    time_to_video_ready_ms: null,
    time_to_first_sentence_ms: null,
    time_to_full_transcript_ms: null,
    time_to_transcript_ms: null,
    time_to_first_clickable_sentence_ms: null,
    time_to_first_explanation_ms: null,
    provider_used: null,
    cache_hit: null,
  });
  const [stageTimings, setStageTimings] = useState<{
    total_server_ms: number | null;
    cache_lookup_ms: number | null;
    youtube_caption_attempt_ms: number | null;
    audio_extract_ms: number | null;
    audio_download_ms: number | null;
    openai_transcription_ms: number | null;
    chunk_mapping_ms: number | null;
    sentence_build_ms: number | null;
    cache_write_ms: number | null;
    provider_used: string | null;
    cache_hit: boolean | null;
    audio_size_mb: number | null;
    openai_segments_count: number | null;
    sentence_count: number | null;
    video_duration_seconds: number | null;
  } | null>(null);
  const [reactStateUpdateMs, setReactStateUpdateMs] = useState<number | null>(null);
  const firstExplanationClickAtRef = useRef<number | null>(null);
  // Open SSE connection for in-flight progressive transcription. We hold a
  // ref so submitLoad() can close any prior stream before starting a new one.
  const streamRef = useRef<EventSource | null>(null);


  // Final-failure gate (unchanged): below this many sentences after the
  // pipeline finishes, we show the dedicated failure card instead of
  // Learning Mode.
  const MIN_LEARNING_SENTENCES = 5;
  const hasUsableTranscript = sentences.length >= MIN_LEARNING_SENTENCES;
  // Early-unlock gate for partial readiness — Learning Mode becomes
  // available as soon as we have a usable first batch, even if the full
  // transcript is still being processed.
  // Unlock Learning Mode as soon as we have ANY sentence — AI enrichment is lazy.
  const learningModeUnlocked = sentences.length > 0;
  const processingStatus: "success" | "partial_success" | "failed" =
    sentences.length >= MIN_LEARNING_SENTENCES
      ? "success"
      : sentences.length > 0
        ? "partial_success"
        : "failed";


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
      void logLibraryEventFx({
        data: {
          eventName: "expression_saved",
          sessionId: browserId,
          videoId: videoId ?? null,
          metadata: { source: "explanation_panel" },
        },
      }).catch(() => {});
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
      void logLibraryEventFx({
        data: {
          eventName: "expression_saved",
          sessionId: browserId,
          videoId: videoId ?? null,
          metadata: { source: "text_selection", selected_length: text.length },
        },
      }).catch(() => {});
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
        if (localStorage.getItem("nativeflow_feedback_given") === "1") {
          feedbackShownRef.current = true;
          return;
        }
        const last = localStorage.getItem("nativeflow_feedback_dismissed_at");
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
    submitLoad(v);
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

  // Track when the limited-mode quality banner is shown.
  useEffect(() => {
    if (
      transcriptQuality &&
      transcriptQuality.quality === "low" &&
      !qualityBannerDismissed
    ) {
      track("limited_mode_shown", {
        video_id: videoId,
        reasons: transcriptQuality.reasons,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptQuality?.quality, qualityBannerDismissed]);

  const startDemo = () => {
    setUrl(DEMO_VIDEO_URL);
    setTargetLang(DEMO_LANGUAGE);
    setView("demo");
    track("demo_started", { video_id: DEMO_VIDEO_ID });
    if (videoId !== DEMO_VIDEO_ID) {
      submitLoad(DEMO_VIDEO_URL);
    }
    demoStartTimeRef.current = performance.now();
    // First-time onboarding
    try {
      if (typeof window !== "undefined" && !localStorage.getItem("nativeflow_onboarded")) {
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
      localStorage.setItem("nativeflow_onboarded", "1");
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

  // Tiny URL → 11-char video ID extractor (mirrors the server-side regex).
  function extractVideoIdClient(u: string): string | null {
    try {
      const m = u.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  type LoadVars = { url: string; seq: number; requestedVideoId: string | null };

  const loadMutation = useMutation({
    mutationFn: async (vars: LoadVars) => {
      console.log("[transcript-debug][client] submitting URL:", vars.url, "seq:", vars.seq, "requestedVideoId:", vars.requestedVideoId);
      loadStartedAtRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      slowStartedAtRef.current = null;
      setSlowTimeoutLevel(0);
      setTranscriptStatus("checking_cache");

      // ── Fast path: cache + YouTube captions only ────────────────────────
      const fast: FetchTranscriptFastResult = await fetchTxFast({
        data: { url: vars.url, spokenLanguage: spokenLang || undefined },
      });

      if (fast.status === "ready") {
        return { res: fast.result, vars, viaSlowPath: false };
      }

      // ── Slow path: progressive Whisper via SSE ──────────────────────────
      if (vars.seq !== requestSeqRef.current) {
        return { res: null, vars, viaSlowPath: false, aborted: true } as const;
      }
      setTranscriptStatus("generating_transcript");
      slowStartedAtRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();

      // Close any prior stream defensively.
      if (streamRef.current) {
        try { streamRef.current.close(); } catch {}
        streamRef.current = null;
      }

      const langParam = (spokenLang || "").trim() || "nl";
      const streamUrl =
        `/api/public/transcript-stream` +
        `?url=${encodeURIComponent(vars.url)}` +
        `&lang=${encodeURIComponent(langParam)}`;

      const firstChunkPromise = new Promise<{
        res: FetchTranscriptResult;
        vars: LoadVars;
        viaSlowPath: true;
        streaming: true;
      }>((resolve, reject) => {
        const es = new EventSource(streamUrl);
        streamRef.current = es;
        const mySeq = vars.seq;
        let resolved = false;
        let lastVideoId = fast.videoId ?? vars.requestedVideoId ?? null;
        let detected: string | null = null;

        const closeStream = () => {
          try { es.close(); } catch {}
          if (streamRef.current === es) streamRef.current = null;
        };

        es.addEventListener("job", (ev) => {
          try {
            const d = JSON.parse((ev as MessageEvent).data);
            if (d?.videoId) lastVideoId = d.videoId;
          } catch {}
        });

        es.addEventListener("chunk", (ev) => {
          if (mySeq !== requestSeqRef.current) {
            closeStream();
            return;
          }
          let d: any = null;
          try { d = JSON.parse((ev as MessageEvent).data); } catch { return; }
          const sentences: TranscriptSentence[] = Array.isArray(d?.sentences) ? d.sentences : [];
          if (d?.detectedLanguage) detected = d.detectedLanguage;

          if (!resolved) {
            resolved = true;
            const synthetic: FetchTranscriptResult = {
              videoId: String(lastVideoId ?? ""),
              sentences,
              source: "asr",
              cachedFromProvider: null,
              language: detected,
              spokenLanguage: spokenLang || null,
              transcriptLanguage: detected,
              cacheHit: false,
              quality: {
                quality: "high",
                reasons: [],
                metrics: {
                  sentenceCount: sentences.length,
                  avgWordsPerSentence: 0,
                  shortFragmentRatio: 0,
                  hasPunctuationInRaw: true,
                },
              },
              rawChunks: [],
              stageTimings: undefined,
            };
            resolve({ res: synthetic, vars, viaSlowPath: true, streaming: true });
          } else {
            // Subsequent chunks — append in place. Server sends the full
            // running list each time, so just replace.
            setSentences(sentences);
            setTranscriptStatus("partial");
            if (detected) setTranscriptLanguage(detected);
          }
        });

        es.addEventListener("complete", (ev) => {
          if (mySeq !== requestSeqRef.current) {
            closeStream();
            return;
          }
          let d: any = null;
          try { d = JSON.parse((ev as MessageEvent).data); } catch {}
          const fullMs = Number(d?.time_to_full_transcript_ms ?? 0);
          setTranscriptStatus("ready");
          setPerfTimings((prev) => ({
            ...prev,
            time_to_full_transcript_ms: fullMs || prev.time_to_full_transcript_ms,
          }));
          track("transcript_full_ready", {
            video_id: lastVideoId,
            time_to_full_transcript_ms: fullMs,
          });
          closeStream();
        });

        es.addEventListener("error", (ev) => {
          // SSE 'error' fires for both server-sent error events and transport
          // failures. If we already resolved, keep what we have; otherwise reject.
          let payload: any = null;
          try { payload = JSON.parse((ev as MessageEvent).data ?? ""); } catch {}
          const msg = payload?.message || "transcript stream failed";
          if (resolved) {
            // Partial transcript already showing — promote to "ready" so the
            // UI stops the spinner; user has something to learn from.
            setTranscriptStatus("ready");
          } else {
            reject(Object.assign(new Error(msg), { errorType: "asr_failed" }));
          }
          closeStream();
        });
      });

      return await firstChunkPromise;
    },

    onSuccess: (payload) => {
      const { res, vars } = payload;
      // Aborted mid-flight by a newer submission.
      if (!res || (payload as any).aborted) return;
      // Race-condition guard: discard any response that isn't the latest request.
      if (vars.seq !== requestSeqRef.current) {
        console.warn("[transcript-debug][client] discarding stale response", {
          responseSeq: vars.seq,
          latestSeq: requestSeqRef.current,
          returnedVideoId: res.videoId,
          requestedVideoId: vars.requestedVideoId,
        });
        return;
      }
      // Server-side mismatch guard: refuse to render a transcript whose
      // returned video_id does not match what the user asked for.
      if (vars.requestedVideoId && res.videoId !== vars.requestedVideoId) {
        console.error("[transcript-debug][client] ❌ video_id mismatch — refusing to apply", {
          requestedVideoId: vars.requestedVideoId,
          returnedVideoId: res.videoId,
          cacheRowId: res.provenance?.cacheRowId,
          cacheKey: res.provenance?.cacheKey,
        });
        return;
      }

      setVideoId(res.videoId);
      setTranscriptVideoId(res.videoId);
      setSentences(res.sentences);
      setTranscriptRawChunks(res.rawChunks ?? []);
      if (res.sentences.length < MIN_LEARNING_SENTENCES) {
        console.error("[learning-mode][gate] transcript not usable", {
          videoId: res.videoId,
          transcriptLength: res.sentences.reduce((n, s) => n + s.text.length, 0),
          sentenceCount: res.sentences.length,
          transcriptSource: res.source,
          processingStage: "post_segmentation",
        });
        setTranscriptStatus("failed");
      } else if ((payload as any).streaming) {
        // First chunk arrived; transcription continues in background.
        setTranscriptStatus("partial");
      } else {
        setTranscriptStatus("ready");
      }
      setSlowTimeoutLevel(0);

      // ── Performance timings ───────────────────────────────────────────
      const reactStateStart =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const now = reactStateStart;
      const startedAt = loadStartedAtRef.current ?? now;
      const elapsed = Math.round(now - startedAt);
      const serverTimings = (res as any).stageTimings as
        | {
            total_server_ms: number | null;
            cache_lookup_ms: number | null;
            youtube_caption_attempt_ms: number | null;
            audio_extract_ms: number | null;
            audio_download_ms: number | null;
            openai_transcription_ms: number | null;
            chunk_mapping_ms: number | null;
            sentence_build_ms: number | null;
            cache_write_ms: number | null;
            provider_used: string | null;
            cache_hit: boolean | null;
            audio_size_mb: number | null;
            openai_segments_count: number | null;
            sentence_count: number | null;
            video_duration_seconds: number | null;
          }
        | undefined;
      setStageTimings(serverTimings ?? null);
      // Best-effort react state update window (microtask-resolution).
      Promise.resolve().then(() => {
        const after =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        setReactStateUpdateMs(Math.round(after - reactStateStart));
      });
      // Single structured console line for one real product load.
      try {
        console.log(
          "[transcript-timing][client]",
          JSON.stringify({
            video_id: res.videoId,
            time_to_video_ready_ms: elapsed,
            time_to_first_clickable_sentence_ms: elapsed,
            provider_used: res.cachedFromProvider ?? res.source,
            cache_hit: !!res.cacheHit,
            ...(serverTimings ?? {}),
          }),
        );
      } catch {}
      setPerfTimings((prev) => ({
        ...prev,
        time_to_video_ready_ms: elapsed,
        time_to_first_sentence_ms: elapsed,
        time_to_full_transcript_ms: elapsed,
        time_to_transcript_ms: elapsed,
        time_to_first_clickable_sentence_ms: elapsed,
        provider_used: res.cachedFromProvider ?? res.source,
        cache_hit: !!res.cacheHit,
      }));


      setSelected(null);
      setTranscriptSource(res.source);
      setCachedFromProvider(res.cachedFromProvider ?? null);
      setTranscriptCacheRowId(res.provenance?.cacheRowId ?? null);
      setTranscriptCacheKey(res.provenance?.cacheKey ?? null);
      setTranscriptLoadedAt(new Date().toISOString());
      setTranscriptLanguage(
        (res as any).transcriptLanguage ?? res.language ?? null,
      );
      setTranscriptQuality(res.quality);
      setLimitedMode(res.quality.quality === "low");
      setQualityBannerDismissed(false);
      setVideoTitle(null);
      track("transcript_quality_detected", {
        video_id: res.videoId,
        quality: res.quality.quality,
        reasons: res.quality.reasons.join(","),
        sentence_count: res.quality.metrics.sentenceCount,
        avg_words_per_sentence: res.quality.metrics.avgWordsPerSentence,
      });
      track("transcript_first_sentence", {
        video_id: res.videoId,
        provider_used: res.cachedFromProvider ?? res.source,
        cache_hit: !!res.cacheHit,
        elapsed_ms: elapsed,
        via_slow_path: (payload as any).viaSlowPath ?? false,
      });
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

      track(res.cacheHit ? "cache_hit" : "cache_miss", {
        video_id: res.videoId,
        source: res.source,
      });
      const evt =
        res.source === "cache"
          ? "transcript_loaded_from_cache"
          : res.source === "youtube"
          ? "transcript_loaded_from_youtube"
          : res.source === "fallback"
          ? "transcript_loaded_from_fallback_provider"
          : "transcript_loaded_manually";
      track(evt, {
        video_url: vars.url,
        video_id: res.videoId,
        selected_language: targetLang,
      });
      track("video_loaded", {
        video_url: vars.url,
        video_id: res.videoId,
        selected_language: targetLang,
        source: res.source,
      });
      if (vars.url !== DEMO_VIDEO_URL) {
        track("custom_video_loaded", {
          video_url: vars.url,
          video_id: res.videoId,
          source: res.source,
        });
      }
    },
    onError: (err: any, vars) => {
      console.error("[transcript-debug][client] fetch failed", {
        url: vars.url,
        seq: vars.seq,
        errorType: err?.errorType,
        providerMessage: err?.providerMessage,
        message: err?.message,
      });
      if (vars.seq === requestSeqRef.current) setTranscriptStatus("failed");
      const isDemo = vars.url === DEMO_VIDEO_URL;
      track("transcript_fetch_failed", {
        video_url: vars.url,
        error_type: err?.errorType ?? "unknown",
      });
      if (!isDemo) {
        track("custom_video_failed", {
          video_url: vars.url,
          error_type: err?.errorType ?? "unknown",
        });
      }
    },
  });


  // Single entry point for kicking off a transcript load. Always go through
  // this — it allocates the next request seq, resets transcript-bound UI
  // state synchronously (so the previous video's transcript can never linger
  // on screen), and submits the mutation with the seq attached.
  const submitLoad = (u: string) => {
    const requestedId = extractVideoIdClient(u);
    requestSeqRef.current += 1;
    const seq = requestSeqRef.current;
    // Tear down any in-flight progressive stream from a previous URL.
    if (streamRef.current) {
      try { streamRef.current.close(); } catch {}
      streamRef.current = null;
    }
    setRequestedVideoId(requestedId);
    setTranscriptVideoId(null);
    setSentences([]);
    setTranscriptRawChunks([]);
    setSelected(null);
    setTranscriptSource(null);
    setCachedFromProvider(null);
    setTranscriptCacheRowId(null);
    setTranscriptCacheKey(null);
    setTranscriptLoadedAt(null);
    setTranscriptQuality(null);
    setVideoTitle(null);
    setTranscriptStatus("checking_cache");
    setSlowTimeoutLevel(0);
    setPerfTimings({
      time_to_video_ready_ms: null,
      time_to_first_sentence_ms: null,
      time_to_full_transcript_ms: null,
      time_to_transcript_ms: null,
      time_to_first_clickable_sentence_ms: null,
      time_to_first_explanation_ms: null,
      provider_used: null,
      cache_hit: null,
    });
    firstExplanationClickAtRef.current = null;
    // Switch the player to the new video immediately. videoId drives the
    // iframe src and the explanation-cache reset effect.
    if (requestedId) setVideoId(requestedId);
    loadMutation.mutate({ url: u, seq, requestedVideoId: requestedId });
  };

  // 15s / 45s slow-path messaging. Only ticks while the ASR fallback is
  // genuinely in flight (status === "generating_transcript").
  useEffect(() => {
    if (transcriptStatus !== "generating_transcript") {
      setSlowTimeoutLevel(0);
      return;
    }
    const t15 = window.setTimeout(() => setSlowTimeoutLevel(1), 15000);
    const t45 = window.setTimeout(() => setSlowTimeoutLevel(2), 45000);
    return () => {
      window.clearTimeout(t15);
      window.clearTimeout(t45);
    };
  }, [transcriptStatus]);


  // Hard gate: never allow Learning Mode when transcript isn't usable.
  useEffect(() => {
    if (transcriptStatus === "failed" && studyMode) {
      setStudyMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptStatus]);





  const manualMutation = useMutation({
    mutationFn: async (vars: { url: string; text: string }) =>
      saveManualTx({ data: vars }),
    onSuccess: (res) => {
      setVideoId(res.videoId);
      setSentences(res.sentences);
      setSelected(null);
      setTranscriptSource("manual");
      setCachedFromProvider(null);
      setTranscriptQuality(res.quality);
      setLimitedMode(res.quality.quality === "low");
      setQualityBannerDismissed(false);
      setManualText("");
      setTranscriptStatus("ready");
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

  // Track when transcript failure screen is shown.
  const failureTrackedRef = useRef(false);
  useEffect(() => {
    if (loadMutation.isError && !failureTrackedRef.current) {
      failureTrackedRef.current = true;
      track("transcript_failure_screen_shown", {
        video_url: url,
        error_type: (loadMutation.error as any)?.errorType ?? "unknown",
      });
    }
    if (!loadMutation.isError) {
      failureTrackedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMutation.isError]);



  // Explanation cache: sentenceId -> parsed explanation (or loading/error).
  type ExplanationEntry =
    | { status: "loading" }
    | { status: "ready"; translation: string; meaning: string; vocabulary: string; note: string }
    | { status: "error"; error: string };
  const [explanationCache, setExplanationCache] = useState<
    Record<number, ExplanationEntry>
  >({});
  const inFlightRef = useRef<Set<number>>(new Set());

  function ensureExplanation(
    s: TranscriptSentence,
    sList = sentences,
    opts: { isPrefetch?: boolean } = {},
  ) {
    if (explanationCache[s.id] || inFlightRef.current.has(s.id)) {
      // Even if cached/loading, still kick off prefetch for N+1 on a real click.
      if (!opts.isPrefetch) {
        const idx = sList.findIndex((x) => x.id === s.id);
        const next = idx >= 0 ? sList[idx + 1] : undefined;
        if (next) ensureExplanation(next, sList, { isPrefetch: true });
      }
      return;
    }
    if (!opts.isPrefetch && firstExplanationClickAtRef.current == null) {
      firstExplanationClickAtRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
    }
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
        if (!opts.isPrefetch && firstExplanationClickAtRef.current != null) {
          const now =
            typeof performance !== "undefined" ? performance.now() : Date.now();
          const delta = Math.round(now - firstExplanationClickAtRef.current);
          setPerfTimings((prev) =>
            prev.time_to_first_explanation_ms == null
              ? { ...prev, time_to_first_explanation_ms: delta }
              : prev,
          );
        }
        // Background prefetch of next sentence (only when this was a real click).
        if (!opts.isPrefetch) {
          const next = idx >= 0 ? sList[idx + 1] : undefined;
          if (next) ensureExplanation(next, sList, { isPrefetch: true });
        }
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

  // Explanations are generated lazily on click (plus a single N+1 prefetch
  // inside ensureExplanation). We intentionally do NOT bulk-preload all
  // sentences here — that delayed time-to-first-learning and burned credits
  // for sentences the user may never visit.


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
            }, 80);

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
  // Compensate for YT API getCurrentTime latency + polling interval so the
  // highlight tracks the audio the user actually hears.
  const SYNC_OFFSET_SECONDS = 0.2;


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

    // Use offset math so we ONLY move the transcript container — never the
    // window, never the video, never the explanation panel.
    const cHeight = container.clientHeight;
    const eTop = el.offsetTop;
    const eHeight = el.offsetHeight;
    const scrollTop = container.scrollTop;
    const visibleTop = eTop - scrollTop;
    const visibleBottom = visibleTop + eHeight;
    const fullyVisible = visibleTop >= 0 && visibleBottom <= cHeight;
    setActiveOutOfView(!fullyVisible);

    // Transcript Mode: user owns the scroll. Never auto-scroll.
    if (!focusMode) return;
    // Never fight a user who is actively scrolling the transcript.
    if (performance.now() < userScrollingUntilRef.current) return;

    // Teleprompter target: keep the active sentence ~28% from the top of
    // the transcript viewport. Only scroll when it drifts meaningfully
    // out of that band so we don't jitter on every sentence.
    const targetVisibleTop = cHeight * 0.28;
    const drift = visibleTop - targetVisibleTop;
    const band = cHeight * 0.18; // dead-zone around the target
    if (Math.abs(drift) < band && fullyVisible) return;

    const desiredScrollTop = Math.max(0, eTop - targetVisibleTop);
    container.scrollTo({ top: desiredScrollTop, behavior: "smooth" });
  }, [playingId, focusMode]);

  function jumpToCurrentSentence() {
    if (!playingId || !listRef.current) return;
    const container = listRef.current;
    const el = container.querySelector<HTMLElement>(`[data-sid="${playingId}"]`);
    if (el) {
      const targetVisibleTop = container.clientHeight * 0.28;
      container.scrollTo({
        top: Math.max(0, el.offsetTop - targetVisibleTop),
        behavior: "smooth",
      });
      setActiveOutOfView(false);
      // Resume auto-tracking immediately.
      userScrollingUntilRef.current = 0;
      track("transcript_jump_to_current_clicked", { video_id: videoId });
    }
  }

  // Auto-sync explanation panel with the currently playing sentence.
  // Fires `transcript_sentence_auto_explained` when the panel switches
  // sentence due to playback (not user click — those go via jumpTo).
  const lastAutoExplainedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!studyMode) return;
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
  }, [playingId, sentences, studyMode]);

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
    if (studyMode) {
      setSelected(s);
      if (!limitedMode) ensureExplanation(s, sentences);
    }
    seekAndPlay(s);
    const idx = sentences.findIndex((x) => x.id === s.id);
    clickCountRef.current += 1;
    uniqueClickedRef.current.add(idx);
    track("transcript_sentence_clicked", {
      sentence_index: idx,
      sentence_text: s.text,
      sentence_start_time: s.offset,
      video_id: videoId,
      mode: studyMode ? "learning" : "watch",
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2">
            {view === "demo" && (
              <button
                onClick={goHome}
                className="mr-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground hover:bg-accent sm:px-3"
                aria-label="Back to home"
              >
                <span aria-hidden>←</span>
                <span className="hidden sm:inline">Back to Home</span>
              </button>
            )}
            <button
              onClick={goHome}
              className="flex min-w-0 items-center gap-2.5"
              aria-label="NativeFlow home"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="truncate text-base font-semibold tracking-tight">NativeFlow</span>
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button onClick={() => navTo("why")} className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">Why NativeFlow</button>
            <button onClick={() => navTo("early-access")} className="hidden text-sm text-muted-foreground hover:text-foreground md:inline">Early access</button>
            {devPanelEnabled && (
              <Link
                to="/founder"
                className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
              >
                Founder
              </Link>
            )}
            <div className="relative">
              <Link
                to="/saved"
                className="relative inline-flex items-center gap-1.5 rounded-full border border-border bg-card p-2 text-xs font-medium text-foreground hover:bg-accent sm:px-3 sm:py-1.5"
                onClick={() => {
                  track("my_expressions_opened", { from: view });
                  setShowSavedTooltip(false);
                  localStorage.setItem("nativeflow_saved_tooltip_seen", "1");
                }}
                aria-label="My Library"
                title="My Library"
              >
                <Bookmark className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">My Library</span>
                {savedQuery.data && (savedQuery.data.items ?? []).length > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground ring-2 ring-background sm:static sm:ring-0">
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
              <Button size="sm" onClick={startDemo} className="h-9 rounded-full px-3 text-xs sm:px-4">
                <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> Try Demo
              </Button>
            )}
          </div>
        </div>
      </header>


      {view === "landing" && (
        <MarketingLanding
          onStartDemo={startDemo}
          conversionSlot={
            <PrimaryHero
              url={url}
              setUrl={setUrl}
              targetLang={targetLang}
              setTargetLang={setTargetLang}
              spokenLang={spokenLang}
              setSpokenLang={setSpokenLang}
              loading={loadMutation.isPending}
              onSubmit={(u) => {
                track("custom_video_attempted", { video_url: u, spoken_language: spokenLang || "auto" });
                setView("demo");
                submitLoad(u);
              }}
              onStartDemo={startDemo}
            />
          }
        />
      )}

      <main className="mx-auto max-w-6xl px-6">
        {view === "landing" && <EarlyAccessSection />}




        {view === "demo" && loadMutation.isPending && !videoId && (
          <LoadingProgress />
        )}




        {view === "demo" && loadMutation.isError && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
              <p className="text-lg font-semibold text-foreground">
                We couldn't load subtitles for this video.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-md mx-auto">
                Some videos don't provide subtitles in a format that NativeFlow can use.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button
                  size="sm"
                  onClick={() => {
                    track("try_another_video_clicked", { video_url: url });
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
                  Try Another Video
                </Button>
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    track("try_demo_clicked_after_failure", { video_url: url });
                    loadMutation.reset();
                    startDemo();
                  }}
                >
                  <PlayCircle className="mr-2 h-4 w-4" /> Try the Demo
                </Button>
              </div>
              <div className="mt-5">
                <button
                  onClick={() => {
                    track("manual_transcript_opened", { video_url: url });
                    setShowManualTranscript(true);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Need advanced options? Paste transcript manually
                </button>
              </div>
            </div>
            {showManualTranscript && (
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
            )}
          </div>
        )}

        {view === "demo" && videoId && (
          <div className={`mt-4 space-y-4 ${isMobile ? "pb-24" : ""}`}>
            {!isDemo && <ReadinessBadges videoId={videoId} />}

            {transcriptStatus !== "ready" &&
              transcriptStatus !== "failed" &&
              transcriptStatus !== "idle" && (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground shadow-sm"
                >
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                  <div className="min-w-0 leading-snug">
                    <div className="font-medium">
                      {transcriptStatus === "checking_cache" &&
                        "Checking cache…"}
                      {transcriptStatus === "looking_for_captions" &&
                        "Looking for captions…"}
                      {transcriptStatus === "generating_transcript" &&
                        (slowTimeoutLevel >= 1
                          ? "Still generating transcript…"
                          : "Generating transcript…")}
                      {transcriptStatus === "building_sentences" &&
                        "Building learning sentences…"}
                      {transcriptStatus === "partial" &&
                        "Processing remaining transcript…"}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {slowTimeoutLevel >= 1
                        ? "This can take longer for videos without captions. You can keep watching — Learning Mode will unlock as soon as sentences are ready."
                        : "Transcript is being prepared. You can watch now — Learning Mode will unlock shortly."}
                    </div>
                  </div>
                </div>
              )}

            {/* Prominent Watch / Learning mode toggle, near the video. */}
            <div className="flex items-center justify-between gap-3">

              <div
                role="tablist"
                aria-label="Viewing mode"
                className="inline-flex items-center rounded-full border border-border bg-muted/50 p-1 shadow-sm"
              >
                <button
                  role="tab"
                  aria-selected={!studyMode}
                  onClick={() => {
                    if (!studyMode) return;
                    setStudyMode(false);
                    setSelected(null);
                    track("study_mode_closed", { video_id: videoId });
                    track("watch_mode_opened", { video_id: videoId });
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
                    !studyMode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Tv className="h-4 w-4" />
                  Watch Mode
                </button>
                <button
                  role="tab"
                  aria-selected={studyMode}
                  disabled={transcriptStatus === "failed" || sentences.length === 0}
                  title={
                    transcriptStatus === "failed"
                      ? "Learning Mode unavailable: transcript could not be generated"
                      : sentences.length === 0
                        ? "Transcript is still being prepared — Learning Mode will unlock shortly"
                        : undefined
                  }
                  onClick={() => {
                    if (studyMode) return;
                    if (transcriptStatus === "failed" || sentences.length === 0) return;
                    setStudyMode(true);
                    track("study_mode_opened", { video_id: videoId });
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
                    studyMode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  } ${transcriptStatus === "failed" || sentences.length === 0 ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <BookOpen className="h-4 w-4" />
                  Learning Mode
                </button>

              </div>
              <label
                className="hidden cursor-pointer items-center gap-2 text-xs text-muted-foreground sm:inline-flex"
                title="Focus Mode keeps the active sentence in view automatically. Transcript Mode lets you scroll freely."
              >
                <input
                  type="checkbox"
                  checked={focusMode}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setFocusMode(next);
                    track(next ? "focus_mode_enabled" : "focus_mode_disabled", {
                      video_id: videoId,
                    });
                  }}
                  className="h-3.5 w-3.5 cursor-pointer accent-primary"
                />
                Focus Mode
              </label>
            </div>


            {transcriptStatus === "failed" ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-6 text-foreground shadow-sm">
                <h2 className="text-lg font-semibold">
                  This video cannot be used in Learning Mode
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  We found subtitles or transcript data, but could not extract enough
                  learning sentences from this video.
                </p>
                {devPanelEnabled && (
                  <div className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-[11px] leading-snug text-muted-foreground">
                    <div>Transcript fetched: <b>YES</b></div>
                    <div>
                      Transcript length:{" "}
                      <b>
                        {sentences.reduce((n, s) => n + s.text.length, 0) ||
                          transcriptRawChunks.reduce((n, c) => n + c.text.length, 0)}
                      </b>{" "}
                      chars
                    </div>
                    <div>Sentence count: <b>{sentences.length}</b></div>
                    <div>Processing status: <b>{processingStatus}</b></div>
                    <div>Learning Mode usable: <b>NO</b></div>
                    <div>Transcript source: <b>{transcriptSource ?? "—"}</b></div>
                    <div>Video id: <b>{videoId ?? "—"}</b></div>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStudyMode(false);
                      setSelected(null);
                    }}
                  >
                    Back to Watch Mode
                  </Button>
                  <Button
                    onClick={() => {
                      setSentences([]);
                      setVideoId(null);
                      setTranscriptVideoId(null);
                      setSelected(null);
                      setTranscriptQuality(null);
                      loadMutation.reset();
                      if (typeof window !== "undefined") {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                  >
                    Try Another Video
                  </Button>
                </div>
              </div>
            ) : (
            <div
              className={`grid gap-6 ${
                studyMode
                  ? "grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start"
                  : "grid-cols-1"
              }`}
            >

              <div className="space-y-4 min-w-0">
                {isDevPanelEnabled() && (
                  <div
                    className={`rounded-md border px-3 py-2 text-[11px] font-mono leading-snug ${
                      (requestedVideoId && transcriptVideoId && requestedVideoId !== transcriptVideoId) ||
                      (spokenLang && transcriptLanguage && transcriptLanguage.toLowerCase().split(/[-_]/)[0] !== spokenLang.toLowerCase().split(/[-_]/)[0])
                        ? "border-red-500 bg-red-500/10 text-red-700"
                        : "border-border bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span>current_video_id: <b>{videoId ?? "—"}</b></span>
                      <span>requested_video_id: <b>{requestedVideoId ?? "—"}</b></span>
                      <span>transcript_video_id: <b>{transcriptVideoId ?? "—"}</b></span>
                      <span>spoken_language: <b>{spokenLang || "auto"}</b></span>
                      <span>target_language: <b>{targetLang}</b></span>
                      <span>transcript_language: <b>{transcriptLanguage ?? "—"}</b></span>
                      <span>translation_language: <b>{targetLang}</b></span>
                      <span>source: {transcriptSource ?? "—"}</span>
                      <span>provider: {cachedFromProvider ?? "—"}</span>
                      <span>transcript_chars: <b>{sentences.reduce((n, s) => n + s.text.length, 0) || transcriptRawChunks.reduce((n, c) => n + c.text.length, 0)}</b></span>
                      <span>chunk_count: <b>{transcriptRawChunks.length}</b></span>
                      <span>sentence_count: <b>{sentences.length}</b></span>
                      <span>rendered_count: <b>{sentences.length}</b></span>
                      <span>cache_row_id: {transcriptCacheRowId ?? "—"}</span>
                      <span>cache_key: {transcriptCacheKey ?? "—"}</span>
                      <span>loaded_at: {transcriptLoadedAt ?? "—"}</span>
                      <span>req_seq: {requestSeqRef.current}</span>
                      <span>loading: {loadMutation.isPending ? "yes" : "no"}</span>
                      <span>transcript_status: <b>{transcriptStatus}</b></span>
                      <span>time_to_transcript_ms: <b>{perfTimings.time_to_transcript_ms ?? "—"}</b></span>
                      <span>time_to_first_clickable_sentence_ms: <b>{perfTimings.time_to_first_clickable_sentence_ms ?? "—"}</b></span>
                      <span>time_to_first_explanation_ms: <b>{perfTimings.time_to_first_explanation_ms ?? "—"}</b></span>
                      <span>time_to_first_sentence_ms: <b>{perfTimings.time_to_first_sentence_ms ?? "—"}</b></span>
                      <span>time_to_full_transcript_ms: <b>{perfTimings.time_to_full_transcript_ms ?? "—"}</b></span>
                      <span>provider_used: <b>{perfTimings.provider_used ?? "—"}</b></span>
                      <span>cache_hit: <b>{perfTimings.cache_hit == null ? "—" : perfTimings.cache_hit ? "yes" : "no"}</b></span>
                      <span className="mt-1 w-full border-t border-border/40 pt-1 font-semibold">— server stage timings —</span>
                      <span>total_server_ms: <b>{stageTimings?.total_server_ms ?? "—"}</b></span>
                      <span>cache_lookup_ms: <b>{stageTimings?.cache_lookup_ms ?? "—"}</b></span>
                      <span>youtube_caption_attempt_ms: <b>{stageTimings?.youtube_caption_attempt_ms ?? "—"}</b></span>
                      <span>audio_extract_ms: <b>{stageTimings?.audio_extract_ms ?? "—"}</b></span>
                      <span>audio_download_ms: <b>{stageTimings?.audio_download_ms ?? "—"}</b></span>
                      <span>openai_transcription_ms: <b>{stageTimings?.openai_transcription_ms ?? "—"}</b></span>
                      <span>chunk_mapping_ms: <b>{stageTimings?.chunk_mapping_ms ?? "—"}</b></span>
                      <span>sentence_build_ms: <b>{stageTimings?.sentence_build_ms ?? "—"}</b></span>
                      <span>cache_write_ms: <b>{stageTimings?.cache_write_ms ?? "—"}</b></span>
                      <span>react_state_update_ms: <b>{reactStateUpdateMs ?? "—"}</b></span>
                      <span>audio_size_mb: <b>{stageTimings?.audio_size_mb ?? "—"}</b></span>
                      <span>openai_segments_count: <b>{stageTimings?.openai_segments_count ?? "—"}</b></span>
                      <span>video_duration_seconds: <b>{stageTimings?.video_duration_seconds ?? "—"}</b></span>



                    </div>
                    {transcriptRawChunks.length > 0 && (
                      <div className="mt-1 border-t border-border/40 pt-1">
                        <div className="font-semibold">first_3_chunks:</div>
                        {transcriptRawChunks.slice(0, 3).map((c, i) => (
                          <div key={i} className="truncate">[{c.offset.toFixed(2)}s +{c.duration.toFixed(2)}] {c.text}</div>
                        ))}
                      </div>
                    )}
                    {sentences.length > 0 && (
                      <div className="mt-1 border-t border-border/40 pt-1">
                        <div className="font-semibold">first_3_sentences:</div>
                        {sentences.slice(0, 3).map((s) => (
                          <div key={s.id} className="truncate">#{s.id} [{s.offset.toFixed(2)}s] {s.text}</div>
                        ))}
                      </div>
                    )}
                    {requestedVideoId && transcriptVideoId && requestedVideoId !== transcriptVideoId && (
                      <div className="mt-1 font-bold">⚠ VIDEO ID MISMATCH — transcript does not belong to current video</div>
                    )}
                    {spokenLang && transcriptLanguage && transcriptLanguage.toLowerCase().split(/[-_]/)[0] !== spokenLang.toLowerCase().split(/[-_]/)[0] && (
                      <div className="mt-1 font-bold">⚠ LANGUAGE MISMATCH — transcript language ({transcriptLanguage}) ≠ spoken language ({spokenLang})</div>
                    )}
                  </div>
                )}
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

                {/* Transcript — visible in both modes; passive in Watch Mode. */}
                <aside className="relative flex max-h-[50vh] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:max-h-[55vh]">
                    {transcriptQuality && !qualityBannerDismissed && transcriptQuality.quality !== "high" && (
                      <TranscriptQualityBanner
                        quality={transcriptQuality}
                        onContinue={() => {
                          setLimitedMode(transcriptQuality.quality === "low");
                          setQualityBannerDismissed(true);
                          if (transcriptQuality.quality === "low") {
                            track("limited_mode_accepted", {
                              video_id: videoId,
                              quality: transcriptQuality.quality,
                            });
                          }
                          track("transcript_quality_continue", {
                            video_id: videoId,
                            quality: transcriptQuality.quality,
                          });
                        }}
                        onTryAnother={() => {
                          if (transcriptQuality.quality === "low") {
                            track("limited_mode_abandoned", {
                              video_id: videoId,
                              quality: transcriptQuality.quality,
                            });
                          }
                          track("transcript_quality_try_another", {
                            video_id: videoId,
                            quality: transcriptQuality.quality,
                          });
                          setSentences([]);
                          setVideoId(null);
                          setTranscriptQuality(null);
                          setSelected(null);
                          if (typeof window !== "undefined") {
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }
                        }}
                        onTryDemo={startDemo}
                        onReprocess={() => {
                          if (!url) return;
                          track("transcript_quality_reprocess", {
                            video_id: videoId,
                            quality: transcriptQuality.quality,
                          });
                          submitLoad(url);
                        }}
                        reprocessing={loadMutation.isPending}
                      />
                    )}
                    <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                      <span>
                        Transcript
                        {sentences.length > 0
                          ? ` · ${sentences.length} ${limitedMode ? "phrases" : "sentences"}`
                          : transcriptStatus === "checking_cache"
                            ? " · checking cache…"
                            : transcriptStatus === "looking_for_captions"
                              ? " · looking for captions…"
                              : transcriptStatus === "generating_transcript"
                                ? " · generating transcript…"
                                : transcriptStatus === "building_sentences"
                                  ? " · building sentences…"
                                  : ""}

                      </span>

                      <div className="flex items-center gap-2">
                        {devPanelEnabled && sentences.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const snapshot = {
                                videoId,
                                transcriptSource,
                                cachedFromProvider,
                                transcriptLanguage,
                                transcriptCacheRowId,
                                transcriptCacheKey,
                                transcriptLoadedAt,
                                totalChars: sentences.reduce((n, s) => n + s.text.length, 0),
                                chunkCount: transcriptRawChunks.length,
                                sentenceCount: sentences.length,
                                renderedCount: sentences.length,
                                firstChunks: transcriptRawChunks.slice(0, 10),
                                firstSentences: sentences.slice(0, 10),
                              };
                              // eslint-disable-next-line no-console
                              console.log("[inspect-transcript]", snapshot);
                              try {
                                const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `transcript-${videoId ?? "snapshot"}.json`;
                                a.click();
                                setTimeout(() => URL.revokeObjectURL(url), 1000);
                              } catch {}
                            }}
                            className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider hover:bg-muted"
                            title="Founder-only: download a JSON snapshot of the current transcript"
                          >
                            Inspect
                          </button>
                        )}
                        {limitedMode && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                            Basic Transcript Mode
                          </span>
                        )}
                        {transcriptSource && (
                          <SourceBadge source={transcriptSource} cachedFrom={cachedFromProvider} />
                        )}
                      </div>
                    </div>

                    {loadMutation.isSuccess && sentences.length === 0 ? (
                      <div className="flex-1 overflow-y-auto p-6 text-sm">
                        <div className="rounded-md border border-red-500/50 bg-red-500/10 p-4 text-red-700 dark:text-red-300">
                          <div className="font-semibold">Transcript generated but sentence parsing failed.</div>
                          <div className="mt-1 text-xs opacity-80">
                            The provider returned {transcriptRawChunks.length} raw chunk{transcriptRawChunks.length === 1 ? "" : "s"} but
                            our segmenter produced 0 sentences. Try another video, or reload to retry.
                          </div>
                          {url && (
                            <button
                              onClick={() => submitLoad(url)}
                              className="mt-3 rounded-full border border-red-500/50 px-3 py-1 text-xs font-semibold hover:bg-red-500/20"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <ol ref={listRef} className="flex-1 overflow-y-auto">
                        {sentences.map((s) => {
                          const active = studyMode && selected?.id === s.id;
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
                    )}

                    {activeOutOfView && playingId !== null && (
                      <button
                        onClick={jumpToCurrentSentence}
                        className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90"
                      >
                        <ArrowDownToLine className="h-3.5 w-3.5" />
                        Jump to current sentence
                      </button>
                    )}
                  </aside>
              </div>

              {/* Explanation panel — right column on desktop, stacks below transcript on mobile */}
              {studyMode && (
                <div className="min-w-0 lg:sticky lg:top-[68px] lg:self-start">
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
                    limitedMode={limitedMode}
                  />
                </div>
              )}
            </div>
            )}

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
              localStorage.setItem("nativeflow_feedback_given", "1");
              localStorage.setItem("nativeflow_feedback_dismissed_at", String(Date.now()));
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
            waitlistJoined: waitlistJoinedRef.current || (typeof window !== "undefined" && localStorage.getItem("nativeflow_waitlist_joined") === "1"),
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
                <Bookmark className="h-3.5 w-3.5" /> Save to My Library
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
      try { localStorage.setItem("nativeflow_waitlist_joined", "1"); } catch {}
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
          Stay updated.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Get updates about new languages, improvements, and learning features.
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
            <label htmlFor="early-access-email" className="sr-only">
              Email address
            </label>
            <Input
              id="early-access-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
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


function SourceBadge({ source, cachedFrom }: { source: TranscriptSource; cachedFrom?: string | null }) {
  const labels: Record<string, string> = {
    youtube: "YouTube captions",
    fallback: "Transcribr fallback",
    manual: "Manual paste",
    asr: "AI transcribed",
    unknown: "unknown",
  };
  let label: string;
  let cls: string;
  if (source === "cache") {
    const inner = cachedFrom ? labels[cachedFrom] ?? cachedFrom : "unknown source";
    label = `Cache · ${inner}`;
    cls = "bg-primary/10 text-primary";
  } else if (source === "youtube") {
    label = `Source: ${labels.youtube}`;
    cls = "bg-accent text-accent-foreground";
  } else if (source === "fallback") {
    label = `Source: ${labels.fallback}`;
    cls = "bg-sky-500/15 text-sky-700 dark:text-sky-300";
  } else if (source === "manual") {
    label = `Source: ${labels.manual}`;
    cls = "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  } else {
    label = `Source: ${labels[source] ?? source}`;
    cls = "bg-violet-500/15 text-violet-700 dark:text-violet-300";
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium normal-case ${cls}`}>
      {label}
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
    <div className="rounded-lg border border-border bg-card p-4">
      <div>
        <label htmlFor="manual-transcript" className="text-xs font-medium text-foreground">
          Paste transcript manually
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          One line per sentence. Optionally prefix each line with a timestamp,
          e.g. <code className="rounded bg-muted px-1">[0:15] Hallo, hoe gaat het?</code>
        </p>
        <Textarea
          id="manual-transcript"
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
            See how NativeFlow works in under 30 seconds. Try it instantly — no account needed.
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

function CompactHowItWorks() {
  const steps = [
    { icon: Tv, label: "Paste a YouTube video" },
    { icon: MousePointerClick, label: "Click a sentence" },
    { icon: Brain, label: "Understand instantly" },
  ];
  return (
    <section className="py-6 sm:py-8">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-full border border-border bg-card/70 px-4 py-2.5 text-xs font-medium text-foreground shadow-sm sm:text-sm">
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
    </section>
  );
}



function parseExplanation(text: string | null) {
  if (!text) return { translation: "", meaning: "", vocabulary: "", note: "" };
  const get = (label: string) => {
    const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im");
    const m = text.match(re);
    return m ? m[1].trim() : "";
  };
  return {
    translation: get("Translation"),
    meaning: get("Meaning"),
    vocabulary: get("Vocabulary") || get("Vocab"),
    note: get("Note") || get("Notes") || get("Expression Notes"),
  };
}

type ExplanationPanelEntry =
  | { status: "loading" }
  | { status: "ready"; translation: string; meaning: string; vocabulary: string; note: string }
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
  limitedMode = false,
}: {
  sentence: TranscriptSentence | null;
  entry: ExplanationPanelEntry | undefined;
  onClose: () => void;
  onReplay: () => void;
  onSave: () => void;
  isSaved: boolean;
  justSaved: boolean;
  saving: boolean;
  limitedMode?: boolean;
}) {
  if (!sentence) {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-8 text-center shadow-md ring-1 ring-primary/10 animate-nativeflow-pulse">
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
    <div className="rounded-2xl border border-border bg-card shadow-md ring-1 ring-primary/5">
      <div className="px-6 pt-6">
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
            {!limitedMode && (
            <Button
              variant={isSaved || justSaved ? "secondary" : "outline"}
              size="sm"
              onClick={onSave}
              disabled={saveDisabled}
              className="h-8 gap-1 px-2 text-xs"
              title={
                isSaved
                  ? "Already in My Library"
                  : ready
                    ? "Save to My Library"
                    : "Wait for explanation to load"
              }
            >
              {justSaved ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Saved to Library
                </>
              ) : isSaved ? (
                <>
                  <BookmarkCheck className="h-3.5 w-3.5" /> In Library
                </>
              ) : (
                <>
                  <Bookmark className="h-3.5 w-3.5" /> Save to My Library
                </>
              )}
            </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onReplay}
              className="h-8 gap-1 px-2 text-xs"
            >
              <Repeat className="h-3.5 w-3.5" /> Replay
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 px-2 text-xs"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {justSaved && (
        <p className="mt-2 px-6 text-xs font-medium text-primary">
          Saved to My Expressions ✓
        </p>
      )}


      <div className="mt-5 border-t border-border px-6 pb-6 pt-5">
        {limitedMode ? (
          <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Sentence explanations are not available for this video, but you can still use the transcript while watching.
          </div>
        ) : ready ? (
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

const SPOKEN_LANGUAGE_OPTIONS: Array<{ label: string; code: string }> = [
  { label: "Auto-detect (original)", code: "" },
  { label: "English", code: "en" },
  { label: "Dutch", code: "nl" },
  { label: "Spanish", code: "es" },
  { label: "French", code: "fr" },
  { label: "German", code: "de" },
  { label: "Italian", code: "it" },
  { label: "Portuguese", code: "pt" },
  { label: "Polish", code: "pl" },
  { label: "Russian", code: "ru" },
  { label: "Turkish", code: "tr" },
  { label: "Arabic", code: "ar" },
  { label: "Japanese", code: "ja" },
  { label: "Chinese", code: "zh" },
  { label: "Korean", code: "ko" },
  { label: "Swedish", code: "sv" },
  { label: "Norwegian", code: "no" },
  { label: "Danish", code: "da" },
  { label: "Finnish", code: "fi" },
  { label: "Greek", code: "el" },
  { label: "Czech", code: "cs" },
  { label: "Hindi", code: "hi" },
  { label: "Indonesian", code: "id" },
  { label: "Vietnamese", code: "vi" },
  { label: "Thai", code: "th" },
];

function PrimaryHero({
  url, setUrl, targetLang, setTargetLang, spokenLang, setSpokenLang, loading, onSubmit, onStartDemo,
}: {
  url: string;
  setUrl: (v: string) => void;
  targetLang: string;
  setTargetLang: (v: string) => void;
  spokenLang: string;
  setSpokenLang: (v: string) => void;
  loading: boolean;
  onSubmit: (u: string) => void;
  onStartDemo: () => void;
}) {
  return (
    <HeroWithPreview
      url={url}
      setUrl={setUrl}
      targetLang={targetLang}
      setTargetLang={setTargetLang}
      spokenLang={spokenLang}
      setSpokenLang={setSpokenLang}
      loading={loading}
      onSubmit={onSubmit}
      onStartDemo={onStartDemo}
    />
  );
}

function HeroWithPreview({
  url, setUrl, targetLang, setTargetLang, spokenLang, setSpokenLang, loading, onSubmit, onStartDemo,
}: {
  url: string;
  setUrl: (v: string) => void;
  targetLang: string;
  setTargetLang: (v: string) => void;
  spokenLang: string;
  setSpokenLang: (v: string) => void;
  loading: boolean;
  onSubmit: (u: string) => void;
  onStartDemo: () => void;
}) {
  useEffect(() => {
    track("landing_preview_seen", {});
  }, []);

  return (
    <section className="relative pt-6 pb-8 sm:pt-10 sm:pb-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-20 -z-10 mx-auto h-[560px] max-w-6xl bg-[radial-gradient(ellipse_at_top,oklch(0.55_0.22_265/0.18),transparent_70%)]"
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
        {/* LEFT — copy + form */}
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm">
            <Sparkles className="h-3 w-3 text-primary" /> Works best with videos that contain subtitles
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.05]">
            Click any sentence.{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Understand it instantly.
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Never leave the video to figure out what was just said. Get translation, meaning and expression notes in one tap.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const u = url.trim();
              if (!u) return;
              track("landing_cta_clicked", { has_url: true, spoken_language: spokenLang || "auto" });
              onSubmit(u);
            }}
            className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-lg shadow-primary/10 sm:p-5"
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
              <div className="space-y-1.5 min-w-0">
                <label htmlFor="hero-url" className="text-xs font-medium text-foreground">
                  YouTube URL
                </label>
                <Input
                  id="hero-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste any YouTube URL"
                  className="h-12 w-full rounded-xl bg-background px-4 text-base"
                />
              </div>
              <div className="space-y-1.5 min-w-0">
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
            <div className="mt-3 space-y-1.5 min-w-0">
              <label htmlFor="hero-spoken-lang" className="text-xs font-medium text-foreground">
                Video language <span className="text-muted-foreground font-normal">(language spoken in the video)</span>
              </label>
              <Select
                value={spokenLang === "" ? "__auto__" : spokenLang}
                onValueChange={(v) => setSpokenLang(v === "__auto__" ? "" : v)}
              >
                <SelectTrigger id="hero-spoken-lang" className="h-11 w-full rounded-xl bg-background px-4">
                  <SelectValue placeholder="Auto-detect (original)" />
                </SelectTrigger>
                <SelectContent>
                  {SPOKEN_LANGUAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.code || "__auto__"} value={o.code || "__auto__"}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Set this when auto-detect picks the wrong language (transcript comes back translated).
              </p>
            </div>
            <Button
              type="submit"
              disabled={loading || !url.trim()}
              size="lg"
              className="mt-3 h-12 w-full gap-2 rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Preparing your video…</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Understand This Video</>
              )}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Paste a YouTube link and see sentence-by-sentence explanations in seconds.
            </p>
          </form>

          {/* Micro-trust signals */}
          <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" /> Try NativeFlow instantly — no account needed to explore videos and explanations
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" /> Works with most videos that have subtitles
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" /> Try your own YouTube video
            </li>
          </ul>

          <button
            type="button"
            onClick={onStartDemo}
            disabled={loading}
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
          >
            <PlayCircle className="h-4 w-4" /> Not sure where to start? Try the Dutch Demo
          </button>
        </div>

        {/* RIGHT — product preview */}
        <div className="min-w-0">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}

type PreviewMoment = {
  t: string;
  sentence: string;
  translation: string;
  meaning: string;
  note: string;
};

const PREVIEW_MOMENTS: PreviewMoment[] = [
  {
    t: "0:17",
    sentence: "Rij eens door, man.",
    translation: "Come on, keep driving.",
    meaning: "Used when someone is moving too slowly and you want them to hurry up.",
    note: "Not literal — 'eens' here softens the command, like a casual nudge.",
  },
  {
    t: "0:42",
    sentence: "Dat slaat nergens op.",
    translation: "That makes no sense at all.",
    meaning: "A common reaction when something feels illogical or absurd.",
    note: "'Slaat nergens op' is everyday spoken Dutch — you'll hear it constantly.",
  },
  {
    t: "1:08",
    sentence: "Ik heb er geen zin in.",
    translation: "I don't feel like it.",
    meaning: "Expresses lack of motivation or interest in doing something.",
    note: "'Zin hebben in' = to feel like (doing) — a core Dutch expression.",
  },
];

const PREVIEW_LINES = [
  { t: "0:14", text: "Wacht even, ik moet nog parkeren." },
  { t: "0:17", text: "Rij eens door, man." },
  { t: "0:25", text: "Kom op, we hebben haast." },
  { t: "0:42", text: "Dat slaat nergens op." },
  { t: "1:08", text: "Ik heb er geen zin in." },
];

function ProductPreview() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % PREVIEW_MOMENTS.length), 3800);
    return () => clearInterval(id);
  }, []);
  const moment = PREVIEW_MOMENTS[idx];

  return (
    <div className="rounded-2xl border border-border bg-card/80 p-3 shadow-xl shadow-primary/10 backdrop-blur sm:p-4">
      <div className="mb-2 flex items-center justify-between px-1 pt-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <Tv className="h-3 w-3" /> Live example
        </span>
        <span className="text-[11px] text-muted-foreground">Dutch → English</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Video thumbnail mockup */}
        <div className="flex flex-col gap-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-[#1f2937] via-[#312e81] to-[#7c3aed] shadow-md">
            {/* Faux scene */}
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(circle_at_75%_70%,rgba(236,72,153,0.25),transparent_60%)]"
            />
            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg ring-1 ring-black/10">
                <Play className="h-5 w-5 translate-x-[1px] text-black" fill="currentColor" />
              </div>
            </div>
            {/* YouTube-style badge */}
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> YouTube
            </span>
            {/* Duration */}
            <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-mono text-white">
              12:34
            </span>
            {/* Subtitle overlay — animates */}
            <div className="absolute inset-x-2 bottom-7 flex justify-center">
              <span
                key={moment.t}
                className="inline-block max-w-full animate-fade-in rounded bg-black/75 px-2 py-1 text-center text-[11px] font-medium leading-tight text-white shadow"
              >
                {moment.sentence}
              </span>
            </div>
          </div>
          {/* Transcript strip */}
          <ol className="space-y-1 rounded-xl border border-border bg-background/60 p-2">
            {PREVIEW_LINES.map((l) => {
              const active = l.t === moment.t;
              return (
                <li
                  key={l.t}
                  className={
                    "flex items-baseline gap-2 rounded-md px-1.5 py-1 transition-colors " +
                    (active ? "bg-primary/10 ring-1 ring-primary/30" : "")
                  }
                >
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{l.t}</span>
                  <span
                    className={
                      "truncate text-[11px] " +
                      (active ? "font-medium text-foreground" : "text-muted-foreground")
                    }
                  >
                    {l.text}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Explanation card — animates */}
        <div
          key={moment.t + "-card"}
          className="animate-fade-in rounded-xl border border-border bg-card shadow-sm"
        >
          <div className="border-b border-border px-4 pt-3 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Now explaining · {moment.t}
            </p>
            <p className="mt-0.5 text-base font-medium leading-snug text-foreground">
              "{moment.sentence}"
            </p>
          </div>
          <div className="space-y-2.5 px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Translation</p>
              <p className="mt-0.5 text-sm text-foreground">{moment.translation}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Meaning</p>
              <p className="mt-0.5 text-sm text-foreground">{moment.meaning}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Expression note</p>
              <p className="mt-0.5 text-sm text-foreground">{moment.note}</p>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 px-2 pb-1 text-center text-[11px] text-muted-foreground">
        Learn from real YouTube videos you already enjoy.
      </p>
    </div>
  );
}

function BeforeAfterSection() {
  const before = [
    { icon: "⏸", label: "Pause video" },
    { icon: "📸", label: "Screenshot subtitles" },
    { icon: "🌐", label: "Open Google Translate" },
    { icon: "🤖", label: "Paste into ChatGPT" },
    { icon: "🔍", label: "Search expressions" },
  ];
  const after = [
    { icon: "▶", label: "Watch" },
    { icon: "👆", label: "Click sentence" },
    { icon: "💡", label: "Understand instantly" },
    { icon: "📚", label: "Save useful expressions" },
  ];
  return (
    <section id="why" className="py-12 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Why learners use NativeFlow
        </h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Before NativeFlow
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {before.map((s) => (
                <li key={s.label} className="flex items-start gap-2">
                  <span className="w-5 shrink-0 text-base leading-5">{s.icon}</span>
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5 shadow-md shadow-primary/10">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              After NativeFlow
            </p>
            <ul className="mt-3 space-y-2 text-sm text-foreground">
              {after.map((s) => (
                <li key={s.label} className="flex items-start gap-2">
                  <span className="w-5 shrink-0 text-base leading-5">{s.icon}</span>
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
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

function TranscriptQualityBanner({
  quality,
  onContinue,
  onTryAnother,
  onTryDemo,
  onReprocess,
  reprocessing,
}: {
  quality: TranscriptQualityReport;
  onContinue: () => void;
  onTryAnother: () => void;
  onTryDemo?: () => void;
  onReprocess: () => void;
  reprocessing: boolean;
}) {
  const isLow = quality.quality === "low";
  const tone = isLow
    ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
    : "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-100";

  return (
    <div className={`border-b px-3 py-3 ${tone}`}>
      {isLow ? (
        <>
          <p className="text-sm font-semibold leading-snug">
            We found subtitles, but they are not detailed enough for full learning mode.
          </p>
          <p className="mt-1 text-xs leading-relaxed opacity-90">
            You can still watch the video, follow the transcript, replay sections, and explore the content. For sentence-by-sentence explanations, try a video with clearer subtitles.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={onContinue}
              className="h-8 rounded-full bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Continue with Transcript Mode
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onTryAnother}
              className="h-8 rounded-full border-amber-400/60 px-3 text-xs"
            >
              Try another video
            </Button>
            {onTryDemo && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onTryDemo}
                className="h-8 rounded-full px-3 text-xs"
              >
                Try the Dutch Demo
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs leading-relaxed">
            This transcript has limited structure. Some sentences may be
            imperfect.
          </p>
          <button
            onClick={onContinue}
            className="shrink-0 rounded p-1 text-amber-900/70 hover:bg-amber-100 dark:text-amber-100/70 dark:hover:bg-amber-500/10"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
