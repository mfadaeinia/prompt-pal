// Client-side cache for the fixed Demo video transcript so that opening
// the Demo feels instant — no server roundtrip, no spinner, no
// regeneration. Keyed by video id + cache version so we can invalidate
// by bumping the version.

import type { FetchTranscriptResult } from "./transcript.functions";

const VERSION = "v3";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function key(videoId: string) {
  return `nativeflow_demo_transcript_${VERSION}:${videoId}`;
}

type Stored = {
  savedAt: number;
  result: FetchTranscriptResult;
};

export function readDemoTranscriptCache(
  videoId: string,
): FetchTranscriptResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(videoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.result || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;
    if (!Array.isArray(parsed.result.sentences) || parsed.result.sentences.length === 0) {
      return null;
    }
    return parsed.result;
  } catch {
    return null;
  }
}

export function writeDemoTranscriptCache(
  videoId: string,
  result: FetchTranscriptResult,
): void {
  if (typeof window === "undefined") return;
  if (!result?.sentences?.length) return;
  try {
    const payload: Stored = { savedAt: Date.now(), result };
    window.localStorage.setItem(key(videoId), JSON.stringify(payload));
  } catch {
    // Quota / serialization — best-effort cache, ignore.
  }
}

export function clearDemoTranscriptCache(videoId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(videoId));
  } catch {}
}
