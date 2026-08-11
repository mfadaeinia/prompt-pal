import { Link } from "@tanstack/react-router";
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
import { Loader2, PlayCircle, Repeat, Sparkles, X, Play, MousePointerClick, Brain, Tv, Zap, ArrowRight, Bookmark, BookmarkCheck, Check, LogOut, GraduationCap } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { track, setUserProperties } from "@/lib/analytics";

import { FeedbackWidget, FeedbackFab } from "@/components/FeedbackWidget";
import { SentenceCoachmark, PlayNudge } from "@/components/OnboardingOverlay";
import { DevAnalyticsPanel, isDevPanelEnabled } from "@/components/DevAnalyticsPanel";
import { MarketingLanding } from "@/components/MarketingLanding";
import { YouTubeDiscovery } from "@/components/YouTubeDiscovery";
import { AppOnboarding } from "@/components/AppOnboarding";
import { LibraryStrip } from "@/components/LibraryStrip";
import { AppFooter } from "@/components/AppFooter";
import { UsefulExpressionBar } from "@/components/UsefulExpressionBar";
import { VideoSubtitle } from "@/components/VideoSubtitle";
import { pickUsefulExpression } from "@/lib/useful-expression";
import {
  type CefrLevel,
  type DensityTracker,
  type ScoredCandidate,
  createDensityTracker,
} from "@/lib/expression-ranking";
import {
  DEFAULT_LEARNER_LEVEL,
  readStoredLearnerLevel,
} from "@/lib/learner-level";

import { trackWatch, deviceType } from "@/lib/watch-analytics";


import { useIsMobile } from "@/hooks/use-mobile";
import { BookOpen, ChevronDown, ArrowDownToLine, Languages } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Drawer, DrawerContent } from "@/components/ui/drawer";


const DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=3GHwKtBtdfk";
const DEMO_VIDEO_ID = "3GHwKtBtdfk";
const DEMO_LANGUAGE = "Dutch";

/** Map a language label or tag to ISO-639-1 for the caption pipeline. */
const LANG_LABEL_TO_ISO: Record<string, string> = {
  dutch: "nl", nederlands: "nl", english: "en", german: "de", duits: "de",
  french: "fr", spanish: "es", italian: "it", portuguese: "pt", polish: "pl",
  russian: "ru", turkish: "tr", arabic: "ar", persian: "fa", farsi: "fa",
  japanese: "ja", chinese: "zh", korean: "ko", swedish: "sv", danish: "da",
  norwegian: "no", finnish: "fi", ukrainian: "uk", hindi: "hi",
};
function normalizeSpokenLang(input?: string | null): string | undefined {
  if (!input) return undefined;
  const raw = input.trim().toLowerCase();
  if (!raw || raw === "_any_" || raw === "auto") return undefined;
  const base = raw.split(/[-_]/)[0];
  if (LANG_LABEL_TO_ISO[base]) return LANG_LABEL_TO_ISO[base];
  return /^[a-z]{2,3}$/.test(base) ? base : undefined;
}




