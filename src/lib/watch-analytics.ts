import { track, getExperienceType, isInternalSession } from "./analytics";
import { getAnonymousUserId, getSessionId } from "./identity";
import { logLibraryEvent } from "./library-events.functions";

export type DeviceType = "mobile" | "tablet" | "desktop";

/** Device bucket derived from viewport width. Same event names everywhere —
 *  the device only travels as metadata (never as a separate event name). */
export function deviceType(): DeviceType {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

/**
 * Watch/comprehension events that must ALSO be persisted in the database,
 * because the Founder Dashboard reads the database (not PostHog). These are the
 * primary product funnel steps. PostHog behaviour is unchanged — this is purely
 * an additional write.
 *
 * Tracking for these DB rows began 2026-08-18 (see FUNNEL_TRACKING_START_ISO in
 * founder-metrics.functions.ts) — earlier periods have no rows, which must be
 * shown as "tracking not available", never as 0%.
 */
const MIRRORED_TO_DB = new Set([
  "video_started",
  "video_watched_30s",
  "subtitle_explanation_requested",
  "video_resumed_after_explanation",
  "another_video_started",
]);

/** Thin wrapper around the existing analytics `track` that always attaches
 *  device context. Existing event names/properties are untouched. */
export function trackWatch(event: string, props?: Record<string, unknown>) {
  const device = deviceType();
  track(event, { ...(props ?? {}), device_type: device });
  if (typeof window === "undefined" || !MIRRORED_TO_DB.has(event)) return;
  const p = (props ?? {}) as Record<string, any>;
  try {
    void logLibraryEvent({
      data: {
        eventName: event as any,
        sessionId: (p.session_id as string) || getSessionId() || "unknown",
        anonymousId: getAnonymousUserId() || null,
        videoId: typeof p.video_id === "string" ? p.video_id.slice(0, 64) : null,
        userId: (p.user_id as string) ?? null,
        metadata: {
          device_type: device,
          experience_type: getExperienceType(),
          is_internal: isInternalSession(),
        },
      },
    }).catch(() => {});
  } catch {}
}

export const WATCH_MILESTONES = [
  { key: "video_watched_30s", seconds: 30 },
  { key: "video_watched_60s", seconds: 60 },
] as const;

export const PERCENT_MILESTONES = [
  { key: "video_25_percent", pct: 0.25 },
  { key: "video_50_percent", pct: 0.5 },
  { key: "video_75_percent", pct: 0.75 },
  { key: "video_completed", pct: 0.95 },
] as const;
