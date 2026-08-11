import type { CefrLevel } from "@/lib/expression-ranking";

const STORAGE_KEY = "nf.learnerLevel";
export const DEFAULT_LEARNER_LEVEL: CefrLevel = "B1";
export const LEARNER_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

function isLevel(v: string | null | undefined): v is CefrLevel {
  return !!v && (LEARNER_LEVELS as string[]).includes(v);
}

/** Explicit user choice, if any (client only). */
export function readStoredLearnerLevel(): CefrLevel | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isLevel(v) ? v : null;
  } catch {
    return null;
  }
}

export function storeLearnerLevel(level: CefrLevel) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, level);
  } catch {
    /* ignore */
  }
}

/**
 * First match wins:
 * 1. explicit user choice (persisted)
 * 2. the curated video's CEFR level (inference only, never persisted)
 * 3. B1 default
 */
export function resolveLearnerLevel(videoLevel?: string | null): CefrLevel {
  const stored = readStoredLearnerLevel();
  if (stored) return stored;
  if (isLevel(videoLevel ?? undefined)) return videoLevel as CefrLevel;
  return DEFAULT_LEARNER_LEVEL;
}
