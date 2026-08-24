import { posthog } from "@/lib/analytics";

/**
 * Which of the three landing entry paths brought the visitor into the product.
 * Stored per session and registered as a PostHog super property so every
 * downstream product event (video_opened, watched_30s, explanation_requested…)
 * carries it without touching the player.
 */
export type EntryPath = "own_url" | "explore" | "demo";

const KEY = "nativeflow_entry_path";

export function setEntryPath(path: EntryPath) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {}
  try {
    posthog.register({ entry_path: path });
  } catch {}
}

export function getEntryPath(): EntryPath | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(KEY);
    return v === "own_url" || v === "explore" || v === "demo" ? v : null;
  } catch {
    return null;
  }
}

/** Re-registers a previously chosen entry path (call once on app boot). */
export function restoreEntryPath() {
  const p = getEntryPath();
  if (p) {
    try {
      posthog.register({ entry_path: p });
    } catch {}
  }
}
