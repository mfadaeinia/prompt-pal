import { inspectTranscriptCache } from "@/lib/transcript.functions";
const cases: Array<[string, string]> = [
  ["OBRABge6XJ4", "nl"],   // only source_version 4 rows -> live pipeline re-runs
  ["4EE7m94mJpk", "nl"],   // fresh v5 row -> hit
  ["4EE7m94mJpk", "nl-NL"],// base-language match -> hit
  ["4GutxLa-p50", "_any_"],// _any_ row -> hit
  ["zzzzzzzzzzz", "nl"],   // unknown video -> miss
];
for (const [v, l] of cases) {
  const d = await inspectTranscriptCache(v, l);
  console.log(v, l, "=> hit:", !!d.picked, "| miss:", d.missReason, "| rows:", d.rowsForVideo, "atV:", d.rowsAtCurrentVersion, "stale:", JSON.stringify(d.staleVersions), "rejects:", d.rejections.map(r => r.reason).join(","));
}
