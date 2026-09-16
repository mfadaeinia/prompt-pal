/**
 * Regression test: the Founder diagnostics trace and the live pipeline must
 * report the SAME cache outcome for the same video and the same resolved
 * language. Before the fix, diagnostics reported a cache hit for rows the live
 * pipeline discards (stale pipeline version) and a miss for base-language
 * variants like nl-NL.
 */
import { describe, expect, it, vi } from "vitest";

const DUTCH =
  "Goedemorgen allemaal, vandaag gaan we het hebben over het weer in Nederland en waarom het zo vaak regent.";

const ROWS: Record<string, any[]> = {
  // Only a stale row: live pipeline re-runs, diagnostics must NOT claim a hit.
  stale_only: [
    {
      id: "row-stale",
      video_id: "stale_only",
      transcript_json: [{ text: DUTCH }],
      language: "nl",
      source: "youtube",
      provider: "youtube",
      requested_language: "nl",
      provider_response_language: "nl",
      source_version: 4,
      cache_key: "k1",
      transcript_length_chars: DUTCH.length,
      created_at: null,
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  // Fresh row: hit for nl and for the nl-NL variant.
  fresh: [
    {
      id: "row-fresh",
      video_id: "fresh",
      transcript_json: [{ text: DUTCH }],
      language: "nl",
      source: "youtube",
      provider: "youtube",
      requested_language: "nl",
      provider_response_language: "nl",
      source_version: 5,
      cache_key: "k2",
      transcript_length_chars: DUTCH.length,
      created_at: null,
      updated_at: "2026-02-01T00:00:00Z",
    },
  ],
  missing: [],
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: (_col: string, videoId: string) => ({
          order: async () => ({ data: ROWS[videoId] ?? [], error: null }),
        }),
      }),
    }),
  },
}));

const CASES: Array<[string, string]> = [
  ["stale_only", "nl"],
  ["fresh", "nl"],
  ["fresh", "nl-NL"],
  ["fresh", "_any_"],
  ["missing", "nl"],
];

describe("diagnostics/live cache parity", () => {
  it("reports the same hit/miss as the live lookup for every case", async () => {
    const { inspectTranscriptCache } = await import("@/lib/transcript.functions");
    const { step2Cache } = await import("@/lib/transcript-trace.functions");

    for (const [videoId, language] of CASES) {
      const live = await inspectTranscriptCache(videoId, language);
      const trace = await step2Cache(videoId, language);
      expect(trace.hit, `${videoId}/${language}`).toBe(live.picked !== null);
      expect(trace.cacheRowId).toBe(live.picked?.id ?? null);
      expect(trace.missReason).toBe(live.missReason);
      expect(trace.rowsForVideo).toBe(live.rowsForVideo);
      expect(trace.pipelineVersion).toBe(live.pipelineVersion);
    }
  });

  it("does not report a hit when only stale-version rows exist", async () => {
    const { step2Cache } = await import("@/lib/transcript-trace.functions");
    const trace = await step2Cache("stale_only", "nl");
    expect(trace.hit).toBe(false);
    expect(trace.missReason).toBe("all_rows_below_pipeline_version");
    expect(trace.staleVersions).toEqual([4]);
  });

  it("reports a hit for a base-language variant of the stored language", async () => {
    const { step2Cache } = await import("@/lib/transcript-trace.functions");
    const trace = await step2Cache("fresh", "nl-NL");
    expect(trace.hit).toBe(true);
    expect(trace.cacheRowId).toBe("row-fresh");
  });
});
