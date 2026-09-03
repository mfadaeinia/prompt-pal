/**
 * CANONICAL TRAFFIC CLASSIFICATION (Phase 1 analytics repair).
 *
 * Every analytics row written through `logProductEvent` carries a
 * `traffic_class`. Founder Dashboard product metrics default to
 * `production_user` only — demo, founder/admin, development, benchmark,
 * automated-test and bot traffic can never silently enter product metrics.
 *
 * PRECEDENCE (first match wins — deliberately ordered from "definitely not a
 * real learner" to "real learner"):
 *   bot → automated_test → development → benchmark → founder_admin → demo
 *       → production_user
 *
 * Classification prefers ENVIRONMENT/HOSTNAME facts over client flags. The
 * hostname + environment are also re-derived server-side from the request host
 * in `logLibraryEvent`, so a tampered client flag cannot promote development or
 * preview traffic into `production_user`.
 */
export type TrafficClass =
  | "production_user"
  | "demo"
  | "founder_admin"
  | "development"
  | "benchmark"
  | "automated_test"
  | "bot";

export type Environment = "production" | "preview" | "local" | "unknown";

/** Hostnames that serve real users. Everything else is preview/local. */
const PRODUCTION_HOSTS = [
  "nativeflow.life",
  "www.nativeflow.life",
  "nativeflowlife.lovable.app",
];

export function classifyEnvironment(hostname: string | null | undefined): Environment {
  const h = (hostname ?? "").toLowerCase().replace(/:\d+$/, "");
  if (!h) return "unknown";
  if (PRODUCTION_HOSTS.includes(h)) return "production";
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".localhost")
  ) {
    return "local";
  }
  // Lovable editor preview / dev deployment hosts.
  if (h.includes("id-preview--") || h.endsWith("-dev.lovable.app") || h.includes("lovableproject.com")) {
    return "preview";
  }
  // A stable `project--<id>.lovable.app` host serves the published app.
  if (h.endsWith(".lovable.app")) return "production";
  return "unknown";
}

const BOT_UA =
  /(bot|crawler|spider|crawling|headlesschrome|phantomjs|lighthouse|pagespeed|slurp|bingpreview|facebookexternalhit|preview)/i;

export type TrafficSignals = {
  hostname: string | null;
  environment: Environment;
  userAgent?: string | null;
  webdriver?: boolean;
  isTestUser?: boolean;
  isFounderAdmin?: boolean;
  isBenchmark?: boolean;
  isDemo?: boolean;
  inIframe?: boolean;
};

/** Pure classifier — same rules on client and server. */
export function classifyTraffic(s: TrafficSignals): TrafficClass {
  if (s.webdriver || (s.userAgent && BOT_UA.test(s.userAgent))) {
    return s.webdriver ? "automated_test" : "bot";
  }
  if (s.isTestUser) return "automated_test";
  if (s.environment === "local" || s.environment === "preview") return "development";
  if (s.isBenchmark) return "benchmark";
  if (s.isFounderAdmin) return "founder_admin";
  if (s.isDemo) return "demo";
  return "production_user";
}

// ---------------------------------------------------------------------------
// Client-side context
// ---------------------------------------------------------------------------

let demoSession = false;

/** Marks the current session as demo traffic (landing-page demo / embed). */
export function setDemoTraffic(isDemo: boolean) {
  demoSession = isDemo;
}

export function isDemoTraffic(): boolean {
  if (demoSession) return true;
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("embed") === "1";
  } catch {
    return false;
  }
}

function isBenchmarkTraffic(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.location.pathname.startsWith("/benchmark")) return true;
    return localStorage.getItem("nativeflow_benchmark") === "1";
  } catch {
    return false;
  }
}

function isFounderAdminTraffic(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.location.pathname.startsWith("/founder")) return true;
    if (localStorage.getItem("nativeflow_internal") === "1") return true;
    if (localStorage.getItem("nativeflow_debug") === "1") return true;
    if (sessionStorage.getItem("founder-auth-v1") === "1") return true;
    return new URLSearchParams(window.location.search).get("debug") === "1";
  } catch {
    return false;
  }
}

function isAutomatedTest(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if ((navigator as any).webdriver === true) return true;
    if ((window as any).__playwright || (window as any).__puppeteer) return true;
    if (localStorage.getItem("nativeflow_is_test_user") === "1") return true;
    return new URLSearchParams(window.location.search).get("e2e") === "1";
  } catch {
    return false;
  }
}

export type TrafficContext = {
  trafficClass: TrafficClass;
  environment: Environment;
  hostname: string;
  isDemo: boolean;
  isFounderAdmin: boolean;
};

/** Traffic context for the current browser. Cheap; safe to call per event. */
export function currentTrafficContext(): TrafficContext {
  if (typeof window === "undefined") {
    return {
      trafficClass: "production_user",
      environment: "unknown",
      hostname: "",
      isDemo: false,
      isFounderAdmin: false,
    };
  }
  const hostname = window.location.hostname;
  const environment = classifyEnvironment(hostname);
  const isDemo = isDemoTraffic();
  const isFounderAdmin = isFounderAdminTraffic();
  const trafficClass = classifyTraffic({
    hostname,
    environment,
    userAgent: navigator.userAgent,
    webdriver: (navigator as any).webdriver === true,
    isTestUser: isAutomatedTest(),
    isFounderAdmin,
    isBenchmark: isBenchmarkTraffic(),
    isDemo,
  });
  return { trafficClass, environment, hostname, isDemo, isFounderAdmin };
}