export function HomeApp({ experiment = false }: { experiment?: boolean }) {
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
  // Restore the learner's explanation language across sessions.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("nf.explainLanguage");
      if (stored) setTargetLang(stored);
    } catch { /* ignore */ }
  }, []);

  // Learner CEFR level — an experiment-only personalization input. The public
  // product treats CEFR as metadata/filtering only, so it never silently reads
  // a stored level to personalize ranking (data + helpers stay intact).
  const [learnerLevel, setLearnerLevel] = useState<CefrLevel>(DEFAULT_LEARNER_LEVEL);
  useEffect(() => {
    if (!experiment) return;
    const stored = readStoredLearnerLevel();
    if (stored) setLearnerLevel(stored);
  }, [experiment]);


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
    const params = new URLSearchParams(window.location.search);
    if (params.get("v")) return "demo";
    // Entry from a marketing landing variant (e.g. /english-learners)
    const start = params.get("start");
    if (start === "demo") return "demo";
    if (start === "app") return "app";
    return "landing";
  });

  const [tryUrl, setTryUrl] = useState("");

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPlayNudge, setShowPlayNudge] = useState(false);
  const hasInteractedWithSentenceRef = useRef(false);
  const playNudgeTimerRef = useRef<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackTrigger, setFeedbackTrigger] = useState<string>("");
  const isMobile = useIsMobile();
  const [studyMode, setStudyMode] = useState(true);
  // Experiment: watching is primary. The transcript is an optional layer and
  // the deep explanation only opens when the learner asks for it.
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [expressionExpanded, setExpressionExpanded] = useState(false);
  // Auto-follow: in Watch Mode the transcript scrolls with playback. In Learning Mode
  // the spec says auto-follow defaults OFF — the learner drives via sentence taps.
  const [focusMode, setFocusMode] = useState(false);
  // Video id for which the "cannot be used in Learning Mode" panel was dismissed
  // via "Keep watching" — lets the learner keep watching the video.
  const [errorPanelDismissedFor, setErrorPanelDismissedFor] = useState<string | null>(null);
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

  // Persist last-watched video so the Learning Hub can show "Continue watching".
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!videoId) return;
    try {
      sessionStorage.setItem(
        "nativeflow_last_video",
        JSON.stringify({
          videoId,
          videoTitle: videoTitle || null,
          url: url || `https://www.youtube.com/watch?v=${videoId}`,
          targetLang: targetLang || null,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          ts: Date.now(),
        }),
      );
    } catch {}
  }, [videoId, videoTitle, url, targetLang]);

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

  // Arriving from a marketing landing variant with ?start=app — if the visitor
  // isn't signed in yet, open the auth dialog and remember the intent.
  const startIntentRef = useRef(false);
  useEffect(() => {
    if (startIntentRef.current) return;
    if (typeof window === "undefined" || authLoading) return;
    const params = new URLSearchParams(window.location.search);
    const start = params.get("start");
    if (!start) return;
    startIntentRef.current = true;
    if (start === "app" && !isAuthenticated) {
      sessionStorage.setItem("nativeflow_post_auth_intent", "enter_app");
      pendingActionRef.current = () => setView("app");
      setAuthOpen(true);
    }
    params.delete("start");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [authLoading, isAuthenticated]);


  // Auto-load a video when arriving from a saved-library link (e.g. /?url=...)
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const u = params.get("url") ?? params.get("v");
    const lang = params.get("lang") ?? undefined;
    if (u && /youtu/.test(u)) {
      autoLoadedRef.current = true;
      setUrl(u);
      setView("demo");
      submitLoad(u, lang);

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
    setSpokenLang("nl");
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
    // Authenticated users stay inside the app experience (Learning Hub)
    // rather than being kicked back to the marketing landing page.
    setView(isAuthenticated ? "app" : "landing");
    setVideoId(null);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const handleSignOut = async () => {
    try {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
    } catch {
      // Ignore network failures — the local session is cleared either way.
    }
    setView("landing");
    setVideoId(null);
    try {
      sessionStorage.removeItem("nativeflow_post_auth_intent");
    } catch {}
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const navTo = (hash: string) => {
    const scroll = (attempt = 0) => {
      const el = document.getElementById(hash);
      if (!el) {
        if (attempt < 12) setTimeout(() => scroll(attempt + 1), 100);
        return;
      }
      const top = el.getBoundingClientRect().top + window.scrollY - 72;
      const start = window.scrollY;
      window.scrollTo({ top, behavior: "smooth" });
      // Some environments silently ignore smooth scrolling — jump if nothing moved.
      setTimeout(() => {
        if (Math.abs(window.scrollY - start) < 4) window.scrollTo(0, top);
      }, 350);
    };
    if (view !== "landing") {
      setView("landing");
      setTimeout(() => scroll(), 100);
    } else {
      scroll();
    }
  };

  // Light-first design system: learning mode uses the same bright surfaces as
  // the rest of the product. Clear any legacy dark class left on <html>.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, [view]);


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

      // A "ready" fast result is only good enough for Learning Mode when the
      // captions are dense enough. Low-quality auto-captions used to end the
      // pipeline here, which is why Whisper looked like it "never ran" and the
      // user was dumped into BASIC TRANSCRIPT MODE. Keep it as a safety net and
      // upgrade via Whisper instead.
      const fastFallback = fast.status === "ready" ? fast.result : null;
      const fastIsGoodEnough =
        fastFallback != null && fastFallback.quality.quality !== "low";

      if (fastFallback && fastIsGoodEnough) {
        const startedAt = loadStartedAtRef.current ?? 0;
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        perfLog("first_chunk_rendered", {
          path: "fast",
          source: fastFallback.source,
          cache_hit: !!fastFallback.cacheHit,
          sentence_count: fastFallback.sentences.length,
          elapsed_ms: Math.round(now - startedAt),
        });
        perfFirstChunkLoggedRef.current = true;
        return { res: fastFallback, vars, viaSlowPath: false };
      }

      if (fastFallback) {
        console.warn("[transcript-debug][client] fast transcript low quality — upgrading via Whisper", {
          videoId: fastFallback.videoId,
          reasons: fastFallback.quality.reasons,
          sentence_count: fastFallback.sentences.length,
        });
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

      type StreamPayload = {
        res: FetchTranscriptResult;
        vars: LoadVars;
        viaSlowPath: true;
        streaming: true;
      };
      const MAX_STREAM_ATTEMPTS = 2;
      const openStream = (attempt: number) => new Promise<StreamPayload>((resolve, reject) => {
        const es = new EventSource(`${streamUrl}&attempt=${attempt}`);

        streamRef.current = es;
        const mySeq = vars.seq;
        let resolved = false;
        let lastVideoId =
          fastFallback?.videoId ??
          (fast.status !== "ready" ? fast.videoId : null) ??
          vars.requestedVideoId ??
          null;

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
          // failures. If we already resolved, keep what we have; otherwise
          // retry once, then fall back to the low-quality fast transcript so
          // the user never hits a silent dead end.
          let payload: any = null;
          try { payload = JSON.parse((ev as MessageEvent).data ?? ""); } catch {}
          const msg = payload?.message || "transcript stream failed";
          console.error("[transcript-debug][client] whisper stream failed", {
            attempt,
            videoId: lastVideoId,
            stage: payload?.stage ?? null,
            message: msg,
          });
          closeStream();
          if (resolved) {
            // Partial transcript already showing — promote to "ready" so the
            // UI stops the spinner; user has something to learn from.
            setTranscriptStatus("ready");
            return;
          }
          if (mySeq !== requestSeqRef.current) {
            reject(Object.assign(new Error(msg), { errorType: "asr_failed" }));
            return;
          }
          if (attempt < MAX_STREAM_ATTEMPTS) {
            track("transcript_asr_retry", { video_id: lastVideoId, attempt, message: msg });
            setTranscriptStatus("generating_transcript");
            window.setTimeout(() => {
              openStream(attempt + 1).then(resolve, reject);
            }, 1200);
            return;
          }
          if (fastFallback) {
            console.warn("[transcript-debug][client] Whisper unavailable — using low-quality captions", {
              videoId: fastFallback.videoId,
            });
            track("transcript_asr_fallback_to_captions", {
              video_id: fastFallback.videoId,
              message: msg,
            });
            resolve({ res: fastFallback, vars, viaSlowPath: true, streaming: false as unknown as true });
            return;
          }
          reject(Object.assign(new Error(msg), { errorType: "asr_failed" }));
        });
      });

      return await openStream(1);

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
      manualSelectedRef.current = false;
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
  const submitLoad = (u: string, spokenLanguageOverrideRaw?: string) => {
    // Defensive: callers sometimes pass a human-readable label ("Dutch").
    // The caption pipeline needs ISO-639-1, otherwise the requested track
    // doesn't exist and YouTube falls back to an English (auto-translated) one.
    const spokenLanguageOverride = normalizeSpokenLang(spokenLanguageOverrideRaw);
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
    manualSelectedRef.current = false;
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
      manualSelectedRef.current = false;
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
        /** Raw model output — Stage 1 candidate block lives here. */
        raw: string;
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

  /**
   * Switch the language explanations are written in. Persisted, and clears the
   * cached explanations so the current sentence is re-explained immediately.
   */
  function changeExplanationLanguage(lang: string) {
    if (lang === targetLang) return;
    setTargetLang(lang);
    try {
      window.localStorage.setItem("nf.explainLanguage", lang);
    } catch { /* ignore */ }
    setExplanationCache({});
    inFlightRef.current = new Set();
    track("explanation_language_changed", { target_language: lang });
  }

  // Current video id, readable from async callbacks (stale-response guard).
  const videoIdRef = useRef<string | null>(null);
  // Last auto-surfaced expression head, so we fire expression_auto_shown once.
  const lastAutoExpressionRef = useRef<string | null>(null);

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
    // Guard against a response from a PREVIOUS video landing in the cache of
    // the current one (sentence ids restart at 0 for every video).
    const requestVideoId = videoId;
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
        if (videoIdRef.current !== requestVideoId) return; // stale video — drop
        const parsed = parseExplanation(res.explanation ?? null);
        setExplanationCache((prev) => ({
          ...prev,
          [s.id]: {
            status: "ready",
            raw: res.explanation ?? "",
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
        {
          const clickedAt = sentenceClickAtRef.current.get(s.id);
          if (clickedAt != null) {
            const now = typeof performance !== "undefined" ? performance.now() : Date.now();
            perfLog("first_hint_shown", {
              sentence_id: s.id,
              is_prefetch: !!opts.isPrefetch,
              elapsed_ms_since_click: Math.round(now - clickedAt),
            });
            sentenceClickAtRef.current.delete(s.id);
          }
        }
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
        if (videoIdRef.current !== requestVideoId) return;
        setExplanationCache((prev) => ({
          ...prev,
          [s.id]: { status: "error", error: err?.message ?? "Failed to load" },
        }));
      })
      .finally(() => {
        inFlightRef.current.delete(s.id);
      });
  }

  // Reset all explanation/expression state when the video changes so no stale
  // meaning from a previous video can ever be displayed.
  useEffect(() => {
    videoIdRef.current = videoId;
    setExplanationCache({});
    inFlightRef.current = new Set();
    setSelected(null);
    manualSelectedRef.current = false;
    setExpressionExpanded(false);
    setTranscriptOpen(false);
    lastAutoExpressionRef.current = null;
    lastAutoExplainedRef.current = null;
    viewedExplanationRef.current = new Set();
    autoPreselectedForVideoRef.current = null;
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
  // Player-level failure (embedding disabled, removed/private video, bad id).
  // Without this the iframe just renders black and playback looks "broken".
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  useEffect(() => { setPlaybackError(null); }, [videoId]);
  const embedSrc = useMemo(() => {
    if (!videoId) return null;
    // playsinline=1 is required for inline playback on iOS Safari; without it
    // mobile hands off to the native fullscreen player and JS API sync breaks.
    // (No `origin` param: it would differ between SSR and client and cause a
    // hydration mismatch; the IFrame API works without it.)
    return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&playsinline=1`;
  }, [videoId]);



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
            // Initial rate (in case the user has a non-1× default).
            try {
              const r = playerRef.current?.getPlaybackRate?.();
              if (typeof r === "number" && r > 0) setPlaybackRate(r);
            } catch {}
            // Poll at ~25fps for tight highlight sync with speech.
            pollId = window.setInterval(() => {
              const p = playerRef.current;
              if (p && typeof p.getCurrentTime === "function") {
                setCurrentTime(p.getCurrentTime() || 0);
              }
            }, 40);

          },
          onError: (e: any) => {
            // 2 = invalid id, 5 = HTML5 player error,
            // 100 = removed/private, 101/150 = embedding disabled by owner.
            const code = Number(e?.data);
            const message =
              code === 101 || code === 150
                ? "The owner of this video doesn't allow it to be played outside YouTube."
                : code === 100
                  ? "This video is no longer available (removed or private)."
                  : code === 2
                    ? "This video link looks invalid."
                    : "This video couldn't be played here.";
            console.error("[player][error]", { videoId, code, message });
            track("video_playback_error", { video_id: videoId, code });
            setPlaybackError(message);
          },

          onPlaybackRateChange: (e: any) => {
            const r = typeof e?.data === "number" ? e.data : playerRef.current?.getPlaybackRate?.();
            if (typeof r === "number" && r > 0) setPlaybackRate(r);
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
  // True while the learner has an explicitly tapped sentence open. Manual
  // selection takes precedence over playback-driven auto-follow updates.
  const manualSelectedRef = useRef(false);

  // Track YouTube playback rate so we can keep the highlight lookahead
  // constant in wall-clock time across 0.25×–2× speeds.
  const [playbackRate, setPlaybackRate] = useState(1);

  // Wall-clock lookahead: the highlight switches ~120ms before the speaker
  // reaches the next sentence at any playback rate. Convert to video-time by
  // multiplying by the current rate (slower playback → smaller video-time
  // lookahead, faster → larger, so perceived earliness stays the same).
  const SYNC_OFFSET_WALL_SECONDS = 0.12;

  const playingId = useMemo(() => {
    if (!sentences.length) return null;
    if (manualActiveId !== null && performance.now() < manualUntilRef.current) {
      return manualActiveId;
    }
    const rate = playbackRate > 0 ? playbackRate : 1;
    const adjustedTime = currentTime + SYNC_OFFSET_WALL_SECONDS * rate;
    // Pick the last sentence whose start time has been reached. This avoids
    // brief "no active sentence" gaps between sentences when endTime < next
    // sentence's offset.
    let candidate: number | null = null;
    for (const s of sentences) {
      if (s.offset > adjustedTime) break;
      candidate = s.id;
    }
    return candidate;
  }, [currentTime, sentences, manualActiveId, playbackRate]);

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

    // First-time-only inline hint. Persisted in localStorage so once the user
    // performs their first successful sentence click, it never shows again.
    // On mobile/tablet we always show it on a fresh transcript load until the
    // user taps a sentence in this session — tap targets are less discoverable
    // without hover affordances.
    try {
      const seen = localStorage.getItem("nativeflow_sentence_hinted");
      if ((!seen || isMobile) && !hasInteractedWithSentenceRef.current) {
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
      // Mark as shown so subsequent renders won't re-trigger logging this session.
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
    try {
      localStorage.setItem("nativeflow_sentence_hinted", "1");
    } catch {}
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

    // Never fight a user who is actively scrolling the transcript.
    // When they scroll away, the floating "Jump to Current" affordance appears
    // (see activeOutOfView below) so they can re-sync explicitly.
    if (performance.now() < userScrollingUntilRef.current) return;

    // Keep the active sentence near the top of the transcript viewport
    // (second visible row) so users always see what is playing now.
    const targetVisibleTop = (isMobile && showSentenceHint) ? 120 : 48; // px — roughly one sentence below the top edge
    const drift = visibleTop - targetVisibleTop;
    const band = 24; // px dead-zone — don't jitter on tiny drifts
    if (Math.abs(drift) < band && fullyVisible) return;

    const desiredScrollTop = Math.max(0, eTop - targetVisibleTop);
    container.scrollTo({ top: desiredScrollTop, behavior: "smooth" });
  }, [playingId, focusMode, isMobile, showSentenceHint]);

  const stickySentence = useMemo(() => {
    if (!isMobile || !activeOutOfView || playingId == null) return null;
    return sentences.find((x) => x.id === playingId) ?? null;
  }, [isMobile, activeOutOfView, playingId, sentences]);

  // Sentence shown in the persistent "Current sentence" bar under the video.
  // Always follows playback so the highlight moves with the video; falls back
  // to the user's selection only when nothing is playing yet.
  const currentSentence = useMemo(() => {
    if (playingId != null) {
      const p = sentences.find((x) => x.id === playingId);
      if (p) return p;
    }
    return selected;
  }, [selected, playingId, sentences]);

  function jumpToCurrentSentence() {
    if (playingId == null || !listRef.current) return;
    const container = listRef.current;
    const el = container.querySelector<HTMLElement>(`[data-sid="${playingId}"]`);
    if (el) {
      const targetVisibleTop = (isMobile && showSentenceHint) ? 120 : 48; // px — align with auto-follow target
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
    // Manual selection wins: never overwrite a sentence the learner tapped.
    if (manualSelectedRef.current) return;
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
    // EXPERIMENT: nothing opens by itself. The learning layer under the video
    // carries the useful expression; the deep panel is opt-in.
    if (true) return;
    if (!studyMode) return;
    if (isMobile) return;
    if (!videoId) return;
    if (sentences.length === 0) return;
    if (selected) return;
    if (autoPreselectedForVideoRef.current === videoId) return;
    autoPreselectedForVideoRef.current = videoId;
    // Prefer the sentence currently playing (if playback already started),
    // otherwise the very first sentence of the transcript.
    const first =
      (playingId != null ? sentences.find((s) => s.id === playingId) : null) ?? sentences[0];
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

  // ---------------------------------------------------------------------
  // EXPERIMENT: quiet learning layer.
  // As playback moves, make sure the explanation for the sentence currently
  // being spoken exists (one lightweight request per sentence, reused from the
  // existing cache) and surface at most ONE useful expression from it.
  // Playback is never touched here.
  // ---------------------------------------------------------------------
  // Prefetch a small rolling window around the playing sentence so the
  // "Useful Dutch" queue can show what is coming up next, not just now.
  useEffect(() => {
    if (!studyMode || limitedMode) return;
    if (playingId == null) return;
    const idx = sentences.findIndex((x) => x.id === playingId);
    if (idx < 0) return;
    for (const s of sentences.slice(idx, idx + 3)) {
      ensureExplanation(s, sentences, { isPrefetch: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId, sentences, studyMode, limitedMode]);

  const autoSentence = useMemo(
    () => (playingId != null ? sentences.find((x) => x.id === playingId) ?? null : null),
    [playingId, sentences],
  );
  const autoEntry = autoSentence ? explanationCache[autoSentence.id] : undefined;

  // Stage 5 — per-video density + dedup guardrail. Rebuilt when the video or
  // the learner level changes (a level change re-ranks every candidate).
  const densityRef = useRef<DensityTracker>(
    createDensityTracker(() => playerRef.current?.getDuration?.() ?? 0),
  );
  const [acceptedExpressions, setAcceptedExpressions] = useState<
    Record<number, ScoredCandidate | null>
  >({});
  useEffect(() => {
    densityRef.current = createDensityTracker(
      () => playerRef.current?.getDuration?.() ?? 0,
    );
    setAcceptedExpressions({});
  }, [videoId, learnerLevel]);

  // Stages 1→5 for the sentence being spoken: candidates → signals → score →
  // quality gate → density/dedup. `null` (nothing worth showing) is normal.
  useEffect(() => {
    if (!autoSentence || !autoEntry || autoEntry.status !== "ready") return;
    if (autoSentence.id in acceptedExpressions) return;
    const best = pickUsefulExpression(
      {
        raw: autoEntry.raw,
        keyExpressions: autoEntry.keyExpressions,
        vocabulary: autoEntry.vocabulary,
      },
      { level: learnerLevel, sentence: autoSentence.text },
    );
    const accepted =
      best && densityRef.current.consider(best, autoSentence.offset) ? best : null;
    if (accepted) {
      perfLog("expression_selected", {
        head: accepted.head,
        score: accepted.score,
        level: learnerLevel,
        signals: accepted.trace.signals,
      });
    }
    setAcceptedExpressions((prev) =>
      autoSentence.id in prev ? prev : { ...prev, [autoSentence.id]: accepted },
    );
  }, [autoSentence, autoEntry, acceptedExpressions, learnerLevel]);

  const autoExpression = autoSentence
    ? acceptedExpressions[autoSentence.id] ?? null
    : null;

  const queueLoading = !autoExpression && autoEntry?.status === "loading";


  // previous / current / next sentence — enough context to follow the audio
  // without opening the full transcript.
  const contextLines = useMemo(() => {
    const idx = playingId != null ? sentences.findIndex((x) => x.id === playingId) : -1;
    if (idx < 0) {
      return { previous: null, current: sentences[0] ?? null, next: sentences[1] ?? null };
    }
    return {
      previous: sentences[idx - 1] ?? null,
      current: sentences[idx] ?? null,
      next: sentences[idx + 1] ?? null,
    };
  }, [playingId, sentences]);

  useEffect(() => {
    if (!autoExpression) return;
    if (lastAutoExpressionRef.current === autoExpression.head) return;
    lastAutoExpressionRef.current = autoExpression.head;
    trackWatch("expression_auto_shown", {
      video_id: videoId,
      expression: autoExpression.head,
      sentence_index: autoSentence ? sentences.findIndex((x) => x.id === autoSentence.id) : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExpression, videoId]);

  /** Optional deep dive for any sentence. Never pauses playback. */
  function openSentenceDetails(sentenceId: number, expression?: string | null) {
    const s = sentences.find((x) => x.id === sentenceId);
    if (!s) return;
    manualSelectedRef.current = true;
    manualUntilRef.current = 0;
    setSelected(s);
    setExpressionExpanded(true);
    ensureExplanation(s, sentences);
    trackWatch("expression_expanded", {
      video_id: videoId,
      expression: expression ?? null,
    });
  }

  /** Optional deep dive. Never pauses playback. */
  function openExpressionDetails() {
    if (!autoSentence) return;
    const next = !expressionExpanded;
    setExpressionExpanded(next);
    if (next) {
      manualSelectedRef.current = true;
      manualUntilRef.current = 0;
      setSelected(autoSentence);
      ensureExplanation(autoSentence, sentences);
      trackWatch("expression_expanded", {
        video_id: videoId,
        expression: autoExpression?.head ?? null,
      });
    } else {
      manualSelectedRef.current = false;
      setSelected(null);
    }
  }

  // ---- Watch-depth analytics (same event names on every device) -----------
  const watchMilestonesRef = useRef<Set<string>>(new Set());
  const videoStartedRef = useRef<string | null>(null);
  const videosStartedRef = useRef(0);
  useEffect(() => {
    watchMilestonesRef.current = new Set();
  }, [videoId]);
  useEffect(() => {
    if (!videoId || currentTime <= 0.5) return;
    const fired = watchMilestonesRef.current;
    if (videoStartedRef.current !== videoId) {
      videoStartedRef.current = videoId;
      videosStartedRef.current += 1;
      trackWatch("video_started", {
        video_id: videoId,
        user_id: userIdRef.current ?? null,
        session_id: sessionIdRef.current,
      });
      if (videosStartedRef.current > 1) {
        trackWatch("another_video_started", {
          video_id: videoId,
          videos_started: videosStartedRef.current,
          user_id: userIdRef.current ?? null,
          session_id: sessionIdRef.current,
        });
      }
    }
    const fire = (key: string, extra?: Record<string, unknown>) => {
      if (fired.has(key)) return;
      fired.add(key);
      trackWatch(key, {
        video_id: videoId,
        current_time: Math.round(currentTime),
        user_id: userIdRef.current ?? null,
        session_id: sessionIdRef.current,
        ...(extra ?? {}),
      });
    };
    if (currentTime >= 30) fire("video_watched_30s");
    if (currentTime >= 60) fire("video_watched_60s");
    let duration = 0;
    try {
      duration = playerRef.current?.getDuration?.() ?? 0;
    } catch {}
    if (duration > 10) {
      const pct = currentTime / duration;
      if (pct >= 0.25) fire("video_25_percent");
      if (pct >= 0.5) fire("video_50_percent");
      if (pct >= 0.75) fire("video_75_percent");
      if (pct >= 0.95) fire("video_completed", { duration_seconds: Math.round(duration) });
    }
  }, [currentTime, videoId]);

  // Sync diagnostics: log every transition between active sentences with the
  // perceived highlight delay (video currentTime vs. sentence start).
  const lastSyncLogRef = useRef(0);
  const lastPlayingIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!sentences.length) return;
    const active = sentences.find((s) => s.id === playingId) ?? null;
    const now = performance.now();
    const transitioned = playingId !== lastPlayingIdRef.current;
    if (transitioned && active) {
      const delayMs = Math.round((currentTime - active.offset) * 1000);
      console.log("[sync-transition]", {
        videoCurrentTime: Number(currentTime.toFixed(3)),
        sentenceStart: Number(active.offset.toFixed(3)),
        highlightDelayMs: delayMs,
        sentenceId: active.id,
      });
      lastPlayingIdRef.current = playingId;
    }
    if (now - lastSyncLogRef.current < 2000) return;
    lastSyncLogRef.current = now;
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

  // Resume playback ONLY. Playback state and the user's manual transcript
  // selection are independent: resuming must never clear the selected sentence
  // or replace the explanation the learner is reading.
  function resumeFromHere() {
    const p = playerRef.current;
    p?.playVideo?.();
    track("learning_resume", { video_id: videoId });
  }

  // Explicitly close the Aha Panel (clears manual selection) and resume playback.
  function closeAndResume() {
    setSelected(null);
    manualSelectedRef.current = false;
    resumeFromHere();
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
      manualSelectedRef.current = true;
      setSelected(s);
      if (!limitedMode) ensureExplanation(s, sentences);
      // EXPERIMENT: playback must never stop because the learner inspected
      // language. Seek to the sentence and keep playing.
      seekAndPlay(s);
    } else {
      seekAndPlay(s);
    }
    const idx = sentences.findIndex((x) => x.id === s.id);
    clickCountRef.current += 1;
    uniqueClickedRef.current.add(idx);
    trackWatch("transcript_sentence_clicked", {
      sentence_index: idx,
      video_id: videoId,
    });
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4 min-[1600px]:max-w-[1600px] min-[1600px]:px-12">
          <div className="flex min-w-0 items-center gap-2">
            {view === "demo" && (
              <button
                onClick={goHome}
                className="mr-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground hover:bg-accent sm:px-3"
                aria-label={isAuthenticated ? "Back to Learning Hub" : "Back to home"}
              >
                <span aria-hidden>←</span>
                <span className="hidden sm:inline">
                  {isAuthenticated ? "Back to Learning Hub" : "Back to Home"}
                </span>
              </button>
            )}
            <button
              onClick={goHome}
              className="flex min-w-0 items-center gap-2.5"
              aria-label="NativeFlow home"
            >
              <BrandLogo markClassName="h-8 w-8" wordClassName="hidden sm:inline" />
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3 min-[1600px]:gap-5">
            
            <Link
              to="/library"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Explore Dutch
            </Link>


            
            {devPanelEnabled && (
              <Link
                to="/founder"
                className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
              >
                Founder
              </Link>
            )}
            <div className="relative flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  {/* "Signed In" pulsing badge hidden in the cleaned-up public
                      header — sign-out alone communicates session state. */}

                  <button
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    title="Sign out"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                  title="Start for free to save your progress"
                >
                  Start for free
                </button>
              )}
            </div>
            {/* "My Learning" entry point hidden from the public header;
                /saved stays reachable by direct URL. */}
            {experiment && isAuthenticated && (

              <div className="relative">
                <Link
                  to="/saved"
                  className="relative inline-flex items-center gap-1.5 rounded-full border border-border bg-card p-2 text-xs font-medium text-foreground hover:bg-accent sm:px-3 sm:py-1.5"
                  onClick={() => {
                    track("my_expressions_opened", { from: view });
                    setShowSavedTooltip(false);
                    localStorage.setItem("nativeflow_saved_tooltip_seen", "1");
                  }}
                  aria-label="My Learning"
                  title="My Learning"
                >
                  <GraduationCap className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">My Learning</span>
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
            {/* "Save video" hidden from the public header (code preserved). */}
            {experiment && videoId && view !== "landing" && (

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
          </div>
        </div>
      </header>


      {view === "landing" && (
        <MarketingLanding
          onStartDemo={startDemo}
          onSubmitUrl={(u) => {
            track("custom_video_attempted", { video_url: u, spoken_language: "nl" });
            setUrl(u);
            setSpokenLang("nl");
            setView("demo");
            submitLoad(u, "nl");
          }}
          onFeedback={openFeedbackManually}
        />
      )}

      {view === "app" && (
        <AppOnboarding
          loading={loadMutation.isPending}
          targetLang={targetLang}
          setTargetLang={changeExplanationLanguage}
          savedVideos={(savedVideosQuery.data?.items ?? []) as any[]}
          isAuthenticated={isAuthenticated}
          onPick={(u, lang) => {
            if (lang) setSpokenLang(lang);
            track("custom_video_attempted", { video_url: u, spoken_language: lang || spokenLang || "auto" });
            setUrl(u);
            setView("demo");
            submitLoad(u, lang);
          }}
        />
      )}


      <main className="relative mx-auto max-w-6xl px-6">
        




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
                        ? "This can take longer for videos without captions. You can keep watching — the transcript and sentence explanations appear as soon as sentences are ready."
                        : "Transcript is being prepared. You can watch now — sentence explanations appear shortly."}
                    </div>
                  </div>
                </div>
              )}

            {/* No Watch / Learning distinction: intelligent subtitles are always on. */}



            {transcriptStatus === "failed" &&
            errorPanelDismissedFor !== (videoId ?? "unknown") ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-6 text-foreground shadow-sm">
                <h2 className="text-lg font-semibold">
                  We couldn’t prepare a transcript for this video
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
                    <div>Transcript usable: <b>NO</b></div>
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
                      setFocusMode(true);
                      setErrorPanelDismissedFor(videoId ?? "unknown");
                      track("study_mode_closed", { video_id: videoId });
                      if (typeof window !== "undefined") {
                        window.requestAnimationFrame(() => {
                          iframeRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        });
                      }
                    }}
                  >
                    Keep watching
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
                  ? "grid-cols-1"
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
                <div className="sticky top-[68px] z-10 lg:static">
                  <div className="relative mx-auto aspect-video w-full max-w-full overflow-hidden rounded-xl bg-black md:max-w-[900px] xl:max-w-[1100px] min-[1600px]:max-w-[1280px]">
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
                    {/* Synchronized Dutch subtitle — read-only, never pauses. */}
                    {studyMode && currentSentence && (
                      <VideoSubtitle
                        text={currentSentence.text}
                        highlight={autoExpression?.head ?? null}
                        onHighlightClick={() =>
                          openSentenceDetails(currentSentence.id, autoExpression?.head ?? null)
                        }
                      />
                    )}
                  </div>
                  {playbackError && (
                    <div className="mx-auto mt-2 w-full max-w-[900px] rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                      <p className="font-medium text-destructive">Playback problem</p>
                      <p className="mt-1 text-muted-foreground">{playbackError}</p>
                      <a
                        className="mt-2 inline-block text-sm font-medium underline underline-offset-4"
                        href={`https://www.youtube.com/watch?v=${videoId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Watch on YouTube
                      </a>
                    </div>
                  )}

                </div>

                {/* One expression for the current moment. Anything deeper opens
                    in a drawer — nothing is stacked under the video. */}
                {/* Passive-learning expression bar is experiment-only. */}
                {experiment && studyMode && !limitedMode && (

                  <div className="mx-auto w-full md:max-w-[900px] xl:max-w-[1100px] min-[1600px]:max-w-[1280px]">
                    <UsefulExpressionBar
                      expression={autoExpression}
                      loading={queueLoading}
                      expanded={expressionExpanded}
                      onToggle={() => {
                        if (currentSentence) {
                          openSentenceDetails(currentSentence.id, autoExpression?.head ?? null);
                        }
                      }}
                    />
                  </div>
                )}
              </div>


              {/* Transcript — kept fully functional, but secondary: opened on
                  demand so it never dominates the page. */}
              <div className="mx-auto min-w-0 w-full order-3 lg:order-2 md:max-w-[900px] xl:max-w-[1100px] min-[1600px]:max-w-[1280px]">
                <button
                  type="button"
                  onClick={() => {
                    const next = !transcriptOpen;
                    setTranscriptOpen(next);
                    if (next) trackWatch("transcript_opened", { video_id: videoId });
                  }}
                  aria-expanded={transcriptOpen}
                  className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground shadow-sm hover:bg-muted"
                >
                  Transcript
                  <ChevronDown
                    aria-hidden
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${transcriptOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <aside className={`relative ${transcriptOpen ? "flex" : "hidden"} max-h-[55vh] flex-col overflow-hidden rounded-xl bg-muted/30 lg:max-h-[60vh]`}>

                    {transcriptQuality && !qualityBannerDismissed && transcriptQuality.quality !== "high" && videoId !== DEMO_VIDEO_ID && (
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

                      <div className="flex items-center gap-2">
                        {/* Explanation language — learners read meanings here. */}
                        <Select value={targetLang} onValueChange={changeExplanationLanguage}>
                          <SelectTrigger
                            className="h-7 w-auto gap-1 rounded-full border-border bg-background px-2.5 text-[11px] font-medium"
                            aria-label="Explanation language"
                            title="Language used for meanings and explanations"
                          >
                            <Languages className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="English">English</SelectItem>
                            <SelectItem value="Persian">Persian (فارسی)</SelectItem>
                          </SelectContent>
                        </Select>

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
                      </div>
                    </div>


                    {/* Hint moved inline above the active sentence (see list below). */}









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
                      <>
                        {isMobile && showSentenceHint && (
                          <div className="mx-2 mb-4 flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-primary-foreground shadow-sm ring-1 ring-primary/40 animate-in fade-in slide-in-from-top-1">
                            <MousePointerClick className="h-4 w-4 shrink-0" />
                            <span className="flex-1 text-[13px] font-medium leading-snug">
                              Tap any sentence to understand it instantly
                            </span>
                            <button
                              type="button"
                              onClick={() => dismissSentenceHint(false)}
                              aria-label="Dismiss hint"
                              className="-mr-1 rounded p-1 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      <ol ref={listRef} className="flex-1 divide-y divide-border/40 overflow-y-auto px-1 pb-3">
                        {/* In-list sticky row removed — the persistent
                            "Now playing" bar below the video already keeps the
                            current sentence visible. */}


                        {sentences.map((s, idx) => {
                          const selectedRow = studyMode && selected?.id === s.id;
                          const playing = playingId === s.id;
                          // Visual states are mutually exclusive and prioritized:
                          // 1. playing  → strong primary fill (the single live sentence)
                          // 2. selected → subtle left border only (user pick, not playback)
                          // 3. default  → no decoration
                          const visualState: "playing" | "selected" | "default" = playing
                            ? "playing"
                            : selectedRow
                            ? "selected"
                            : "default";
                          // One sentence = one row. Collapsed rows stay on a
                          // single line (truncated); the active/selected row
                          // expands so the full sentence is always readable.
                          const expanded = playing || selectedRow;
                          const inlineEntry = selectedRow ? explanationCache[s.id] : undefined;
                          return (
                            <li key={s.id}>
                              <button
                                data-sid={s.id}
                                data-state={visualState}
                                onClick={() => jumpTo(s)}
                                onMouseEnter={onSentenceHover}
                                title={s.text}
                                aria-label={`Explain: ${s.text}`}
                                aria-expanded={expanded}
                                className={`group grid w-full grid-cols-[3.25rem_1fr_1rem] items-baseline gap-3 cursor-pointer touch-manipulation rounded-lg border-l-2 px-3 py-3 text-left text-[15px] leading-[1.65] transition-colors duration-150 hover:border-primary/40 hover:bg-muted ${
                                  visualState === "playing"
                                    ? "border-primary bg-accent font-medium text-foreground"
                                    : visualState === "selected"
                                    ? "border-primary/50 bg-accent/60 text-foreground"
                                    : "border-transparent text-foreground/85"
                                }`}

                              >
                                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                                  {formatTime(s.offset)}
                                </span>
                                <span
                                  className={`min-w-0 ${expanded ? "whitespace-normal" : "truncate"}`}
                                >
                                  {s.text}
                                </span>
                                <MousePointerClick
                                  aria-hidden
                                  className={`h-4 w-4 shrink-0 self-center transition-opacity duration-150 ${
                                    playing
                                      ? "text-primary opacity-100"
                                      : "text-muted-foreground/30 opacity-0 group-hover:opacity-100 group-hover:text-primary"
                                  }`}
                                />
                              </button>

                              {/* Mobile inline expansion removed — the ExplanationPanel above is the primary learning surface on mobile. */}
                              {false && selectedRow && studyMode && inlineEntry && (
                                <div className="hidden">
                                  <InlineExplanation entry={inlineEntry} limitedMode={limitedMode} />
                                </div>
                              )}

                            </li>
                          );
                        })}
                      </ol>
                      </>
                    )}

                    {activeOutOfView && playingId !== null && (
                      <button
                        onClick={jumpToCurrentSentence}
                        className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground shadow-lg ring-1 ring-primary/40 hover:bg-primary/90"
                      >
                        <ArrowDownToLine className="h-3.5 w-3.5" />
                        Jump to current
                      </button>
                    )}

                  </aside>
              </div>
              </div>

              {/* Explanations live in one drawer on every screen size — never
                  stacked beneath the video. */}
              {studyMode && (
                <Drawer
                  open={expressionExpanded && !!selected}
                  onOpenChange={(open) => {
                    if (!open) {
                      setExpressionExpanded(false);
                      setSelected(null);
                      manualSelectedRef.current = false;
                    }
                  }}
                  shouldScaleBackground={false}
                >
                  <DrawerContent className="h-[55vh] max-h-[55vh] rounded-t-2xl border-t p-0 focus:outline-none lg:mx-auto lg:max-w-[900px]">
                    {/* The Drawer primitive renders its own handle bar at the top. */}
                    <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3">
                      <ExplanationPanel
                        sentence={selected}
                        entry={
                          selected ? explanationCache[selected.id] : undefined
                        }
                        onClose={() => { setExpressionExpanded(false); setSelected(null); manualSelectedRef.current = false; }}
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
                  </DrawerContent>
                </Drawer>
              )}

            </div>
            )}

            {/* You may also like — curated library recommendations. */}
            <LibraryStrip
              source="player"
              title="You may also like"
              subtitle="Curated videos at a similar level and topic."
              similarTo={videoId}
              showLevels={false}
              showFeatured={false}
              limit={4}
              onPick={(u, lang) => {
                setUrl(u);
                // `lang` is the language SPOKEN in the video, not the
                // explanation language — never touch targetLang here.
                if (lang) setSpokenLang(lang);
                submitLoad(u, lang);
                requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
              }}
              className="mt-8"
            />

            {/* After the demo: turn the visitor into a doer. */}
            {isDemo && (
              <section className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center">
                <h2 className="text-lg font-bold text-foreground sm:text-xl">
                  Now try it yourself
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Search any YouTube video or start with one of our curated lessons.
                </p>
                <form
                  className="mx-auto mt-4 flex max-w-md items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const u = tryUrl.trim();
                    if (!u) return;
                    track("try_it_yourself_submitted", { from: "post_demo" });
                    setUrl(u);
                    submitLoad(u);
                    setTryUrl("");
                    requestAnimationFrame(() =>
                      window.scrollTo({ top: 0, behavior: "smooth" }),
                    );
                  }}
                >
                  <Input
                    value={tryUrl}
                    onChange={(e) => setTryUrl(e.target.value)}
                    placeholder="Paste a YouTube link…"
                    className="h-11 flex-1 rounded-xl"
                  />
                  <Button type="submit" className="h-11 rounded-xl px-4">
                    Start for free
                  </Button>
                </form>
                <div className="mt-3">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/library" onClick={() => track("library_opened", { source: "post_demo" })}>
                      Browse Library
                    </Link>
                  </Button>
                </div>
              </section>
            )}

            {/* Supporting/marketing content lives BELOW the product. */}
            <section className="space-y-4 pt-8">
              <HowItWorksStrip />
              <ValueCards />
            </section>


          </div>
        )}

        {/* Custom-video section moved directly under DemoHero — see CustomVideoSection. */}
      </main>

      <AppFooter />



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




function SourceBadge({ source, cachedFrom }: { source: TranscriptSource; cachedFrom?: string | null }) {
  const labels: Record<string, string> = {
    youtube: "YouTube captions",
    // Legacy rows only — the fallback provider was removed from the pipeline.
    fallback: "Fallback provider (legacy)",
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
              className="h-11 gap-2 rounded-full px-5 text-sm font-medium shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading demo…
                </>
              ) : (
                <>
                  Start for free <ArrowRight className="h-4 w-4" />
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
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">EXPLANATION</p>
            <p className="text-base font-semibold leading-tight text-foreground">Tap any sentence to understand it</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          One natural translation, 1–3 useful expressions, and grammar when it helps. Stay in the flow.
        </p>
        <div className="mt-4">
          <ExplanationSections model={sampleModel} />
        </div>
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
        <p className="text-base leading-relaxed text-foreground sm:text-lg">
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
      Explanation not available for this line — read the
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

          <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
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
    <div className="rounded-2xl border border-border bg-card/80 p-3 shadow-sm backdrop-blur sm:p-4">
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
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5 shadow-sm">
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
