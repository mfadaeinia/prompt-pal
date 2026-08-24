import { posthog, track } from "@/lib/analytics";

/**
 * Which action inside the Watch hub brought the user to a video. Registered as
 * a PostHog super property so every downstream player event (video_started,
 * video_watched_30s, subtitle_explanation_requested…) can be segmented by
 * content-acquisition path without touching the player instrumentation.
 *
 * This does NOT create a second analytics system: it reuses the canonical
 * `track()` helper (which attaches session_id / anonymous_user_id /
 * is_internal / experience_type) and only adds one property.
 */
export type ContentEntryPath =
  | "youtube_search"
  | "pasted_url"
  | "continue_watching"
  | "curated_library";

const KEY = "nativeflow_content_entry_path";

export function setContentEntryPath(path: ContentEntryPath) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {}
  try {
    posthog.register({ content_entry_path: path });
  } catch {}
}

export function getContentEntryPath(): ContentEntryPath | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(KEY);
    return v === "youtube_search" ||
      v === "pasted_url" ||
      v === "continue_watching" ||
      v === "curated_library"
      ? v
      : null;
  } catch {
    return null;
  }
}

/** Re-registers a previously chosen content entry path (call once on boot). */
export function restoreContentEntryPath() {
  const p = getContentEntryPath();
  if (p) {
    try {
      posthog.register({ content_entry_path: p });
    } catch {}
  }
}

const DEMO_SEEN_KEY = "nativeflow_demo_started_seen";
const FIRST_NON_DEMO_KEY = "nativeflow_first_non_demo_video_started";

/** Remember that this visitor experienced/started the demo. */
export function markDemoStarted() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEMO_SEEN_KEY, String(Date.now()));
  } catch {}
}

export function hasStartedDemo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(localStorage.getItem(DEMO_SEEN_KEY));
  } catch {
    return false;
  }
}

/**
 * Product-intent signal: the FIRST time a visitor starts a non-demo video
 * after having experienced the demo. Fires at most once per browser and never
 * for the demo video itself. Additive — Core Activation is unchanged.
 */
export function maybeTrackFirstNonDemoVideoStarted(props: {
  videoId: string;
  userId?: string | null;
}) {
  if (typeof window === "undefined") return;
  if (!hasStartedDemo()) return;
  try {
    if (localStorage.getItem(FIRST_NON_DEMO_KEY)) return;
    localStorage.setItem(FIRST_NON_DEMO_KEY, props.videoId);
  } catch {
    return;
  }
  track("first_non_demo_video_started", {
    video_id: props.videoId,
    user_id: props.userId ?? null,
    content_entry_path: getContentEntryPath(),
  });
}
