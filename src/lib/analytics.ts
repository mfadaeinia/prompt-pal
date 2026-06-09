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
}

export function track(event: string, props?: Record<string, any>) {
  if (typeof window === "undefined") return;
  posthog.capture(event, props);
}

export { posthog };
