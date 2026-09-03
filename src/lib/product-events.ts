/**
 * Single entry point for persisting product events to the database.
 *
 * Every row written through here carries:
 *   session_id     → the canonical session (src/lib/identity.ts)
 *   anonymous_id   → the persistent browser/device visitor id
 *   user_id        → the authenticated account, when signed in
 *   metadata       → device_type, experience_type, is_internal,
 *                    traffic_class, environment, hostname
 *
 * `traffic_class` is the canonical population marker (src/lib/traffic-class.ts).
 * It is re-derived server-side from the request host in `logLibraryEvent`, so a
 * tampered client flag cannot promote preview/local traffic to production_user.
 *
 * Feature components must NOT call logLibraryEvent directly with their own
 * id, otherwise session identity diverges again (which is exactly the bug this
 * module exists to prevent).
 */
import { getExperienceType, isInternalSession } from "./analytics";
import { recordDiagnosticEvent } from "./analytics-diagnostics";
import { CANONICAL_EVENTS } from "./analytics-events";
import { getAnonymousUserId, getSessionId } from "./identity";
import { logLibraryEvent } from "./library-events.functions";
import { currentTrafficContext } from "./traffic-class";

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
    const traffic = currentTrafficContext();
    const sessionId = getSessionId() || "unknown";
    if ((CANONICAL_EVENTS as readonly string[]).includes(eventName)) {
      recordDiagnosticEvent({
        event: eventName,
        at: new Date().toISOString(),
        videoId: opts.videoId ?? null,
        trafficClass: traffic.trafficClass,
        sessionId,
      });
    }
    void logLibraryEvent({
      data: {
        eventName: eventName as any,
        sessionId,
        anonymousId: getAnonymousUserId() || null,
        videoId: opts.videoId ? String(opts.videoId).slice(0, 64) : null,
        expressionId: opts.expressionId ?? null,
        userId: opts.userId ?? null,
        trafficClass: traffic.trafficClass,
        hostname: traffic.hostname || null,
        metadata: {
          ...(opts.metadata ?? {}),
          device_type: deviceType(),
          experience_type: getExperienceType(),
          is_internal: isInternalSession(),
          traffic_class: traffic.trafficClass,
          environment: traffic.environment,
          hostname: traffic.hostname,
        },
      },
    }).catch(() => {});
  } catch {
    /* analytics must never break a product flow */
  }
}
