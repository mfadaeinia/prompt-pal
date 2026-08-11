/**
 * Three distinct identifiers, deliberately kept separate:
 *
 *  anonymous_user_id — persistent random UUID per browser (localStorage).
 *                      Reuses the existing `nativeflow_browser_id` key so no
 *                      history is lost and anonymous saves stay attributable.
 *  session_id        — one browsing session (sessionStorage): survives
 *                      in-session navigation, resets on a new tab/session.
 *  user_id           — authenticated NativeFlow account (Supabase auth).
 *
 * No fingerprinting, no personal data. Random values only.
 */
import { getBrowserId } from "./browser-id";

const SESSION_KEY = "nativeflow_session_id";
const FIRST_SEEN_KEY = "nativeflow_first_seen_at";

function randomId(): string {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Persistent anonymous browser visitor id. */
export function getAnonymousUserId(): string {
  return getBrowserId();
}

/** Id for the current browsing session (stable across navigations). */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = randomId();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

/** ISO timestamp of the visitor's very first visit in this browser. */
export function getFirstSeenAt(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(FIRST_SEEN_KEY);
    if (existing) return existing;
    const now = new Date().toISOString();
    localStorage.setItem(FIRST_SEEN_KEY, now);
    return now;
  } catch {
    return "";
  }
}

/** True when this browser has been here before the current session. */
export function isReturningVisitor(): boolean {
  const first = getFirstSeenAt();
  if (!first) return false;
  return Date.now() - new Date(first).getTime() > 60 * 60 * 1000;
}
