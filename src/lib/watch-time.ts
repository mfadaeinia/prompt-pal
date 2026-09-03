/**
 * ACCUMULATED ACTUAL PLAYBACK TIME.
 *
 * The old `player.currentTime >= 30` test was invalid: a single seek satisfied
 * it. This tracker only accumulates time that actually elapsed while the video
 * was PLAYING:
 *   - the player is sampled at ~25fps; each sample adds `now - lastTime`
 *   - a delta is only counted when the player reports PLAYING
 *   - a delta larger than MAX_STEP_S (a seek, a tab wake-up, a buffering jump)
 *     is discarded, never accumulated
 *   - pausing stops accumulation (no sample deltas while paused)
 *
 * `meaningful_watch_30s` fires ONCE per (session, video) once accumulation
 * reaches 30s. The fired set is persisted per session so a page reload inside
 * the same canonical session cannot double-count it.
 */
import { getSessionId } from "./identity";

/** Largest per-sample advance still considered continuous playback. */
const MAX_STEP_S = 1.5;
export const MEANINGFUL_WATCH_SECONDS = 30;

const FIRED_KEY = "nativeflow_watch30_fired_v1";
const DEBUG_KEY = "nativeflow_watch_time_v1";

type VideoState = { accumulated: number; lastTime: number | null };
const states = new Map<string, VideoState>();

function firedKey(videoId: string) {
  return `${getSessionId()}::${videoId}`;
}

function loadFired(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveFired(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(Array.from(set).slice(-100)));
  } catch {}
}

function persistDebug() {
  if (typeof window === "undefined") return;
  try {
    const snapshot: Record<string, number> = {};
    for (const [videoId, st] of states) snapshot[videoId] = Math.round(st.accumulated * 10) / 10;
    localStorage.setItem(DEBUG_KEY, JSON.stringify(snapshot));
  } catch {}
}

/** Clears per-video accumulation (call when a new video is mounted). */
export function resetWatchTime(videoId: string) {
  states.set(videoId, { accumulated: 0, lastTime: null });
  persistDebug();
}

export type WatchSample = {
  /** Total accumulated real playback seconds for this video in this browser. */
  accumulated: number;
  /** True exactly once: the sample that crossed 30s of real playback. */
  crossedMeaningful: boolean;
};

/**
 * Feed one player sample. Call from the player poll loop.
 * `playing` must be the real player state (YT.PlayerState.PLAYING === 1).
 */
export function sampleWatchTime(args: {
  videoId: string | null;
  currentTime: number;
  playing: boolean;
}): WatchSample {
  const { videoId, currentTime, playing } = args;
  if (!videoId) return { accumulated: 0, crossedMeaningful: false };
  let st = states.get(videoId);
  if (!st) {
    st = { accumulated: 0, lastTime: null };
    states.set(videoId, st);
  }
  const prev = st.lastTime;
  st.lastTime = currentTime;
  if (!playing || prev == null) return { accumulated: st.accumulated, crossedMeaningful: false };
  const delta = currentTime - prev;
  // Seeking forward (delta > MAX_STEP_S) and seeking backwards (delta <= 0)
  // never add watch time.
  if (delta <= 0 || delta > MAX_STEP_S) {
    return { accumulated: st.accumulated, crossedMeaningful: false };
  }
  const before = st.accumulated;
  st.accumulated = before + delta;
  persistDebug();

  if (before >= MEANINGFUL_WATCH_SECONDS || st.accumulated < MEANINGFUL_WATCH_SECONDS) {
    return { accumulated: st.accumulated, crossedMeaningful: false };
  }
  const fired = loadFired();
  const key = firedKey(videoId);
  if (fired.has(key)) return { accumulated: st.accumulated, crossedMeaningful: false };
  fired.add(key);
  saveFired(fired);
  return { accumulated: st.accumulated, crossedMeaningful: true };
}

/** Accumulated real playback seconds (all videos in this page session). */
export function getAccumulatedWatchSeconds(videoId?: string | null): number {
  if (videoId) return Math.round((states.get(videoId)?.accumulated ?? 0) * 10) / 10;
  let total = 0;
  for (const st of states.values()) total += st.accumulated;
  return Math.round(total * 10) / 10;
}

/** Per-video accumulation snapshot, for the diagnostics panel. */
export function getWatchTimeSnapshot(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DEBUG_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}
