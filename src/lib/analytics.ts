import posthog from "posthog-js";

let initialized = false;

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
    disable_session_recording: true,
  });

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
}

export function setUserProperties(props: Record<string, any>) {
  if (typeof window === "undefined") return;
  try {
    posthog.register(props);
    posthog.setPersonProperties?.(props);
  } catch {}
}

export function track(event: string, props?: Record<string, any>) {
  if (typeof window === "undefined") return;
  posthog.capture(event, props);
}

export { posthog };
