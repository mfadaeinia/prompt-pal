/**
 * THREE distinct identity levels, deliberately kept separate. Never
 * interchangeable:
 *
 *  anonymous_user_id — persistent random UUID per browser/device
 *                      (localStorage). Reuses the existing
 *                      `nativeflow_browser_id` key so no history is lost.
 *                      → unit: VISITOR (browser/device). Used for anonymous
 *                        retention. No fingerprinting: the same human on three
 *                        browsers is three visitors. That is accepted.
 *  session_id        — ONE canonical browsing/product session. Shared by every
 *                      event/record produced during that session (landing,
 *                      video_sessions, library_events, watch milestones,
 *                      subtitle explanations, transcript interactions).
 *                      → unit: SESSION. Never a person identifier.
 *  user_id           — authenticated NativeFlow account (Supabase auth).
 *                      → unit: USER. Used for authenticated retention.
 *
 * SESSION LIFECYCLE (single source of truth — do not re-implement elsewhere):
 *  - stored in localStorage so it survives route changes, reloads AND new tabs
 *    within the same active session.
 *  - rolls over after SESSION_INACTIVITY_MS (30 min) of no `getSessionId()`
 *    call. Every read touches the last-active stamp, so an actively used
 *    session never regenerates.
 *  - opening a video, clicking a subtitle, opening the transcript, switching
 *    video or navigating landing → library → player does NOT start a session.
 *
 * No fingerprinting, no personal data. Random values only.
 */
import { getBrowserId } from "./browser-id";

const SESSION_KEY = "nativeflow_session_id_v2";
const SESSION_TOUCHED_KEY = "nativeflow_session_last_active";
const FIRST_SEEN_KEY = "nativeflow_first_seen_at";

/** Inactivity window after which a new canonical session begins. */
export const SESSION_INACTIVITY_MS = 30 * 60 * 1000;

function randomId(): string {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Persistent anonymous browser/device visitor id. */
export function getAnonymousUserId(): string {
  return getBrowserId();
}

/**
 * The canonical session id. Call this everywhere a session_id is needed —
 * never generate one inside a feature component.
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const now = Date.now();
    const existing = localStorage.getItem(SESSION_KEY);
    const touchedRaw = localStorage.getItem(SESSION_TOUCHED_KEY);
    const touched = touchedRaw ? Number(touchedRaw) : 0;
    const alive = !!existing && Number.isFinite(touched) && now - touched < SESSION_INACTIVITY_MS;
    const id = alive ? existing! : randomId();
    if (!alive) localStorage.setItem(SESSION_KEY, id);
    localStorage.setItem(SESSION_TOUCHED_KEY, String(now));
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
