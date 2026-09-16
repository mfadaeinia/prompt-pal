import { describe, expect, it } from "vitest";
import { selectCacheRow, type CacheSelectionRow } from "@/lib/transcript-cache-select.server";

const DUTCH =
  "Goedemorgen allemaal, vandaag gaan we het hebben over het weer in Nederland en waarom het zo vaak regent in de herfst.";
const ARABIC =
  "صباح الخير جميعا، اليوم سوف نتحدث عن الطقس في هولندا ولماذا تمطر كثيرا في فصل الخريف وكيف يستعد الناس لذلك.";

function row(over: Partial<CacheSelectionRow> & { id: string }): CacheSelectionRow {
  return {
    transcript_json: [{ text: DUTCH }],
    language: "nl",
    source: "youtube",
    provider: "youtube",
    requested_language: "nl",
    provider_response_language: "nl",
    source_version: 5,
    ...over,
  };
}

const select = (rows: CacheSelectionRow[], requestedLanguage: string) =>
  selectCacheRow({ rows, requestedLanguage, pipelineVersion: 5, log: false });

describe("selectCacheRow", () => {
  it("misses when there are no rows", () => {
    const r = select([], "nl");
    expect(r.picked).toBeNull();
    expect(r.missReason).toBe("no_rows_for_video_id");
  });

  it("rejects rows below the current pipeline version", () => {
    const r = select([row({ id: "a", source_version: 4 })], "nl");
    expect(r.picked).toBeNull();
    expect(r.missReason).toBe("all_rows_below_pipeline_version");
    expect(r.staleVersions).toEqual([4]);
    expect(r.rejections[0]!.reason).toBe("stale_pipeline_version");
  });

  it("prefers a current-version row over a stale one", () => {
    const r = select([row({ id: "stale", source_version: 1 }), row({ id: "fresh" })], "nl");
    expect(r.picked?.id).toBe("fresh");
    expect(r.rowsAtCurrentVersion).toBe(1);
  });

  it("matches on base language (nl-NL ≡ nl)", () => {
    const r = select([row({ id: "a" })], "nl-NL");
    expect(r.picked?.id).toBe("a");
  });

  it("matches language aliases (dutch ≡ nl)", () => {
    const r = select([row({ id: "a", language: "dutch", provider_response_language: "dutch", requested_language: "dutch" })], "nl");
    expect(r.picked?.id).toBe("a");
  });

  it("rejects rows in an unrelated language", () => {
    const r = select(
      [row({ id: "a", language: "fr", requested_language: "fr", provider_response_language: "fr" })],
      "nl",
    );
    expect(r.picked).toBeNull();
    expect(r.missReason).toBe("no_row_matches_language:nl");
    expect(r.rejections[0]!.reason).toBe("language_not_matching");
  });

  it("skips a poisoned row whose text contradicts the requested language", () => {
    const r = select([row({ id: "poison", transcript_json: [{ text: ARABIC }] })], "nl");
    expect(r.picked).toBeNull();
    expect(r.missReason).toBe("all_matching_rows_poisoned");
    expect(r.rejections[0]!.reason).toBe("poisoned_language");
  });

  it("accepts any usable row for _any_ (auto-detection path)", () => {
    const r = select(
      [row({ id: "a", language: null, requested_language: "_any_", provider_response_language: null })],
      "_any_",
    );
    expect(r.picked?.id).toBe("a");
    expect(r.missReason).toBeNull();
  });

  it("still applies the version gate under _any_", () => {
    const r = select([row({ id: "a", requested_language: "_any_", source_version: 4 })], "_any_");
    expect(r.picked).toBeNull();
    expect(r.missReason).toBe("all_rows_below_pipeline_version");
  });
});
