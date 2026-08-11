import posthog from "posthog-js";
import {
  getAnonymousUserId,
  getSessionId,
  getFirstSeenAt,
  isReturningVisitor,
} from "./identity";

let initialized = false;


const TEST_USER_KEY = "nativeflow_is_test_user";

export function isTestUser(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(TEST_USER_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTestUser(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (enabled) localStorage.setItem(TEST_USER_KEY, "1");
    else localStorage.removeItem(TEST_USER_KEY);
  } catch {}
  // Update PostHog person + super properties so future events carry the flag
  try {
    posthog.register({ is_test_user: enabled });
    posthog.setPersonProperties?.({ is_test_user: enabled });
    if (enabled) {
      // Give the test browser a stable identifier so it's easy to filter out
      const id = `test-user-${(typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
      const existing = localStorage.getItem("nativeflow_test_user_id");
      const finalId = existing || id;
      if (!existing) localStorage.setItem("nativeflow_test_user_id", finalId);
      posthog.identify(finalId, { is_test_user: true });
    }
  } catch {}
}

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  posthog.init("phc_uh2z54HTdTr2cqMitNeowZgbBrxBcXPyD6zfzVHTPksW", {
    api_host: "https://us.i.posthog.com",
    defaults: "2026-05-30" as any,
    person_profiles: "identified_only",
    capture_pageview: false,
    autocapture: false,
    capture_pageleave: false,
    rageclick: false,
    // Session Replay — enabled. Recordings can be filtered in PostHog by any
    // event we capture (page_view, video_opened, sentence_clicked, save_expression, …).
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: { password: true, email: false },
      recordCrossOriginIframes: false,
    },
  });

  // Register is_test_user as a super property so it's attached to every event
  const testFlag = isTestUser();
  try {
    posthog.register({ is_test_user: testFlag });
    if (testFlag) {
      const existing = localStorage.getItem("nativeflow_test_user_id");
      const finalId = existing || `test-user-${Date.now()}`;
      if (!existing) localStorage.setItem("nativeflow_test_user_id", finalId);
      posthog.identify(finalId, { is_test_user: true });
    }
  } catch {}

  // Attribution from URL
  try {
    const params = new URLSearchParams(window.location.search);
    const attribution: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
      const v = params.get(k);
      if (v) attribution[k] = v;
    }
    if (document.referrer) attribution.referrer = document.referrer;
    if (Object.keys(attribution).length) {
      posthog.register(attribution);
    }
  } catch {}

  // first_visit_date — persist locally so it stays stable across sessions
  try {
    let firstVisit = localStorage.getItem("lingua_first_visit_date");
    if (!firstVisit) {
      firstVisit = new Date().toISOString();
      localStorage.setItem("lingua_first_visit_date", firstVisit);
    }
    posthog.register({ first_visit_date: firstVisit });
  } catch {}

  // Identity: persistent anonymous visitor + current session. Registered as
  // super properties so every event carries them. Anonymous visitors are NOT
  // identified as persons in PostHog — we only tag events with a random id.
  try {
    const anonId = getAnonymousUserId();
    posthog.register({
      anonymous_user_id: anonId,
      session_id: getSessionId(),
      first_seen_at: getFirstSeenAt(),
      is_returning_visitor: isReturningVisitor(),
    });
  } catch {}

}

export function setUserProperties(props: Record<string, any>) {
  if (typeof window === "undefined") return;
  try {
    posthog.register(props);
    posthog.setPersonProperties?.(props);
  } catch {}
}

const LANDING_VARIANT_KEY = "nativeflow_landing_variant";

/**
 * Tag the current visitor with the marketing landing variant they arrived
 * through (A/B experiment). Stored locally + registered as a PostHog super
 * property so every downstream event (login, search, watch) carries it.
 */
export function setLandingVariant(variant: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LANDING_VARIANT_KEY, variant);
  } catch {}
  try {
    posthog.register({ landing_variant: variant });
    posthog.setPersonProperties?.({ landing_variant: variant });
  } catch {}
}

export function getLandingVariant(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(LANDING_VARIANT_KEY) ?? "";
  } catch {
    return "";
  }
}



/** Which product surface the current session is using. Additive property —
 *  no event names or existing properties change. */
export type ExperienceType = "public" | "passive_learning_experiment";
let experienceType: ExperienceType = "public";

export function setExperienceType(type: ExperienceType) {
  experienceType = type;
  if (typeof window === "undefined") return;
  try {
    posthog.register({ experience_type: type });
  } catch {}
}

export function getExperienceType(): ExperienceType {
  return experienceType;
}

/** Internal (founder / debug / test) session — lets us exclude our own usage. */
export function isInternalSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (isTestUser()) return true;
    if (localStorage.getItem("nativeflow_debug") === "1") return true;
    if (sessionStorage.getItem("founder-auth-v1") === "1") return true;
    return new URLSearchParams(window.location.search).get("debug") === "1";
  } catch {
    return false;
  }
}

export function track(event: string, props?: Record<string, any>) {
  if (typeof window === "undefined") return;
  // Ensure is_test_user is always on the event payload (in addition to super property)
  const variant = getLandingVariant();
  const enrichedProps = {
    ...(props ?? {}),
    is_test_user: isTestUser(),
    experience_type: experienceType,
    is_internal: isInternalSession(),
    ...(variant ? { landing_variant: variant } : {}),
  };


  try {
    const debug =
      new URLSearchParams(window.location.search).get("debug") === "1" ||
      localStorage.getItem("nativeflow_debug") === "1";
    if (debug) {
      // eslint-disable-next-line no-console
      console.info("[analytics]", event, enrichedProps);
    }
  } catch {}
  posthog.capture(event, enrichedProps);

  // Mirror to the tester cohort log (no-op if no tester_id is set).
  try {
    void import("./tester").then(({ recordTesterEventFromClient }) => {
      recordTesterEventFromClient(event, enrichedProps);
    });
  } catch {}
}

export { posthog };
