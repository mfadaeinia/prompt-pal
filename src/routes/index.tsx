import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import {
  readDemoTranscriptCache,
  writeDemoTranscriptCache,
} from "@/lib/demo-transcript-cache";


import { explainSentence } from "@/lib/explain.functions";
import { submitEarlyAccess } from "@/lib/early-access.functions";
import { recordVideoSession } from "@/lib/video-sessions.functions";
import {
  saveExpression,
  listSavedExpressions,
  claimAnonymousSaves,
} from "@/lib/saved-expressions.functions";
import { saveVideo, listSavedVideos } from "@/lib/saved-videos.functions";
import { logLibraryEvent } from "@/lib/library-events.functions";
import { getBrowserId } from "@/lib/browser-id";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/AuthDialog";
import { supabase } from "@/integrations/supabase/client";
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
import nativeflowLogo from "@/assets/nativeflow-logo.png.asset.json";
import { track, setUserProperties } from "@/lib/analytics";
import { FeedbackWidget, FeedbackFab } from "@/components/FeedbackWidget";
import { SentenceCoachmark, PlayNudge } from "@/components/OnboardingOverlay";
import { DevAnalyticsPanel, isDevPanelEnabled } from "@/components/DevAnalyticsPanel";
import { MarketingLanding } from "@/components/MarketingLanding";
import { YouTubeDiscovery } from "@/components/YouTubeDiscovery";

import { useIsMobile } from "@/hooks/use-mobile";
import { BookOpen, ChevronDown, ArrowDownToLine } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";


const DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=ucsSnoeTPMc";
const DEMO_VIDEO_ID = "ucsSnoeTPMc";
const DEMO_LANGUAGE = "English";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NativeFlow — Enjoy Native Content. Understand more of it." },
      {
        name: "description",
        content:
          "Turn any YouTube video or podcast you love into a language lesson — without leaving the experience.",
      },
      { property: "og:title", content: "NativeFlow — Enjoy Native Content. Understand more of it." },
      { property: "og:description", content: "Turn any YouTube video or podcast you love into a language lesson — without leaving the experience." },
      { property: "og:url", content: "https://nativeflow.life/" },
      { property: "og:image", content: "https://nativeflow.life/og-image.jpg?v=2" },
      { property: "og:image:width", content: "1216" },
      { property: "og:image:height", content: "640" },
      { name: "twitter:title", content: "NativeFlow — Enjoy Native Content. Understand more of it." },
      { name: "twitter:description", content: "Turn any YouTube video or podcast you love into a language lesson — without leaving the experience." },
      { name: "twitter:image", content: "https://nativeflow.life/og-image.jpg?v=2" },
    ],
    links: [
      { rel: "canonical", href: "https://nativeflow.life/" },
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
          url: "https://nativeflow.life/",
          description:
            "Turn any YouTube video or podcast you love into a language lesson — without leaving the experience.",
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
  const saveVideoFx = useServerFn(saveVideo);
  const listSavedVideosFx = useServerFn(listSavedVideos);
  const claimAnonFx = useServerFn(claimAnonymousSaves);
  const logLibraryEventFx = useServerFn(logLibraryEvent);
  const qc = useQueryClient();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const userIdRef = useRef<string | null>(null);
  useEffect(() => { userIdRef.current = userId; }, [userId]);


  const [authOpen, setAuthOpen] = useState(false);
  const pendingActionRef = useRef<null | (() => void)>(null);
  const initialAuthHandledRef = useRef(false);

  function requireAuth(action: () => void) {
    if (isAuthenticated) {
      action();
    } else {
      pendingActionRef.current = action;
      setAuthOpen(true);
    }
  }




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
  const [view, setView] = useState<"landing" | "demo" | "app">(() => {
    if (typeof window === "undefined") return "landing";
    return new URLSearchParams(window.location.search).get("v") ? "demo" : "landing";
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPlayNudge, setShowPlayNudge] = useState(false);
  const hasInteractedWithSentenceRef = useRef(false);
  const playNudgeTimerRef = useRef<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackTrigger, setFeedbackTrigger] = useState<string>("");
  const isMobile = useIsMobile();
  const [studyMode, setStudyMode] = useState(true);
  // Auto-follow: in Watch Mode the transcript scrolls with playback. In Learning Mode
  // the spec says auto-follow defaults OFF — the learner drives via sentence taps.
  const [focusMode, setFocusMode] = useState(false);
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
  // [perf] Per-sentence click → first-hint timing map. Key: sentence id.
  const sentenceClickAtRef = useRef<Map<number, number>>(new Map());
  // [perf] One-shot guard so we only log first-byte / first-chunk once per load.
  const perfFirstByteLoggedRef = useRef(false);
  const perfFirstChunkLoggedRef = useRef(false);
  function perfLog(label: string, data: Record<string, unknown> = {}) {
    try {
      const t = typeof performance !== "undefined" ? performance.now() : Date.now();
      console.log(`[perf] ${label}`, { t_ms: Math.round(t), ...data });
    } catch {}
  }
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

  // Warm the demo transcript cache in the background on first mount so
  // that clicking "Try Demo" is instant. The transcript for the fixed
  // demo video is pre-seeded in the server cache, so the fast-path fetch
  // returns immediately; we mirror it into localStorage so subsequent
  // opens skip the network entirely. Best-effort: any failure is silently
  // ignored and the normal load path will still run on click.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (readDemoTranscriptCache(DEMO_VIDEO_ID)) return;
    // Kick off immediately (no artificial delay) so the cache is warm by
    // the time the user reaches for the Try Demo button.
    fetchTxFast({ data: { url: DEMO_VIDEO_URL } })
      .then((r) => {
        if (r.status === "ready" && r.result.videoId === DEMO_VIDEO_ID) {
          writeDemoTranscriptCache(DEMO_VIDEO_ID, r.result);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Auto-load a video when arriving from a saved-library link (e.g. /?url=...)
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const u = params.get("url");
    if (u && /youtu/.test(u)) {
      autoLoadedRef.current = true;
      setUrl(u);
      setView("demo");
      submitLoad(u);
      // clean the URL so refreshes don't reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // List of saved expressions for this user — used to mark sentences as already-saved.
  const savedQuery = useQuery({
    queryKey: ["saved-expressions", isAuthenticated],
    queryFn: () => listSavedFx(),
    enabled: isAuthenticated,
  });
  const savedVideosQuery = useQuery({
    queryKey: ["saved-videos", isAuthenticated],
    queryFn: () => listSavedVideosFx(),
    enabled: isAuthenticated,
  });
  const isVideoSaved = useMemo(() => {
    const ids = new Set<string>(
      ((savedVideosQuery.data?.items ?? []) as any[]).map((v) => v.video_id),
    );
    return videoId ? ids.has(videoId) : false;
  }, [savedVideosQuery.data, videoId]);
  const savedSentenceKeys = useMemo(() => {
    const set = new Set<string>();
    for (const it of (savedQuery.data?.items ?? []) as any[]) {
      set.add(`${it.video_id ?? ""}::${(it.sentence_text ?? "").trim()}`);
    }
    return set;
  }, [savedQuery.data]);
  // Lowercased heads of single-expression saves for the current video, so the
  // explanation panel can mark each useful-expression row as "in library".
  const savedExpressionHeads = useMemo(() => {
    const set = new Set<string>();
    for (const it of (savedQuery.data?.items ?? []) as any[]) {
      if (videoId && it.video_id !== videoId) continue;
      const head = (it.sentence_text ?? "").trim().toLowerCase();
      if (head) set.add(head);
    }
    return set;
  }, [savedQuery.data, videoId]);

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

  // On sign-in: claim any anonymous saves from this browser, then run any
  // pending save action the user was about to perform, and refresh lists.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN") return;
      track("google_login_completed", {});
      const sid = browserId || getBrowserId();
      if (sid) {
        void claimAnonFx({ data: { sessionId: sid } }).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ["saved-expressions"] });
      qc.invalidateQueries({ queryKey: ["saved-videos"] });
      setAuthOpen(false);
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      if (action) {
        setTimeout(action, 50);
      } else if (typeof window !== "undefined") {
        // OAuth redirects cause a full page reload, so the in-memory
        // pendingActionRef is gone. Recover the intent from sessionStorage.
        const intent = sessionStorage.getItem("nativeflow_post_auth_intent");
        if (intent) {
          sessionStorage.removeItem("nativeflow_post_auth_intent");
          if (intent === "enter_app") setTimeout(() => setView("app"), 50);
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [browserId, claimAnonFx, qc]);


  // Authenticated users can still visit the landing page directly — the
  // marketing CTAs route them into the app on click. No forced redirect here.

  function isSentenceSaved(s: TranscriptSentence | null) {
    if (!s) return false;
    return savedSentenceKeys.has(`${videoId ?? ""}::${s.text.trim()}`);
  }

  const saveExpressionMutation = useMutation({
    mutationFn: (vars: {
      sentence: TranscriptSentence;
      translation: string | null;
      note: string | null;
    }) =>
      saveExpressionFx({
        data: {
          sessionId: browserId,
          sentenceText: vars.sentence.text,
          translation: vars.translation,
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
          userId,
          metadata: { source: "explanation_panel" },
        },
      }).catch(() => {});
      setJustSavedId(vars.sentence.id);
      window.setTimeout(() => setJustSavedId(null), 1800);
      qc.invalidateQueries({ queryKey: ["saved-expressions"] });
    },
  });

  const saveVideoMutation = useMutation({
    mutationFn: () => {
      if (!videoId) throw new Error("No video loaded");
      return saveVideoFx({
        data: {
          videoId,
          videoUrl: url || `https://www.youtube.com/watch?v=${videoId}`,
          videoTitle: videoTitle || null,
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          targetLanguage: targetLang || null,
          sessionId: browserId || null,
        },
      });
    },
    onSuccess: () => {
      track("video_saved", { video_id: videoId });
      qc.invalidateQueries({ queryKey: ["saved-videos"] });
    },
  });

  function handleSaveExpression(s: TranscriptSentence | null) {
    if (!s) return;
    const entry = explanationCache[s.id];
    const ready = entry && entry.status === "ready" ? entry : null;
    const payload = {
      sentence: s,
      translation: ready?.translation || null,
      note: ready?.note && ready.note !== "—" ? ready.note : null,
    };
    requireAuth(() => saveExpressionMutation.mutate(payload));
  }

  function handleSaveVideo() {
    if (!videoId) return;
    requireAuth(() => saveVideoMutation.mutate());
  }

  // Per-expression save (the bookmark icon inside Useful expressions).
  const [savingExpressionHead, setSavingExpressionHead] = useState<string | null>(null);
  const [justSavedExpressionHead, setJustSavedExpressionHead] = useState<string | null>(null);
  function handleSaveSingleExpression(
    sentence: TranscriptSentence | null,
    head: string,
    meaning: string,
  ) {
    if (!sentence || !head.trim()) return;
    const headKey = head.trim().toLowerCase();
    if (savedExpressionHeads.has(headKey)) return;
    requireAuth(async () => {
      setSavingExpressionHead(headKey);
      try {
        await saveExpressionFx({
          data: {
            sessionId: browserId,
            sentenceText: head.trim(),
            translation: meaning || null,
            expressionNotes: `From: "${sentence.text}"`,
            videoTitle: videoTitle,
            videoUrl: url || null,
            videoId: videoId,
            timestampSeconds: Math.max(0, Math.round(sentence.offset)),
            targetLanguage: targetLang || null,
          },
        });
        track("expression_saved", {
          video_id: videoId,
          timestamp_seconds: Math.round(sentence.offset),
          target_language: targetLang,
          source: "expression_row",
        });
        void logLibraryEventFx({
          data: {
            eventName: "expression_saved",
            sessionId: browserId,
            videoId: videoId ?? null,
            userId,
            metadata: { source: "expression_row" },
          },
        }).catch(() => {});
        qc.invalidateQueries({ queryKey: ["saved-expressions"] });
        setJustSavedExpressionHead(headKey);
        window.setTimeout(() => setJustSavedExpressionHead(null), 1400);
      } finally {
        setSavingExpressionHead(null);
      }
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
    if (!selectionPopover) return;
    const popover = selectionPopover;
    const doSave = async () => {
      const { text, sentence } = popover;
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
            userId,
            metadata: { source: "text_selection", selected_length: text.length },
          },
        }).catch(() => {});
        qc.invalidateQueries({ queryKey: ["saved-expressions"] });
        setSelJustSaved(true);
        window.setTimeout(() => setSelJustSaved(false), 1400);
        window.setTimeout(() => setSelectionPopover(null), 600);
        window.getSelection()?.removeAllRanges();
      } catch {
        // best-effort
      } finally {
        setSelSaving(false);
      }
    };
    requireAuth(() => void doSave());
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
    // Reset playback state so a re-entry into the demo starts from sentence 1
    // in sync with the video (the iframe remounts but videoId is unchanged).
    setCurrentTime(0);
    setManualActiveId(null);
    deepLinkSeekRef.current = null;
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

  // Auto-show the first-time coachmark whenever the demo view is active and
  // we have sentences rendered (covers direct ?v= URL entry that bypasses startDemo).
  useEffect(() => {
    if (view !== "demo" || !studyMode) return;
    if (sentences.length === 0) return;
    if (hasInteractedWithSentenceRef.current) return;
    try {
      if (typeof window === "undefined") return;
      if (localStorage.getItem("nativeflow_sentence_hinted") === "1") return;
      if (localStorage.getItem("nativeflow_onboarded") === "1") return;
      setShowOnboarding(true);
    } catch {}
  }, [view, studyMode, sentences.length]);

  // Tiny URL → 11-char video ID extractor (mirrors the server-side regex).
  function extractVideoIdClient(u: string): string | null {
    try {
      const m = u.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  type LoadVars = { url: string; seq: number; requestedVideoId: string | null; spokenLanguageOverride?: string };

  const loadMutation = useMutation({
    mutationFn: async (vars: LoadVars) => {
      console.log("[transcript-debug][client] submitting URL:", vars.url, "seq:", vars.seq, "requestedVideoId:", vars.requestedVideoId);
      loadStartedAtRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      slowStartedAtRef.current = null;
      setSlowTimeoutLevel(0);
      setTranscriptStatus("checking_cache");

      // ── Demo fast-path: localStorage cache ─────────────────────────────
      // The Demo button always opens the same fixed video. If we have a
      // previously-stored transcript for it, hydrate from there with zero
      // network — the Demo should feel like a preloaded showcase.
      perfFirstByteLoggedRef.current = false;
      perfFirstChunkLoggedRef.current = false;
      perfLog("request_start", { url: vars.url, seq: vars.seq, videoId: vars.requestedVideoId });
      if (vars.url === DEMO_VIDEO_URL) {
        const cached = readDemoTranscriptCache(DEMO_VIDEO_ID);
        if (cached) {
          perfLog("first_chunk_rendered", { path: "demo-cache", sentence_count: cached.sentences.length });
          return { res: cached, vars, viaSlowPath: false };
        }
      }

      // ── Fast path: cache + YouTube captions only ────────────────────────
      // For the demo video we skip YouTube captions entirely — their
      // auto-generated timestamps drift out of sync with the audio. ASR
      // (Whisper) produces tight word-level timings, so we force that path
      // and then cache the result for subsequent loads.
      const isDemoUrl = vars.url === DEMO_VIDEO_URL;
      const effectiveSpokenLang = vars.spokenLanguageOverride || spokenLang || undefined;
      const fast: FetchTranscriptFastResult = await fetchTxFast({
        data: {
          url: vars.url,
          spokenLanguage: effectiveSpokenLang,
          skipYoutube: isDemoUrl || undefined,
        },
      });

      if (fast.status === "ready") {
        const startedAt = loadStartedAtRef.current ?? 0;
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        perfLog("first_chunk_rendered", {
          path: "fast",
          source: fast.result.source,
          cache_hit: !!fast.result.cacheHit,
          sentence_count: fast.result.sentences.length,
          elapsed_ms: Math.round(now - startedAt),
        });
        perfFirstChunkLoggedRef.current = true;
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

      // CRITICAL: never default to a concrete language here. The transcript
      // must reflect the SPOKEN language of the media, not the learner's
      // target/translation language. When the user hasn't pinned a source
      // language, pass "_any_" so Whisper auto-detects instead of being told
      // (wrongly) that the audio is e.g. Dutch.
      const langParam = (effectiveSpokenLang || "").trim() || "_any_";
      console.log("[lang-pipeline][client] slow-path stream", {
        url: vars.url,
        detectedSourceLanguage: spokenLang || null,
        spokenLanguageOverride: vars.spokenLanguageOverride || null,
        effectiveSpokenLang: effectiveSpokenLang || null,
        userTargetLanguage: targetLang,
        whisperLangParam: langParam,
      });
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
          if (!perfFirstByteLoggedRef.current) {
            perfFirstByteLoggedRef.current = true;
            const startedAt = loadStartedAtRef.current ?? 0;
            const now = typeof performance !== "undefined" ? performance.now() : Date.now();
            perfLog("first_byte", { path: "sse", event: "job", elapsed_ms: Math.round(now - startedAt) });
          }
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
            if (!perfFirstChunkLoggedRef.current) {
              perfFirstChunkLoggedRef.current = true;
              const startedAt = loadStartedAtRef.current ?? 0;
              const now = typeof performance !== "undefined" ? performance.now() : Date.now();
              perfLog("first_chunk_rendered", {
                path: "sse",
                sentence_count: sentences.length,
                detected_language: detected,
                elapsed_ms: Math.round(now - startedAt),
              });
            }
            const synthetic: FetchTranscriptResult = {
              videoId: String(lastVideoId ?? ""),
              sentences,
              source: "asr",
              cachedFromProvider: null,
              language: detected,
              spokenLanguage: effectiveSpokenLang || null,
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
      } else if (
        res.videoId === DEMO_VIDEO_ID &&
        res.sentences.length > 0 &&
        !(payload as any).streaming
      ) {
        // Warm the client cache so the next Demo open is instant.
        writeDemoTranscriptCache(DEMO_VIDEO_ID, res);
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
  const submitLoad = (u: string, spokenLanguageOverride?: string) => {
    const requestedId = extractVideoIdClient(u);
    console.log("[lang-pipeline][client] submitLoad", {
      url: u,
      detectedSourceLanguage: spokenLang || null,
      spokenLanguageOverride: spokenLanguageOverride || null,
      userTargetLanguage: targetLang,
      note: "transcript uses spoken/source language; translation uses target language",
    });
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
    loadMutation.mutate({ url: u, seq, requestedVideoId: requestedId, spokenLanguageOverride });
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
    | {
        status: "ready";
        translation: string;
        keyExpression: string;
        keyExpressions: string;
        whatsHappening: string;
        whyThisWay: string;
        vocabulary: string;
        note: string;
        grammar: string;
      }
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
            keyExpression: parsed.keyExpression,
            keyExpressions: parsed.keyExpressions,
            whatsHappening: parsed.whatsHappening,
            whyThisWay: parsed.whyThisWay,
            vocabulary: parsed.vocabulary,
            note: parsed.note,
            grammar: parsed.grammar,
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
          userId: userIdRef.current,
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
            // YouTube remembers the last playback position per video via
            // cookies and auto-resumes from the middle on the next load.
            // For Learning Mode we always want to start at the beginning
            // unless an explicit deep-link timestamp is provided.
            try {
              if (deepLinkSeekRef.current == null) {
                playerRef.current?.seekTo?.(0, true);
                setCurrentTime(0);
              }
            } catch {}
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
              // Reinforcement hint: if the user plays without interacting, gently surface it.
              if (
                !hasInteractedWithSentenceRef.current &&
                !showOnboarding &&
                playNudgeTimerRef.current == null
              ) {
                try {
                  const alreadyHinted =
                    typeof window !== "undefined" &&
                    localStorage.getItem("nativeflow_sentence_hinted") === "1";
                  if (!alreadyHinted) {
                    playNudgeTimerRef.current = window.setTimeout(() => {
                      if (!hasInteractedWithSentenceRef.current) {
                        setShowPlayNudge(true);
                      }
                      playNudgeTimerRef.current = null;
                    }, 6000);
                  }
                } catch {}
              }
            } else if (e.data === YT.PlayerState.PAUSED) {
              track("video_paused", { video_id: videoId, current_time: t });
              if (playNudgeTimerRef.current != null) {
                window.clearTimeout(playNudgeTimerRef.current);
                playNudgeTimerRef.current = null;
              }
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
  }, [videoId, view]);

  // Active sentence id, derived from currentTime range, with manual override
  // when the user clicks (so the click feels instant even before the player
  // has actually seeked).
  const [manualActiveId, setManualActiveId] = useState<number | null>(null);
  const manualUntilRef = useRef(0);

  // Server-side timestamps are now derived from Whisper's true decoded
  // duration per chunk (see transcript-stream.ts), so no client-side fudge
  // factor is needed. Keep at 0 — do NOT use this to mask drift bugs.
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

  // ── Discovery instrumentation ──────────────────────────────────────────
  // Answers "why are users watching but not clicking?". Each event fires at
  // most once per session so the funnel math stays clean.
  const transcriptVisibleFiredRef = useRef(false);
  const transcriptSeenFiredRef = useRef(false);
  const sentenceHoveredFiredRef = useRef(false);
  const firstClickFiredRef = useRef(false);
  const hintShownFiredRef = useRef(false);
  const videoOpenedAtRef = useRef<number | null>(null);
  const [showSentenceHint, setShowSentenceHint] = useState(false);

  // Mark when a video is opened so seconds_since_video_open is meaningful.
  useEffect(() => {
    if (videoId) {
      videoOpenedAtRef.current = performance.now();
      // New video → reset per-video discovery flags but keep per-session
      // ones (transcript_visible, transcript_seen, sentence_hovered,
      // first_sentence_click, hint_shown all stay session-scoped).
    } else {
      videoOpenedAtRef.current = null;
    }
  }, [videoId]);

  const secondsSinceOpen = () =>
    videoOpenedAtRef.current == null
      ? null
      : Math.round((performance.now() - videoOpenedAtRef.current) / 1000);

  const logDiscovery = (
    eventName:
      | "transcript_visible"
      | "transcript_seen"
      | "sentence_hovered"
      | "first_sentence_click"
      | "hint_shown"
      | "hint_dismissed"
      | "hint_clicked",
    extra: Record<string, unknown> = {},
  ) => {
    const sid = browserId;
    if (!sid) return;
    const meta = {
      seconds_since_video_open: secondsSinceOpen(),
      ts: new Date().toISOString(),
      ...extra,
    };
    track(eventName, { video_id: videoId, ...meta });
    void logLibraryEventFx({
      data: {
        eventName,
        sessionId: sid,
        videoId: videoId ?? null,
        userId,
        metadata: meta,
      },
    }).catch(() => {});
  };

  // Fire `transcript_visible` once per session when the transcript first
  // becomes visible (i.e. sentences are rendered in the DOM).
  useEffect(() => {
    if (transcriptVisibleFiredRef.current) return;
    if (sentences.length === 0) return;
    if (!browserId) return;
    transcriptVisibleFiredRef.current = true;
    logDiscovery("transcript_visible", { sentence_count: sentences.length });

    // First-time-this-session hint: show once, dismissible. Use sessionStorage
    // so it shows again in a brand-new browser session.
    try {
      const seen = sessionStorage.getItem("nf_sentence_hint_seen");
      if (!seen && !hasInteractedWithSentenceRef.current) {
        setShowSentenceHint(true);
      }
    } catch {
      setShowSentenceHint(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentences.length, browserId]);

  // Fire `transcript_seen` once when the transcript scrolls into the viewport.
  useEffect(() => {
    if (transcriptSeenFiredRef.current) return;
    const el = listRef.current;
    if (!el || sentences.length === 0 || !browserId) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !transcriptSeenFiredRef.current) {
            transcriptSeenFiredRef.current = true;
            logDiscovery("transcript_seen");
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentences.length, browserId]);

  // Fire `hint_shown` once when the hint becomes visible.
  useEffect(() => {
    if (!showSentenceHint || hintShownFiredRef.current || !browserId) return;
    hintShownFiredRef.current = true;
    logDiscovery("hint_shown");
    try {
      sessionStorage.setItem("nf_sentence_hint_seen", "1");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSentenceHint, browserId]);

  const onSentenceHover = () => {
    if (sentenceHoveredFiredRef.current) return;
    if (isMobile) return; // desktop only
    sentenceHoveredFiredRef.current = true;
    logDiscovery("sentence_hovered");
  };

  const dismissSentenceHint = (viaClick: boolean) => {
    if (!showSentenceHint) return;
    setShowSentenceHint(false);
    logDiscovery(viaClick ? "hint_clicked" : "hint_dismissed");
  };


  const [activeOutOfView, setActiveOutOfView] = useState(false);
  useEffect(() => {
    if (playingId == null || !listRef.current) {
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

    // Keep the active sentence just below the video / near the top of the
    // transcript viewport so it is always clearly visible under the player.
    const targetVisibleTop = cHeight * 0.02;
    const drift = visibleTop - targetVisibleTop;
    const band = cHeight * 0.18; // dead-zone around the target
    if (Math.abs(drift) < band && fullyVisible) return;

    const desiredScrollTop = Math.max(0, eTop - targetVisibleTop);
    container.scrollTo({ top: desiredScrollTop, behavior: "smooth" });
  }, [playingId, focusMode]);

  const stickySentence = useMemo(() => {
    if (!isMobile || !activeOutOfView || playingId == null) return null;
    return sentences.find((x) => x.id === playingId) ?? null;
  }, [isMobile, activeOutOfView, playingId, sentences]);

  function jumpToCurrentSentence() {
    if (playingId == null || !listRef.current) return;
    const container = listRef.current;
    const el = container.querySelector<HTMLElement>(`[data-sid="${playingId}"]`);
    if (el) {
      const targetVisibleTop = container.clientHeight * 0.02;
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
    // Auto-following the active sentence is gated on auto-follow (focusMode).
    // In Learning Mode with auto-follow off, only explicit taps open the Aha Panel.
    if (!focusMode) return;
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
  }, [playingId, sentences, studyMode, focusMode]);

  // Auto pre-select the first sentence when the transcript first loads so users
  // immediately see what tapping a subtitle does. Desktop/tablet only — on phones
  // this would auto-open the bottom Sheet and cover the freshly loaded video.
  const autoPreselectedForVideoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!studyMode) return;
    if (isMobile) return;
    if (!videoId) return;
    if (sentences.length === 0) return;
    if (selected) return;
    if (playingId != null) return;
    if (autoPreselectedForVideoRef.current === videoId) return;
    autoPreselectedForVideoRef.current = videoId;
    const first = sentences[0];
    setSelected(first);
    ensureExplanation(first, sentences);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyMode, isMobile, videoId, sentences, selected, playingId]);

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
    if (browserId) {
      void logLibraryEventFx({
        data: {
          eventName: "explanation_viewed",
          sessionId: browserId,
          videoId: videoId ?? null,
          userId,
        },
      }).catch(() => {});
    }
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

  // Sync diagnostics: once every ~2s, log the active sentence vs. video
  // currentTime so drift is visible without spamming the console.
  const lastSyncLogRef = useRef(0);
  useEffect(() => {
    if (!sentences.length) return;
    const now = performance.now();
    if (now - lastSyncLogRef.current < 2000) return;
    lastSyncLogRef.current = now;
    const active = sentences.find((s) => s.id === playingId) ?? null;
    const expected = active
      ? currentTime < active.offset
        ? active.offset - currentTime
        : currentTime > active.endTime
          ? currentTime - active.endTime
          : 0
      : null;
    console.log("[sync-debug][client]", {
      videoCurrentTime: Number(currentTime.toFixed(3)),
      activeSentenceId: active?.id ?? null,
      activeStart: active ? Number(active.offset.toFixed(3)) : null,
      activeEnd: active ? Number(active.endTime.toFixed(3)) : null,
      offsetFromExpectedSec: expected,
      totalSentences: sentences.length,
    });
  }, [currentTime, playingId, sentences]);


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

  // Learning Mode interaction: seek to the sentence and PAUSE so the learner can
  // study without the video moving on. Resume is an explicit action.
  function seekAndPause(s: TranscriptSentence) {
    const p = playerRef.current;
    if (p?.seekTo) {
      p.seekTo(Math.max(0, s.offset), true);
      p.pauseVideo?.();
    }
    pauseAtRef.current = null;
    setManualActiveId(s.id);
    manualUntilRef.current = performance.now() + 1200;
    setCurrentTime(s.offset);
  }

  // Resume playback from the user's current transcript position (no seek),
  // close the Aha Panel. Used by Resume button, sheet dismiss, and panel close.
  function resumeFromHere() {
    setSelected(null);
    const p = playerRef.current;
    p?.playVideo?.();
    track("learning_resume", { video_id: videoId });
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
    {
      const t = typeof performance !== "undefined" ? performance.now() : Date.now();
      sentenceClickAtRef.current.set(s.id, t);
      perfLog("sentence_clicked", { sentence_id: s.id, mode: studyMode ? "learning" : "watch" });
    }
    if (studyMode) {
      setSelected(s);
      if (!limitedMode) ensureExplanation(s, sentences);
      // Learning Mode: pause on tap so the learner can study. Resume is explicit.
      seekAndPause(s);
    } else {
      seekAndPlay(s);
    }
    const idx = sentences.findIndex((x) => x.id === s.id);
    clickCountRef.current += 1;
    uniqueClickedRef.current.add(idx);
    track("sentence_clicked", {
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
    if (browserId) {
      console.log("sentence_click_start", { sessionId: browserId, videoId });
      void logLibraryEventFx({
        data: {
          eventName: "sentence_clicked",
          sessionId: browserId,
          videoId: videoId ?? null,
          userId,
        },
      })
        .then((res) => {
          if (res && (res as any).ok === false) {
            console.error("sentence_click_failed", (res as any).error);
          } else {
            console.log("sentence_click_success");
          }
        })
        .catch((err) => {
          console.error("sentence_click_failed", err);
        });
    } else {
      console.warn("sentence_click_skipped: no browserId yet");
    }
    // First click of the session — separate funnel event.
    if (!firstClickFiredRef.current) {
      firstClickFiredRef.current = true;
      logDiscovery("first_sentence_click", {
        sentence_index: idx,
        mode: studyMode ? "learning" : "watch",
      });
    }
    // Dismiss onboarding on first interaction
    if (showOnboarding) dismissOnboarding(true);
    // Dismiss the sentence hint as a "click" if it was on screen.
    if (showSentenceHint) dismissSentenceHint(true);
    if (!hasInteractedWithSentenceRef.current) {
      hasInteractedWithSentenceRef.current = true;
      try {
        localStorage.setItem("nativeflow_sentence_hinted", "1");
      } catch {}
    }
    if (playNudgeTimerRef.current != null) {
      window.clearTimeout(playNudgeTimerRef.current);
      playNudgeTimerRef.current = null;
    }
    if (showPlayNudge) setShowPlayNudge(false);
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
    <div className="relative min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2">
            {(view === "demo" || view === "app") && (
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
              <img
                src={nativeflowLogo.url}
                alt="NativeFlow"
                className="h-8 shrink-0"
              />
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button onClick={() => navTo("why")} className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">Why NativeFlow</button>
            
            {devPanelEnabled && (
              <Link
                to="/founder"
                className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
              >
                Founder
              </Link>
            )}
            <div className="relative">
              {isAuthenticated ? (
                <span
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600"
                  title="You are signed in"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Signed In
                </span>
              ) : (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  title="Sign in to save your progress"
                >
                  <span className="h-2 w-2 rounded-full bg-slate-400/60" />
                  Sign In
                </button>
              )}
            </div>
            {isAuthenticated && (
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
            )}
            {videoId && view !== "landing" && (
              <Button
                size="sm"
                variant={isVideoSaved ? "outline" : "default"}
                onClick={handleSaveVideo}
                disabled={saveVideoMutation.isPending || isVideoSaved}
                className="h-9 rounded-full px-3 text-xs"
                title={isVideoSaved ? "Saved to your library" : "Save this video"}
              >
                {isVideoSaved ? (
                  <><BookmarkCheck className="mr-1.5 h-3.5 w-3.5" /> Saved</>
                ) : saveVideoMutation.isPending ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…</>
                ) : (
                  <><Bookmark className="mr-1.5 h-3.5 w-3.5" /> Save video</>
                )}
              </Button>
            )}
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
          onSignUp={() => {
            const enterApp = () => setView("app");
            if (isAuthenticated) {
              enterApp();
            } else {
              pendingActionRef.current = enterApp;
              if (typeof window !== "undefined") {
                sessionStorage.setItem("nativeflow_post_auth_intent", "enter_app");
              }
              setAuthOpen(true);
            }
          }}

          conversionSlot={
            <PrimaryHero
              url={url}
              setUrl={setUrl}
              targetLang={targetLang}
              setTargetLang={setTargetLang}
              spokenLang={spokenLang}
              setSpokenLang={setSpokenLang}
              loading={loadMutation.isPending}
              onSubmit={(u, lang) => {
                if (lang) setSpokenLang(lang);
                track("custom_video_attempted", { video_url: u, spoken_language: lang || spokenLang || "auto" });
                const go = () => {
                  setUrl(u);
                  setView("demo");
                  submitLoad(u, lang);
                };
                if (isAuthenticated) {
                  go();
                } else {
                  pendingActionRef.current = go;
                  setAuthOpen(true);
                }
              }}
              onStartDemo={startDemo}
            />
          }
        />
      )}

      {view === "app" && (
        <section className="mx-auto max-w-3xl px-6 pt-10 pb-16 sm:pt-16">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome to NativeFlow
            </h1>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
              Search any video, or try a popular example to start learning.
            </p>
          </div>
          <div className="mt-8">
            <div className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <label htmlFor="app-target-lang" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Explanation language
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Sentence explanations and translations will be shown in this language.
              </p>
              <Select value={targetLang} onValueChange={setTargetLang}>
                <SelectTrigger id="app-target-lang" className="mt-2 h-11 w-full rounded-xl bg-background px-4 sm:max-w-xs">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {["English","Dutch","Spanish","French","German","Italian","Portuguese","Japanese","Chinese","Korean","Russian","Arabic","Turkish","Polish","Swedish","Norwegian","Danish","Finnish","Hindi","Indonesian","Vietnamese","Thai","Greek","Czech","Persian"].map((lang) => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <YouTubeDiscovery
              loading={loadMutation.isPending}
              onPick={(u, lang) => {
                if (lang) setSpokenLang(lang);
                track("custom_video_attempted", { video_url: u, spoken_language: lang || spokenLang || "auto" });
                setUrl(u);
                setView("demo");
                submitLoad(u, lang);
              }}
            />
          </div>
        </section>
      )}


      <main className="relative mx-auto max-w-6xl px-6">
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

            {/* Watch / Learning toggle — flat segmented control, sits directly below the video. */}
            <div className="flex items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Viewing mode"
                className="inline-flex items-center rounded-lg bg-muted/60 p-0.5"
              >
                <button
                  role="tab"
                  aria-selected={!studyMode}
                  onClick={() => {
                    if (!studyMode) return;
                    setStudyMode(false);
                    setSelected(null);
                    setFocusMode(true); // Watch Mode: auto-follow on
                    track("study_mode_closed", { video_id: videoId });
                    track("watch_mode_opened", { video_id: videoId });
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                    !studyMode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Tv className="h-3.5 w-3.5" />
                  Watch
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
                    setFocusMode(false); // Learning Mode: learner drives via taps
                    track("study_mode_opened", { video_id: videoId });
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                    studyMode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  } ${transcriptStatus === "failed" || sentences.length === 0 ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Learning
                </button>
              </div>
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
              className={`grid gap-8 ${
                studyMode
                  ? "grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start"
                  : "grid-cols-1"
              }`}
            >

              <div className="contents lg:flex lg:flex-col lg:gap-8">


              <div className="space-y-4 min-w-0 order-1">
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
                <div className="mx-auto aspect-video w-full max-w-md overflow-hidden rounded-xl bg-black sticky top-[68px] z-10 lg:static">
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
              </div>

              {/* Transcript — visible in both modes; passive in Watch Mode. On mobile this sits BELOW the explanation card. */}
              <div className="min-w-0 order-3 lg:order-2">
                <aside className="relative flex max-h-[55vh] flex-col overflow-hidden rounded-xl bg-muted/30 lg:max-h-[calc(100vh-96px)]">

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
                    <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2 text-xs font-medium text-muted-foreground">
                      <span>
                        Transcript
                        <span className="hidden sm:inline">
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
                      </span>

                      <div className="hidden sm:flex items-center gap-2">
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

                    {/* Mobile/tablet onboarding card — desktop already shows the full ExplanationPanel
                        in the right column. Hidden once the user opens their first explanation. */}
                    {studyMode && sentences.length > 0 && !selected && (
                      <div className="mx-3 mb-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-sm lg:hidden">
                        <div className="flex items-start gap-2">
                          <span className="select-none text-lg leading-none" aria-hidden>💡</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-tight text-foreground">
                              Tap any subtitle to instantly understand it
                            </p>
                            <ul className="mt-2 space-y-0.5 text-[12.5px] leading-snug text-muted-foreground">
                              <li>• Natural translation</li>
                              <li>• Useful expressions</li>
                              <li>• Grammar when relevant</li>
                            </ul>
                            <p className="mt-2.5 text-[12.5px] font-semibold text-primary">
                              Try a sentence below ↓
                            </p>
                          </div>
                        </div>
                      </div>
                    )}


                    {showSentenceHint && sentences.length > 0 && (
                      <div
                        role="note"
                        className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[12.5px] leading-snug text-foreground shadow-sm animate-in fade-in slide-in-from-top-1"
                      >
                        <span className="select-none text-base leading-none" aria-hidden>💡</span>
                        <span className="min-w-0 flex-1">
                          Click any subtitle to instantly understand expressions, meaning, and context.
                        </span>
                        <button
                          type="button"
                          onClick={() => dismissSentenceHint(false)}
                          aria-label="Dismiss hint"
                          className="ml-1 -mr-1 -mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                        >
                          ×
                        </button>
                      </div>
                    )}




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
                      <ol ref={listRef} className="flex-1 overflow-y-auto px-2 pb-3">
                        {stickySentence && (
                          <li className="sticky top-0 z-10 border-b border-primary/20 bg-card/95 backdrop-blur-sm shadow-sm">
                            <button
                              onClick={() => jumpTo(stickySentence)}
                              className="flex w-full cursor-pointer items-start gap-2 border-l-2 border-primary bg-primary/10 px-3 py-2 text-left text-[15px] leading-[1.7] font-medium text-foreground"
                            >
                              <span className="mt-0.5 shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
                                {formatTime(stickySentence.offset)}
                              </span>
                              <span className="min-w-0">{stickySentence.text}</span>
                            </button>
                          </li>
                        )}
                        {sentences.map((s) => {
                          const active = studyMode && selected?.id === s.id;
                          const playing = playingId === s.id;
                          const inlineEntry = active ? explanationCache[s.id] : undefined;
                          return (
                            <li key={s.id}>
                              <button
                                data-sid={s.id}
                                onClick={() => jumpTo(s)}
                                onMouseEnter={onSentenceHover}
                                className={`group block w-full cursor-pointer touch-manipulation rounded-lg border-l-2 px-3 py-3 text-left text-[15px] leading-[1.7] transition-all duration-150 hover:bg-accent/70 hover:border-primary/70 hover:translate-x-0.5 active:scale-[0.98] active:bg-primary/20 ${
                                  active
                                    ? "border-primary bg-primary/25 font-medium text-foreground ring-1 ring-primary/25"
                                    : playing
                                    ? "border-primary/70 bg-primary/15 text-foreground"
                                    : "border-transparent text-foreground/85"
                                }`}
                              >
                                <span className="mr-2 text-[10px] tabular-nums text-muted-foreground/70">
                                  {formatTime(s.offset)}
                                </span>
                                {s.text}
                              </button>
                              {/* Mobile inline expansion removed — the ExplanationPanel above is the primary learning surface on mobile. */}
                              {false && active && studyMode && inlineEntry && (
                                <div className="hidden">
                                  <InlineExplanation entry={inlineEntry} limitedMode={limitedMode} />
                                </div>
                              )}

                            </li>
                          );
                        })}
                      </ol>
                    )}

                    {activeOutOfView && playingId !== null && (
                      <button
                        onClick={jumpToCurrentSentence}
                        className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-md ring-1 ring-border backdrop-blur hover:bg-background"
                      >
                        <ArrowDownToLine className="h-3 w-3" />
                        Current
                      </button>
                    )}

                  </aside>
              </div>
              </div>

              {/* Aha Panel — primary learning surface.
                  Desktop / tablet: side panel in the right column.
                  Mobile: rendered below as a bottom Sheet so the transcript stays the primary interaction layer. */}
              {studyMode && (
                <div className="hidden lg:block min-w-0 order-2 lg:sticky lg:top-[68px] lg:self-start lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto">
                  <ExplanationPanel
                    sentence={selected}
                    entry={
                      selected ? explanationCache[selected.id] : undefined
                    }
                    onClose={resumeFromHere}
                    onReplay={replaySelected}
                    onResume={resumeFromHere}
                    onSave={() => handleSaveExpression(selected)}
                    isSaved={isSentenceSaved(selected)}
                    justSaved={!!selected && justSavedId === selected.id}
                    saving={saveExpressionMutation.isPending}
                    limitedMode={limitedMode}
                    sourceLangLabel={languageLabel(transcriptLanguage || spokenLang)}
                    targetLangLabel={targetLang}
                    onSaveExpression={(head, meaning) => handleSaveSingleExpression(selected, head, meaning)}
                    savedExpressionHeads={savedExpressionHeads}
                    savingExpressionHead={savingExpressionHead}
                    justSavedExpressionHead={justSavedExpressionHead}
                  />
                </div>
              )}

              {/* Mobile Aha Panel as a bottom Sheet. Closing or swiping down resumes playback. */}
              {studyMode && isMobile && (
                <Sheet
                  open={!!selected}
                  onOpenChange={(open) => {
                    if (!open) resumeFromHere();
                  }}
                >
                  <SheetContent
                    side="bottom"
                    className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-t p-0"
                  >
                    <div className="p-4 pt-8">
                      <ExplanationPanel
                        sentence={selected}
                        entry={
                          selected ? explanationCache[selected.id] : undefined
                        }
                        onClose={resumeFromHere}
                        onReplay={replaySelected}
                        onResume={resumeFromHere}
                        onSave={() => handleSaveExpression(selected)}
                        isSaved={isSentenceSaved(selected)}
                        justSaved={!!selected && justSavedId === selected.id}
                        saving={saveExpressionMutation.isPending}
                        limitedMode={limitedMode}
                        sourceLangLabel={languageLabel(transcriptLanguage || spokenLang)}
                        targetLangLabel={targetLang}
                        onSaveExpression={(head, meaning) => handleSaveSingleExpression(selected, head, meaning)}
                        savedExpressionHeads={savedExpressionHeads}
                        savingExpressionHead={savingExpressionHead}
                        justSavedExpressionHead={justSavedExpressionHead}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
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

      {showOnboarding && view === "demo" && studyMode && (
        <SentenceCoachmark
          containerRef={listRef}
          onDismiss={() => dismissOnboarding(false)}
        />
      )}
      {showPlayNudge && view === "demo" && studyMode && (
        <PlayNudge onDismiss={() => setShowPlayNudge(false)} />
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
      <AuthDialog
        open={authOpen}
        onOpenChange={(v) => {
          setAuthOpen(v);
          if (!v) pendingActionRef.current = null;
        }}
      />
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
  const empty = {
    translation: "",
    keyExpression: "",
    keyExpressions: "",
    whatsHappening: "",
    whyThisWay: "",
    vocabulary: "",
    note: "",
    grammar: "",
  };
  if (!text) return empty;
  const get = (...labels: string[]) => {
    for (const label of labels) {
      const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im");
      const m = text.match(re);
      if (m) return m[1].trim();
    }
    return "";
  };
  const clean = (v: string) => (v === "—" || v === "-" ? "" : v);
  return {
    translation: clean(get("Meaning", "Natural Translation", "Translation")),
    keyExpression: clean(get("Key Expression", "Expression")),
    keyExpressions: clean(get("Key Expressions")),
    whatsHappening: clean(get("Context", "What's Happening", "Whats Happening", "What is Happening")),
    whyThisWay: clean(get("Why Speakers Say It This Way", "Why Native Speakers Say It This Way", "Why This Way")),
    vocabulary: clean(get("Vocabulary", "Vocab")),
    note: clean(get("Usage Notes", "Usage Note", "Note", "Notes", "Expression Notes")),
    grammar: clean(get("Grammar Insight", "Grammar")),
  };
}

type ExplanationPanelEntry =
  | { status: "loading" }
  | {
      status: "ready";
      translation: string;
      keyExpression: string;
      keyExpressions: string;
      whatsHappening: string;
      whyThisWay: string;
      vocabulary: string;
      note: string;
      grammar: string;
    }
  | { status: "error"; error: string };

function ExplanationPanel({
  sentence,
  entry,
  onClose,
  onReplay,
  onResume,
  onSave,
  isSaved,
  justSaved,
  saving,
  limitedMode = false,
  sourceLangLabel,
  targetLangLabel,
  onSaveExpression,
  savedExpressionHeads,
  savingExpressionHead,
  justSavedExpressionHead,
}: {
  sentence: TranscriptSentence | null;
  entry: ExplanationPanelEntry | undefined;
  onClose: () => void;
  onReplay: () => void;
  onResume?: () => void;
  onSave: () => void;
  isSaved: boolean;
  justSaved: boolean;
  saving: boolean;
  limitedMode?: boolean;
  sourceLangLabel?: string;
  targetLangLabel?: string;
  onSaveExpression?: (head: string, meaning: string) => void;
  savedExpressionHeads?: Set<string>;
  savingExpressionHead?: string | null;
  justSavedExpressionHead?: string | null;
}) {
  // Active expression state — only one phrase highlighted at a time in the original sentence.
  // (Hoisted above the early empty-state return so hook order stays stable across renders.)
  const [activePhrase, setActivePhrase] = useState<string | null>(null);
  useEffect(() => {
    setActivePhrase(null);
  }, [sentence?.id]);

  if (!sentence) {
    // Onboarding/empty state — uses the SAME ExplanationSections renderer as the real panel,
    // just with example placeholder content. This guarantees the preview can never drift from
    // the actual experience.
    const sampleModel: ExplanationModel = {
      meaning: "More and more roads are now limited to 30 km/h.",
      keyExpressions: [
        { head: "steeds meer", meaning: "more and more" },
        { head: "nog maar", meaning: "only" },
      ],
      context: "Optional — only shown when it actually helps.",
      grammar: "", // collapsed; renders the fallback message inside the boxed section
    };
    return (
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-4 shadow-md ring-1 ring-primary/10 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,oklch(0.55_0.22_265/0.10),transparent_70%)]"
        />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">AI Explanation</p>
            <p className="text-base font-semibold leading-tight text-foreground">Tap any sentence to understand it</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          One natural translation, 1–3 useful expressions, and grammar when it helps. Stay in the flow.
        </p>
        <div className="mt-4">
          <ExplanationSections model={sampleModel} />
        </div>
        <p className="mt-4 text-center text-xs font-medium text-primary">
          👆 Tap a sentence below to see the real thing
        </p>
      </div>
    );
  }


  const ready = entry && entry.status === "ready" ? entry : null;
  const isLoading = !entry || entry.status === "loading";
  const error = entry && entry.status === "error" ? entry.error : null;
  const saveDisabled = saving || isSaved || !ready;
  const srcLabel = sourceLangLabel || "Original";
  const tgtLabel = targetLangLabel || "English";
  void tgtLabel;
  const highlightPhrases = ready
    ? collectHighlightPhrases(ready.keyExpressions, ready.vocabulary, ready.keyExpression)
    : [];

  // (activePhrase state hoisted above the empty-state return.)

  const handleSelectPhrase = (phrase: string) => {
    setActivePhrase((prev) => (prev && prev.toLowerCase() === phrase.toLowerCase() ? null : phrase));
  };

  const sentenceHighlights = activePhrase
    ? highlightPhrases.filter((p) => p.toLowerCase() === activePhrase.toLowerCase())
    : [];


  return (
    <div className="rounded-2xl bg-muted/30 p-5 sm:p-6">
      {/* Sentence-first header. Reduced size so the learning content (Key Expression) leads the eye. */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {srcLabel}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-base leading-relaxed text-foreground sm:text-lg">
          <SentenceWithHighlights text={sentence.text} phrases={sentenceHighlights} />
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {onResume && (
            <Button
              size="sm"
              onClick={onResume}
              className="h-8 gap-1.5 rounded-full px-3 text-xs font-semibold"
            >
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onReplay}
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Repeat className="h-3.5 w-3.5" /> Replay
          </Button>
          {!limitedMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSave}
              disabled={saveDisabled}
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              title={
                isSaved
                  ? "Already in My Library"
                  : ready
                    ? "Save to My Library"
                    : "Wait for explanation to load"
              }
            >
              {justSaved ? (
                <><Check className="h-3.5 w-3.5" /> Saved</>
              ) : isSaved ? (
                <><BookmarkCheck className="h-3.5 w-3.5" /> In Library</>
              ) : (
                <><Bookmark className="h-3.5 w-3.5" /> Save</>
              )}
            </Button>
          )}
        </div>
      </div>


      {justSaved && (
        <p className="mt-2 text-xs font-medium text-primary">
          Saved to My Expressions ✓
        </p>
      )}


      <div className="mt-4 pt-4 border-t border-border/60">
        {limitedMode ? (
          <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Sentence explanations are not available for this video, but you can still use the transcript while watching.
          </div>
        ) : ready ? (
          (() => {
            const model = buildExplanationModel(ready);
            const hasAny =
              !!model.meaning || model.keyExpressions.length > 0 || !!model.context || !!model.grammar;
            if (!hasAny) return <FallbackHint />;
            return (
              <ExplanationSections
                model={model}
                activePhrase={activePhrase}
                onSelectPhrase={handleSelectPhrase}
                onSaveExpression={onSaveExpression}
                savedExpressionHeads={savedExpressionHeads}
                savingExpressionHead={savingExpressionHead}
                justSavedExpressionHead={justSavedExpressionHead}
              />
            );
          })()













        ) : error ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <FallbackHint />
          </div>
        ) : (
          // Graceful fallback while the explanation is preloading — no spinner blocking the UI.
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Preparing translation and notes for this sentence…
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

// ---------------------------------------------------------------------------
// Canonical sentence-explanation model + renderer.
// Both the onboarding preview card and the live explanation panel render from
// this exact shape so they cannot drift apart. Section order is fixed:
//   1. Meaning  2. Useful expressions  3. Quick context (optional)  4. Grammar ▼
// ---------------------------------------------------------------------------

export type ExplanationExpression = { head: string; meaning: string; tag?: string };

export type ExplanationModel = {
  meaning: string;
  keyExpressions: ExplanationExpression[];
  context?: string;
  /** Empty => Grammar row still renders with a "no notable pattern" fallback. */
  grammar?: string;
};

function buildExplanationModel(ready: {
  translation: string;
  keyExpression: string;
  keyExpressions: string;
  vocabulary: string;
  whatsHappening: string;
  grammar: string;
}): ExplanationModel {
  const rawExpr = [ready.keyExpressions || ready.keyExpression, ready.vocabulary]
    .filter(Boolean)
    .join(" · ");
  const keyExpressions = parseExpressionItems(rawExpr).slice(0, 3);
  const context =
    ready.whatsHappening && shouldShowContext(ready.whatsHappening, ready.translation)
      ? truncateContext(ready.whatsHappening)
      : undefined;
  return {
    meaning: ready.translation || "",
    keyExpressions,
    context,
    grammar: ready.grammar || "",
  };
}

function SectionBox({
  label,
  children,
  asDetails = false,
}: {
  label: string;
  children: ReactNode;
  asDetails?: boolean;
}) {
  const labelEl = (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/80">{label}</p>
  );
  if (asDetails) {
    return (
      <details className="group rounded-xl border border-border/70 bg-background/60 px-3 py-2.5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
          {labelEl}
          <ChevronDown className="h-3 w-3 text-primary/70 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-1.5">{children}</div>
      </details>
    );
  }
  return (
    <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2.5">
      {labelEl}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ExplanationSections({
  model,
  activePhrase,
  onSelectPhrase,
  onSaveExpression,
  savedExpressionHeads,
  savingExpressionHead,
  justSavedExpressionHead,
}: {
  model: ExplanationModel;
  activePhrase?: string | null;
  onSelectPhrase?: (phrase: string) => void;
  onSaveExpression?: (head: string, meaning: string) => void;
  savedExpressionHeads?: Set<string>;
  savingExpressionHead?: string | null;
  justSavedExpressionHead?: string | null;
}) {
  return (
    <div className="space-y-2.5">
      <SectionBox label="Meaning">
        <p className="text-sm font-normal leading-snug text-foreground">
          {model.meaning || "—"}
        </p>
      </SectionBox>

      {model.keyExpressions.length > 0 && (
        <SectionBox label="Useful expressions">
          <ul className="space-y-1">
            {model.keyExpressions.map((it, i) => {
              const isActive =
                !!activePhrase && activePhrase.toLowerCase() === it.head.toLowerCase();
              const headKey = it.head.trim().toLowerCase();
              const isExprSaved = !!savedExpressionHeads?.has(headKey);
              const isExprSaving = savingExpressionHead === headKey;
              const isExprJustSaved = justSavedExpressionHead === headKey;
              const inner = (
                <div className="flex flex-col gap-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                  <span
                    className={`font-bold text-foreground ${
                      isActive ? "rounded bg-primary/15 px-1 -mx-1" : ""
                    }`}
                  >
                    {it.head}
                  </span>
                  <span className="flex items-baseline gap-2">
                    {it.meaning && (
                      <span className="text-sm font-normal text-muted-foreground">
                        {it.meaning}
                      </span>
                    )}
                    {it.tag && (
                      <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-normal uppercase tracking-wide text-muted-foreground/70">
                        {it.tag}
                      </span>
                    )}
                  </span>
                </div>
              );
              return (
                <li key={i} className="flex items-start gap-1">
                  {onSelectPhrase ? (
                    <button
                      type="button"
                      onClick={() => onSelectPhrase(it.head)}
                      aria-pressed={isActive}
                      className="block flex-1 min-w-0 rounded-md text-left transition-colors hover:bg-muted/40"
                    >
                      {inner}
                    </button>
                  ) : (
                    <div className="flex-1 min-w-0">{inner}</div>
                  )}
                  {onSaveExpression && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isExprSaved || isExprSaving) return;
                        onSaveExpression(it.head, it.meaning || "");
                      }}
                      disabled={isExprSaved || isExprSaving}
                      aria-label={isExprSaved ? "Saved to My Library" : "Save expression"}
                      title={isExprSaved ? "In Library" : "Save expression"}
                      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary disabled:opacity-70"
                    >
                      {isExprJustSaved ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : isExprSaved ? (
                        <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </SectionBox>
      )}

      {model.context && (
        <SectionBox label="Quick context">
          <p className="text-sm leading-relaxed text-foreground/80">{model.context}</p>
        </SectionBox>
      )}

      {model.grammar && model.grammar.trim().length > 0 && (
        <SectionBox label="Grammar ▼" asDetails>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">
            {model.grammar}
          </p>
        </SectionBox>
      )}
    </div>
  );
}


function PreviewSection({ label, sample, mono = false }: { label: string; sample: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-primary/80">{label}</p>
      <p className={`mt-0.5 text-xs leading-relaxed text-muted-foreground/90 ${mono ? "font-mono" : ""}`}>
        {sample}
      </p>
    </div>
  );
}

// KeyExpressionHero removed — the redesigned panel surfaces expressions inside UsefulExpressions instead.



type VocabTier = "high" | "useful" | "basic";
type VocabItem = { tier: VocabTier; head: string; meaning: string };

function parseVocabulary(raw: string): VocabItem[] {
  return raw
    .split(/\s*(?:·|•|;|\|)\s*/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map<VocabItem>((item) => {
      const tierMatch = item.match(/^\[\s*(high|useful|basic)\s*\]\s*(.+)$/i);
      let tier: VocabTier = "useful";
      let rest = item;
      if (tierMatch) {
        tier = tierMatch[1].toLowerCase() as VocabTier;
        rest = tierMatch[2];
      }
      const [head, ...tailParts] = rest.split(/\s*=\s*/);
      return { tier, head: head.trim(), meaning: tailParts.join(" = ").trim() };
    })
    .filter((it) => it.head.length > 0);
}

const TIER_META: Record<VocabTier, { label: string; dot: string; text: string }> = {
  high: { label: "High value", dot: "bg-primary", text: "text-primary" },
  useful: { label: "Useful", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  basic: { label: "Basic", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
};

function TieredVocabulary({ raw }: { raw: string }) {
  // Kept for backwards-compat (e.g. saved.tsx). New panel uses UsefulExpressions.
  const items = parseVocabulary(raw);
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Vocabulary
      </h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((it, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
          >
            <span className="font-semibold text-foreground">{it.head}</span>
            {it.meaning && (
              <span className="text-muted-foreground">{it.meaning}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// New: compact, scannable list. 2–4 items, source phrase + short meaning.
function UsefulExpressions({ raw, fallbackKey }: { raw: string; fallbackKey?: string }) {
  const items = parseVocabulary(raw).slice(0, 4);
  // If model returned "—" for vocabulary but produced a key expression, surface it as one item.
  if (items.length === 0 && fallbackKey) {
    const [head, ...rest] = fallbackKey.split(/\s*=\s*/);
    if (head) items.push({ tier: "useful", head: head.trim(), meaning: rest.join(" = ").trim() });
  }
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Useful expressions
      </h4>
      <ul className="mt-2 divide-y divide-border/60 rounded-lg border border-border/60 bg-background/60">
        {items.map((it, i) => (
          <li key={i} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <span className="font-semibold text-foreground">{it.head}</span>
            {it.meaning && (
              <span className="text-sm text-muted-foreground">{it.meaning}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- New compact expression list with optional [tag] badges. ----

type ExpressionItem = { head: string; meaning: string; tag?: string };

function parseExpressionItems(raw: string): ExpressionItem[] {
  return raw
    .split(/\s*(?:·|•|;|\|)\s*/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map<ExpressionItem>((item) => {
      // Optional trailing [Tag]
      const tagMatch = item.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
      let tag: string | undefined;
      let rest = item;
      if (tagMatch) {
        tag = tagMatch[2].trim();
        rest = tagMatch[1].trim();
      }
      const [head, ...tailParts] = rest.split(/\s*=\s*/);
      return { head: (head || "").trim(), meaning: tailParts.join(" = ").trim(), tag };
    })
    .filter((it) => it.head.length > 0);
}

function ExpressionList({
  label,
  raw,
  max = 2,
  activePhrase,
  onSelect,
}: {
  label: string;
  raw: string;
  max?: number;
  activePhrase?: string | null;
  onSelect?: (phrase: string) => void;
}) {
  const items = parseExpressionItems(raw).slice(0, max);
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </h4>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => {
          const isActive = !!activePhrase && activePhrase.toLowerCase() === it.head.toLowerCase();
          const clickable = !!onSelect;
          const Inner = (
            <>
              <span className={`font-bold text-foreground ${isActive ? "bg-primary/15 rounded px-1 -mx-1" : ""}`}>
                {it.head}
              </span>
              <span className="flex items-baseline gap-2">
                {it.meaning && (
                  <span className="text-sm font-normal text-muted-foreground">{it.meaning}</span>
                )}
                {it.tag && (
                  <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-normal uppercase tracking-wide text-muted-foreground/70">
                    {it.tag}
                  </span>
                )}
              </span>
            </>
          );
          return (
            <li key={i}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onSelect?.(it.head)}
                  className="flex w-full flex-col gap-0 rounded-md text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
                  aria-pressed={isActive}
                >
                  {Inner}
                </button>
              ) : (
                <div className="flex flex-col gap-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                  {Inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}


function truncateContext(s: string, limit = 140) {
  const t = s.trim();
  if (t.length <= limit) return t;
  return t.slice(0, limit - 1).replace(/\s+\S*$/, "") + "…";
}

// Hide Context when it's empty, a dash, or essentially restates the translation.
function shouldShowContext(ctx: string | undefined, translation: string | undefined): boolean {
  const c = (ctx || "").trim();
  if (!c || c === "—") return false;
  if (c.length < 12) return false;
  if (!translation) return true;
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const cN = norm(c);
  const tN = norm(translation);
  if (!cN || !tN) return true;
  if (cN === tN || cN.includes(tN) || tN.includes(cN)) return false;
  // token-overlap heuristic — if context mostly re-uses translation words, skip it.
  const tTokens = new Set(tN.split(" ").filter((w) => w.length >= 4));
  if (tTokens.size === 0) return true;
  const cTokens = cN.split(" ").filter((w) => w.length >= 4);
  if (cTokens.length === 0) return true;
  let overlap = 0;
  for (const w of cTokens) if (tTokens.has(w)) overlap++;
  return overlap / cTokens.length < 0.7;
}


// Pull source-language phrases out of the expression/vocab lines so we can highlight them in-sentence.
function collectHighlightPhrases(...raws: string[]): string[] {
  const phrases: string[] = [];
  for (const raw of raws) {
    if (!raw) continue;
    for (const it of parseExpressionItems(raw)) {
      if (it.head) phrases.push(it.head);
    }
  }
  // De-dup, prefer longer matches first so they take precedence in the highlighter.
  return Array.from(new Set(phrases)).sort((a, b) => b.length - a.length);
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function SentenceWithHighlights({ text, phrases }: { text: string; phrases: string[] }) {
  if (!phrases.length) return <>{text}</>;
  const pattern = new RegExp(`(${phrases.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        const isMatch = i % 2 === 1;
        if (!isMatch) return <span key={i}>{part}</span>;
        return (
          <mark
            key={i}
            className="rounded bg-primary/20 px-0.5 text-foreground"
          >
            {part}
          </mark>
        );
      })}
    </>
  );
}


function GrammarDetails({ grammar }: { grammar?: string }) {
  const hasGrammar = !!grammar && grammar.trim().length > 0;
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <span>Grammar</span>
        <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
      </summary>
      {hasGrammar ? (
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/80">{grammar}</p>
      ) : (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground/80">
          No notable grammar pattern in this sentence.
        </p>
      )}
    </details>
  );
}


function InlineExplanation({
  entry,
  limitedMode,
}: {
  entry: ExplanationPanelEntry | undefined;
  limitedMode: boolean;
}) {
  if (limitedMode) {
    return (
      <p className="text-xs text-amber-800 dark:text-amber-200">
        Sentence explanations are not available for this video.
      </p>
    );
  }
  if (!entry || entry.status === "loading") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading translation…
      </p>
    );
  }
  if (entry.status === "error") {
    return <p className="text-xs text-destructive">{entry.error}</p>;
  }
  const model = buildExplanationModel(entry);
  const hasAny =
    !!model.meaning || model.keyExpressions.length > 0 || !!model.context || !!model.grammar;
  if (!hasAny) {
    return <FallbackHint />;
  }
  return <ExplanationSections model={model} />;
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
    "Persian",
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
  "Vietnamese","Thai","Greek","Czech","Persian",
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
  { label: "Persian", code: "fa" },
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
  onSubmit: (u: string, lang?: string) => void;
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
  onSubmit: (u: string, lang?: string) => void;
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
            Never leave the video to figure out what was just said. Get translation and expression notes in one tap.
          </p>

          <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-lg shadow-primary/10 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 min-w-0">
                <label htmlFor="hero-lang" className="text-xs font-medium text-foreground">
                  Explanation language
                </label>
                <Select value={targetLang} onValueChange={setTargetLang}>
                  <SelectTrigger id="hero-lang" className="h-11 w-full rounded-xl bg-background px-4">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {HERO_LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-0">
                <label htmlFor="hero-spoken-lang" className="text-xs font-medium text-foreground">
                  Video language
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
              </div>
            </div>

            <div className="mt-4">
              <YouTubeDiscovery
                loading={loading}
                onPick={(u, lang) => {
                  if (lang) setSpokenLang(lang);
                  track("landing_cta_clicked", { has_url: true, spoken_language: lang || spokenLang || "auto" });
                  setUrl(u);
                  onSubmit(u, lang);
                }}
              />
            </div>

            {loading && (
              <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Preparing your video…
              </p>
            )}
          </div>

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
  note: string;
};

const PREVIEW_MOMENTS: PreviewMoment[] = [
  {
    t: "0:17",
    sentence: "Rij eens door, man.",
    translation: "Come on, keep driving.",
    note: "Not literal — 'eens' here softens the command, like a casual nudge.",
  },
  {
    t: "0:42",
    sentence: "Dat slaat nergens op.",
    translation: "That makes no sense at all.",
    note: "'Slaat nergens op' is everyday spoken Dutch — you'll hear it constantly.",
  },
  {
    t: "1:08",
    sentence: "Ik heb er geen zin in.",
    translation: "I don't feel like it.",
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
  const languages = ["Dutch", "English", "Spanish", "French", "German", "Italian", "Portuguese", "Persian"];
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
    { emoji: "💡", title: "Understand difficult sentences instantly", desc: "Translations appear as you watch." },
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
          <p className="inline-flex items-center gap-1.5 text-[11px] leading-relaxed opacity-90">
            <span aria-hidden>ⓘ</span>
            <span>Subtitle quality varies for this video.</span>
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

function languageLabel(code: string | null | undefined): string {
  if (!code) return "";
  const base = code.toLowerCase().split(/[-_]/)[0];
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "language" });
    return dn.of(base) || base.toUpperCase();
  } catch {
    return base.toUpperCase();
  }
}
