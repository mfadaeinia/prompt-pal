// Lightweight per-tester instrumentation for the invite-only validation cohort.
// A tester arrives via a unique link, e.g. /?ref=tester_001. We persist the
// `ref` value as `tester_id` in localStorage so later sessions remain attributed
// to the same tester even after the query string is gone.

const TESTER_KEY = "nativeflow_tester_id";

const TRACKED_EVENTS = new Set<string>([
  "page_view",
  "video_loaded",
  "transcript_loaded",
  "sentence_clicked",
  "expression_saved",
  "feedback_submitted",
]);

// Map of analytics event names → canonical tester event names. The rest of the
// app emits richer event names (e.g. "transcript_sentence_clicked") via the
// existing PostHog `track()` helper; we normalize them here so the cohort
// dashboard sees the requirements-defined event list.
const EVENT_ALIASES: Record<string, string> = {
  transcript_sentence_clicked: "sentence_clicked",
  demo_sentence_clicked: "sentence_clicked",
  transcript_loaded_manually: "transcript_loaded",
  feedback_comprehension: "feedback_submitted",
};

export function getTesterId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TESTER_KEY);
  } catch {
    return null;
  }
}

/** Read `?ref=tester_xxx` (once) and persist it. Safe to call repeatedly. */
export function captureTesterRefFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && /^[a-zA-Z0-9_-]{1,64}$/.test(ref)) {
      localStorage.setItem(TESTER_KEY, ref);
      return ref;
    }
    return getTesterId();
  } catch {
    return null;
  }
}

export function normalizeTesterEvent(eventName: string): string | null {
  const canonical = EVENT_ALIASES[eventName] ?? eventName;
  return TRACKED_EVENTS.has(canonical) ? canonical : null;
}

/** Fire-and-forget POST to the tester events server fn. */
export function recordTesterEventFromClient(
  eventName: string,
  props?: Record<string, any>,
): void {
  if (typeof window === "undefined") return;
  const testerId = getTesterId();
  if (!testerId) return;
  const canonical = normalizeTesterEvent(eventName);
  if (!canonical) return;

  // Lazy import to avoid pulling server-fn glue into the initial bundle.
  import("./tester-events.functions")
    .then(({ recordTesterEvent }) => {
      recordTesterEvent({
        data: {
          testerId,
          eventName: canonical,
          sessionId: typeof props?.session_id === "string" ? props.session_id : null,
          videoId: typeof props?.video_id === "string" ? props.video_id : null,
          metadata: props ?? null,
        },
      }).catch(() => {});
    })
    .catch(() => {});
}
