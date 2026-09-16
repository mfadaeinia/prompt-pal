/**
 * PURE cache-row selection for the transcript pipeline.
 *
 * This module contains no database access: the caller fetches rows and passes
 * them in. Both the live pipeline (`readCache`) and the Founder diagnostics
 * trace (`inspectTranscriptCache`) run this exact function, so diagnostics can
 * never disagree with what learners actually receive.
 *
 * Spoken-language resolution stays exactly as the live pipeline had it:
 * `_any_` means "accept whatever the provider returned", and specific requests
 * match on base language (nl-NL ≡ nl, "dutch" ≡ nl) via `sameBaseLanguage`.
 */
import { detectLanguage, sameBaseLanguage, textContradictsLanguage } from "@/lib/lang-detect.server";

/** Only the columns selection depends on. */
export type CacheSelectionRow = {
  id: string;
  transcript_json: Array<{ text?: string | null }> | null;
  language: string | null;
  source: string | null;
  provider: string | null;
  requested_language: string | null;
  provider_response_language: string | null;
  source_version: number | null;
};

export type CacheRejectionReason =
  | "stale_pipeline_version"
  | "language_not_matching"
  | "poisoned_language"
  | "empty_transcript_json";

export type CacheRejection = {
  cacheRowId: string;
  reason: CacheRejectionReason;
  sourceVersion: number | null;
  language: string | null;
  requestedLanguage: string | null;
  providerResponseLanguage: string | null;
  provider: string | null;
};

export type CacheSelection<Row extends CacheSelectionRow> = {
  pipelineVersion: number;
  rowsForVideo: number;
  rowsAtCurrentVersion: number;
  staleVersions: number[];
  picked: Row | null;
  missReason: string | null;
  rejections: CacheRejection[];
};

export function selectCacheRow<Row extends CacheSelectionRow>(input: {
  rows: Row[];
  requestedLanguage: string;
  pipelineVersion: number;
  /** Only used for log context. */
  videoId?: string;
  log?: boolean;
}): CacheSelection<Row> {
  const { rows: allRows, requestedLanguage, pipelineVersion, videoId, log = true } = input;
  const rejections: CacheRejection[] = [];
  const reject = (r: Row, reason: CacheRejectionReason) => {
    rejections.push({
      cacheRowId: r.id,
      reason,
      sourceVersion: r.source_version ?? null,
      language: r.language ?? null,
      requestedLanguage: r.requested_language ?? null,
      providerResponseLanguage: r.provider_response_language ?? null,
      provider: r.provider ?? r.source ?? null,
    });
  };

  // Pipeline-version gate: rows written by older pipelines are stale and must
  // be re-run. Nothing is deleted — bumping the version routes future writes
  // to a fresh row.
  const staleVersions: number[] = [];
  const rows: Row[] = [];
  for (const r of allRows) {
    if ((r.source_version ?? 1) < pipelineVersion) {
      staleVersions.push(r.source_version ?? 1);
      reject(r, "stale_pipeline_version");
    } else {
      rows.push(r);
    }
  }

  const result = (overrides: Partial<CacheSelection<Row>>): CacheSelection<Row> => ({
    pipelineVersion,
    rowsForVideo: allRows.length,
    rowsAtCurrentVersion: rows.length,
    staleVersions,
    picked: null,
    missReason: null,
    rejections,
    ...overrides,
  });

  if (allRows.length && !rows.length && log) {
    console.log("[transcript] cache rows present but all below current pipeline version — re-running", {
      videoId,
      requestedLanguage,
      currentVersion: pipelineVersion,
      staleVersions,
    });
  }
  if (!allRows.length) return result({ missReason: "no_rows_for_video_id" });
  if (!rows.length) return result({ missReason: "all_rows_below_pipeline_version" });

  const isPoisoned = (r: Row): boolean => {
    // A cached row is poisoned when its TEXT contradicts either the language
    // the provider claimed or the language the caller asked for. Any provider
    // can do this: YouTube sometimes returns a creator-uploaded track in an
    // unrelated language, and we would otherwise serve it forever from cache.
    const claimed = r.language ?? r.provider_response_language ?? null;
    const expected = requestedLanguage === "_any_" ? claimed : requestedLanguage;
    if (!expected) return false;
    const text = (r.transcript_json ?? [])
      .slice(0, 80)
      .map((c) => c?.text ?? "")
      .join(" ");
    if (text.length < 80) return false;
    if (!textContradictsLanguage(text, expected)) return false;
    const detected = detectLanguage(text);
    if (log) {
      console.warn("[transcript] poisoned cache row detected — skipping", {
        videoId,
        cacheRowId: r.id,
        provider: (r.provider ?? r.source ?? "").toLowerCase(),
        claimedLanguage: claimed,
        expectedLanguage: expected,
        detectedLanguage: detected.language,
        confidence: detected.confidence,
      });
    }
    return true;
  };

  let picked: Row | null = null;
  for (const r of rows) {
    if (requestedLanguage !== "_any_") {
      const langMatch =
        (r.requested_language && r.requested_language === requestedLanguage) ||
        (r.provider_response_language && sameBaseLanguage(r.provider_response_language, requestedLanguage)) ||
        (r.language && sameBaseLanguage(r.language, requestedLanguage));
      if (!langMatch) {
        reject(r, "language_not_matching");
        continue;
      }
    }
    if (isPoisoned(r)) {
      reject(r, "poisoned_language");
      continue;
    }
    picked = r;
    break;
  }

  return result({
    picked,
    missReason: picked
      ? null
      : rejections.some((x) => x.reason === "poisoned_language")
        ? "all_matching_rows_poisoned"
        : requestedLanguage === "_any_"
          ? "no_usable_row"
          : `no_row_matches_language:${requestedLanguage}`,
  });
}
