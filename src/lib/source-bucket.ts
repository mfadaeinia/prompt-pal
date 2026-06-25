// Conservative source bucketing. Only buckets things we can confidently
// classify from existing acquisition_source / utm_source data; everything
// else is "Unknown" — never silently dropped.

export const SOURCE_BUCKETS = [
  "all",
  "instagram",
  "facebook",
  "reddit",
  "google",
  "direct",
  "unknown",
] as const;

export type SourceBucket = (typeof SOURCE_BUCKETS)[number];

export const SOURCE_LABELS: Record<SourceBucket, string> = {
  all: "All Sources",
  instagram: "Instagram",
  facebook: "Facebook",
  reddit: "Reddit",
  google: "Google / Search",
  direct: "Direct",
  unknown: "Unknown",
};

export function bucketSource(input: {
  acquisition_source?: string | null;
  utm_source?: string | null;
}): Exclude<SourceBucket, "all"> {
  const acq = (input.acquisition_source ?? "").toLowerCase().trim();
  const utm = (input.utm_source ?? "").toLowerCase().trim();
  const haystack = `${acq} ${utm}`;

  if (haystack.includes("instagram") || utm === "ig") return "instagram";
  if (haystack.includes("facebook") || utm === "fb") return "facebook";
  if (haystack.includes("reddit")) return "reddit";
  if (
    haystack.includes("google") ||
    haystack.includes("bing") ||
    haystack.includes("duckduckgo") ||
    haystack.includes("search")
  )
    return "google";
  if (acq === "direct") return "direct";
  return "unknown";
}

export function matchesSource(
  row: { acquisition_source?: string | null; utm_source?: string | null },
  source: SourceBucket,
): boolean {
  if (source === "all") return true;
  return bucketSource(row) === source;
}
