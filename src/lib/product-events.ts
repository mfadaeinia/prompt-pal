/**
 * Single entry point for persisting product events to the database.
 *
 * Every row written through here carries:
 *   session_id     → the canonical session (src/lib/identity.ts)
 *   anonymous_id   → the persistent browser/device visitor id
 *   user_id        → the authenticated account, when signed in
 *   metadata       → device_type, experience_type, is_internal
 *
 * Feature components must NOT call logLibraryEvent directly with their own
 * id, otherwise session identity diverges again (which is exactly the bug this
 * module exists to prevent).
 */
import { getExperienceType, isInternalSession } from "./analytics";
import { getAnonymousUserId, getSessionId } from "./identity";
import { logLibraryEvent } from "./library-events.functions";

export function deviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

export function logProductEvent(
  eventName: string,
  opts: {
    videoId?: string | null;
    expressionId?: string | null;
    userId?: string | null;
    metadata?: Record<string, unknown>;
  } = {},
) {
  if (typeof window === "undefined") return;
  try {
    void logLibraryEvent({
      data: {
        eventName: eventName as any,
        sessionId: getSessionId() || "unknown",
        anonymousId: getAnonymousUserId() || null,
        videoId: opts.videoId ? String(opts.videoId).slice(0, 64) : null,
        expressionId: opts.expressionId ?? null,
        userId: opts.userId ?? null,
        metadata: {
          ...(opts.metadata ?? {}),
          device_type: deviceType(),
          experience_type: getExperienceType(),
          is_internal: isInternalSession(),
        },
      },
    }).catch(() => {});
  } catch {
    /* analytics must never break a product flow */
  }
}
