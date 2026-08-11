import { track } from "./analytics";

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

/** Thin wrapper around the existing analytics `track` that always attaches
 *  device context. Existing event names/properties are untouched. */
export function trackWatch(event: string, props?: Record<string, unknown>) {
  track(event, { ...(props ?? {}), device_type: deviceType() });
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
