/**
 * Post-authentication return context.
 *
 * When an anonymous learner triggers an action that requires an account
 * (saving a sentence, expression or video), the OAuth flow can navigate the
 * whole page away. We therefore persist (a) where to come back to — including
 * the video and playback position — and (b) the save the user intended, so it
 * can be completed automatically after sign-in.
 *
 * Stored in sessionStorage so it never leaks into a later, unrelated login,
 * and always cleared the first time it is read.
 */

const KEY = "postAuthRedirect";
const MAX_AGE_MS = 30 * 60 * 1000;

export type PendingSaveIntent =
  | { kind: "expression"; data: Record<string, unknown> }
  | { kind: "video"; data: Record<string, unknown> };

export type PostAuthContext = {
  /** Same-origin path (with query) to return to, e.g. `/?v=...&t=42`. */
  path: string;
  intent?: PendingSaveIntent | null;
  savedAt: number;
};

function isSafePath(path: unknown): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

export function setPostAuthRedirect(path: string, intent?: PendingSaveIntent | null) {
  if (typeof window === "undefined") return;
  if (!isSafePath(path)) return;
  try {
    const ctx: PostAuthContext = { path, intent: intent ?? null, savedAt: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(ctx));
  } catch {
    /* ignore */
  }
}

/** Read the stored context and clear it (single use). Returns null if absent/invalid. */
export function takePostAuthRedirect(): PostAuthContext | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PostAuthContext;
    if (!isSafePath(parsed?.path)) return null;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPostAuthRedirect() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Absolute URL to hand to the OAuth provider as redirect_uri. */
export function absoluteReturnUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return isSafePath(path) ? window.location.origin + path : window.location.origin + "/";
}
