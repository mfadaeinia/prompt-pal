import { track } from "./analytics";
import { deviceType as canonicalDeviceType, logProductEvent } from "./product-events";

export type DeviceType = "mobile" | "tablet" | "desktop";

/** Device bucket derived from viewport width. Same event names everywhere —
 *  the device only travels as metadata (never as a separate event name). */
export const deviceType = canonicalDeviceType;

/**
 * Watch/comprehension events that must ALSO be persisted in the database,
 * because the Founder Dashboard reads the database (not PostHog). These are the
 * primary product funnel steps.
 *
 * All DB rows go through `logProductEvent`, which attaches the CANONICAL
 * session_id + anonymous_user_id + is_internal/experience_type metadata. Never
 * pass a component-local id here.
 */
const MIRRORED_TO_DB = new Set([
  "video_started",
  "video_watched_30s",
  "subtitle_explanation_requested",
  "video_resumed_after_explanation",
  "another_video_started",
  // Canonical (Phase 1): seek-proof watch milestone + explicit video selection.
  "meaningful_watch_30s",
  "video_selected",
]);

/** Thin wrapper around the existing analytics `track` that always attaches
 *  device context. Existing event names/properties are untouched. */
export function trackWatch(event: string, props?: Record<string, unknown>) {
  const device = deviceType();
  track(event, { ...(props ?? {}), device_type: device });
  if (typeof window === "undefined" || !MIRRORED_TO_DB.has(event)) return;
  const p = (props ?? {}) as Record<string, any>;
  logProductEvent(event, {
    videoId: typeof p.video_id === "string" ? p.video_id : null,
    userId: (p.user_id as string) ?? null,
  });
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
