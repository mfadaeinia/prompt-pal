// Client-side acquisition source detection.
// Captured once per browser on first arrival and reused on every analytics
// insert so a session is consistently attributed.

export type AcquisitionInfo = {
  source: string; // Instagram | Facebook | LinkedIn | Reddit | YouTube | Teacher Referral | Twitter | Direct | Unknown
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

const STORAGE_KEY = "nf_acq_v1";

const REFERRER_MAP: Array<{ host: RegExp; label: string }> = [
  { host: /(^|\.)instagram\.com$/i, label: "Instagram" },
  { host: /(^|\.)(facebook|fb)\.com$/i, label: "Facebook" },
  { host: /(^|\.)linkedin\.com$/i, label: "LinkedIn" },
  { host: /(^|\.)reddit\.com$/i, label: "Reddit" },
  { host: /(^|\.)(youtube\.com|youtu\.be)$/i, label: "YouTube" },
  { host: /(^|\.)(twitter|x)\.com$/i, label: "Twitter" },
  { host: /(^|\.)tiktok\.com$/i, label: "TikTok" },
  { host: /(^|\.)t\.co$/i, label: "Twitter" },
  { host: /(^|\.)google\./i, label: "Google" },
  { host: /(^|\.)bing\.com$/i, label: "Bing" },
];

function classifyUtmSource(utm: string | null): string | null {
  if (!utm) return null;
  const v = utm.toLowerCase();
  if (v.includes("instagram") || v === "ig") return "Instagram";
  if (v.includes("facebook") || v === "fb") return "Facebook";
  if (v.includes("linkedin")) return "LinkedIn";
  if (v.includes("reddit")) return "Reddit";
  if (v.includes("youtube") || v === "yt") return "YouTube";
  if (v.includes("teacher") || v.includes("referral")) return "Teacher Referral";
  if (v.includes("twitter") || v === "x") return "Twitter";
  if (v.includes("tiktok")) return "TikTok";
  return utm;
}

function fromReferrer(): string | null {
  try {
    if (!document.referrer) return null;
    const url = new URL(document.referrer);
    if (url.host === window.location.host) return null;
    for (const { host, label } of REFERRER_MAP) {
      if (host.test(url.host)) return label;
    }
    return "Other Web";
  } catch {
    return null;
  }
}

export function detectAcquisition(): AcquisitionInfo {
  if (typeof window === "undefined") {
    return { source: "Unknown", utm_source: null, utm_medium: null, utm_campaign: null };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as AcquisitionInfo;
  } catch {}

  let utm_source: string | null = null;
  let utm_medium: string | null = null;
  let utm_campaign: string | null = null;
  try {
    const params = new URLSearchParams(window.location.search);
    utm_source = params.get("utm_source");
    utm_medium = params.get("utm_medium");
    utm_campaign = params.get("utm_campaign");
  } catch {}

  const source =
    classifyUtmSource(utm_source) ??
    fromReferrer() ??
    (utm_source ? utm_source : null) ??
    (document.referrer ? "Other Web" : "Direct");

  const info: AcquisitionInfo = {
    source: source || "Unknown",
    utm_source,
    utm_medium,
    utm_campaign,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  } catch {}
  return info;
}

export function getStoredAcquisition(): AcquisitionInfo {
  return detectAcquisition();
}
