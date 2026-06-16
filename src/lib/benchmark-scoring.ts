// Numeric sub-scores + triggered-reason detection for benchmark results.
// Pure functions — derived from existing fields on BenchmarkResultRow.
// No DB writes; no server work.

import type { BenchmarkResultRow } from "@/lib/benchmark.functions";

// ---------- Thresholds (single source of truth, shown in the UI) ----------

export const SCORE_THRESHOLDS = {
  transcript: {
    minWords: 50, // T03 floor
    goodWords: 500, // full credit at/above
    minChars: 200,
  },
  sentences: {
    minCount: 20,
    goodCount: 100,
    avgMin: 5,
    avgMax: 25,
    longestSoftMax: 60,
    longestHardMax: 100, // S02
  },
  translation: {
    minConfidence: 1, // boolean today
  },
  quality: {
    minCoverage: 60,
    goodCoverage: 80,
  },
  pipelineBands: {
    high: 80, // pipeline ≥ 80 → High
    medium: 60, // 60–79 → Medium ; <60 → Low
  },
} as const;

export const SCORE_WEIGHTS = {
  transcript: 0.25,
  sentences: 0.30,
  translation: 0.20,
  quality: 0.25,
} as const;

// ---------- Score formulas (all return 0–100, rounded) ----------

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}
function lerp(value: number, inMin: number, inMax: number) {
  if (inMax <= inMin) return value >= inMax ? 100 : 0;
  return clamp(((value - inMin) / (inMax - inMin)) * 100);
}

export function scoreTranscript(r: BenchmarkResultRow): number {
  if (!r.transcript_found) return 0;
  const w = r.transcript_word_count ?? 0;
  const { minWords, goodWords } = SCORE_THRESHOLDS.transcript;
  return Math.round(lerp(w, minWords, goodWords));
}

export function scoreSentences(r: BenchmarkResultRow): number {
  if (!r.transcript_found) return 0;
  const { minCount, goodCount, avgMin, avgMax, longestSoftMax, longestHardMax } =
    SCORE_THRESHOLDS.sentences;

  // Count component (0–100)
  const countScore = lerp(r.sentence_count ?? 0, 5, goodCount);

  // Avg-length component — best inside [avgMin, avgMax], degrades outside.
  const avg = r.avg_sentence_length ?? 0;
  let avgScore = 100;
  if (avg < avgMin) avgScore = lerp(avg, 1, avgMin);
  else if (avg > avgMax) avgScore = clamp(100 - (avg - avgMax) * 4);

  // Longest-sentence penalty (proxy for merge bugs / poor boundaries)
  const longest = r.longest_sentence_words ?? 0;
  let longestScore = 100;
  if (longest > longestSoftMax)
    longestScore = clamp(100 - (longest - longestSoftMax) * 2);
  if (longest > longestHardMax) longestScore = 0;

  // Floor for too-few sentences
  const floor = (r.sentence_count ?? 0) < minCount ? 0.7 : 1;

  return Math.round(
    floor * (countScore * 0.5 + avgScore * 0.3 + longestScore * 0.2),
  );
}

export function scoreTranslation(r: BenchmarkResultRow): number {
  if (!r.transcript_found) return 0;
  return r.translation_success ? 100 : 0;
}

export function scoreQuality(r: BenchmarkResultRow): number {
  if (!r.transcript_found) return 0;
  const { minCoverage, goodCoverage } = SCORE_THRESHOLDS.quality;
  const coverage = r.coverage_percent ?? 0;
  const coverageScore = lerp(coverage, minCoverage, goodCoverage);
  // Combine with sentence-boundary signal (longest-sentence cleanliness).
  const longest = r.longest_sentence_words ?? 0;
  const boundaryScore =
    longest <= 25 ? 100 : longest <= 60 ? 80 : longest <= 100 ? 50 : 20;
  return Math.round(coverageScore * 0.6 + boundaryScore * 0.4);
}

export function scorePipeline(r: BenchmarkResultRow): number {
  const w = SCORE_WEIGHTS;
  return Math.round(
    scoreTranscript(r) * w.transcript +
      scoreSentences(r) * w.sentences +
      scoreTranslation(r) * w.translation +
      scoreQuality(r) * w.quality,
  );
}

export type Scores = {
  transcript: number;
  sentences: number;
  translation: number;
  quality: number;
  pipeline: number;
};

export function computeScores(r: BenchmarkResultRow): Scores {
  return {
    transcript: scoreTranscript(r),
    sentences: scoreSentences(r),
    translation: scoreTranslation(r),
    quality: scoreQuality(r),
    pipeline: scorePipeline(r),
  };
}

export function pipelineBand(pipeline: number): "high" | "medium" | "low" {
  if (pipeline >= SCORE_THRESHOLDS.pipelineBands.high) return "high";
  if (pipeline >= SCORE_THRESHOLDS.pipelineBands.medium) return "medium";
  return "low";
}

// ---------- Triggered-reason detection ----------

export type ReasonCode =
  | "TOO_FEW_SENTENCES"
  | "TRANSCRIPT_TOO_SHORT"
  | "POOR_SENTENCE_BOUNDARIES"
  | "EXCESSIVE_SENTENCE_LENGTH"
  | "TRANSLATION_LOW_CONFIDENCE"
  | "MISSING_PUNCTUATION"
  | "LOW_COVERAGE"
  | "ASR_LOW_CONFIDENCE";

export const REASON_LABELS: Record<ReasonCode, string> = {
  TOO_FEW_SENTENCES: "Too few sentences",
  TRANSCRIPT_TOO_SHORT: "Transcript too short",
  POOR_SENTENCE_BOUNDARIES: "Poor sentence boundaries",
  EXCESSIVE_SENTENCE_LENGTH: "Excessive sentence length",
  TRANSLATION_LOW_CONFIDENCE: "Translation confidence low",
  MISSING_PUNCTUATION: "Missing punctuation",
  LOW_COVERAGE: "Low coverage",
  ASR_LOW_CONFIDENCE: "ASR confidence low",
};

export function triggeredReasons(r: BenchmarkResultRow): ReasonCode[] {
  const out: ReasonCode[] = [];
  if (!r.transcript_found) return out;
  const t = SCORE_THRESHOLDS;

  if ((r.sentence_count ?? 0) < t.sentences.minCount)
    out.push("TOO_FEW_SENTENCES");
  if ((r.transcript_word_count ?? 0) < 200) out.push("TRANSCRIPT_TOO_SHORT");
  if (
    (r.avg_sentence_length ?? 0) > 30 ||
    (r.avg_sentence_length ?? 0) > 0 &&
      (r.avg_sentence_length ?? 0) < 4
  )
    out.push("POOR_SENTENCE_BOUNDARIES");
  if ((r.longest_sentence_words ?? 0) > t.sentences.longestSoftMax)
    out.push("EXCESSIVE_SENTENCE_LENGTH");
  if (!r.translation_success) out.push("TRANSLATION_LOW_CONFIDENCE");
  // Missing punctuation proxy: very high avg sentence length indicates the
  // splitter found no terminators.
  if ((r.avg_sentence_length ?? 0) > 40) out.push("MISSING_PUNCTUATION");
  if ((r.coverage_percent ?? 0) < t.quality.minCoverage)
    out.push("LOW_COVERAGE");
  if (r.transcript_source === "asr" && scoreSentences(r) < 60)
    out.push("ASR_LOW_CONFIDENCE");

  return out;
}

// ---------- Per-source aggregation ----------

export type SourceKey = "youtube" | "asr" | "cache" | "fallback" | "unknown";

export const SOURCE_LABELS: Record<SourceKey, string> = {
  youtube: "YouTube captions",
  asr: "Gemini ASR fallback",
  cache: "Cache",
  fallback: "Scrape fallback",
  unknown: "Unknown / failed",
};

export function sourceOf(r: BenchmarkResultRow): SourceKey {
  const s = (r.transcript_source ?? "").toLowerCase();
  if (s === "youtube" || s === "asr" || s === "cache" || s === "fallback")
    return s as SourceKey;
  return "unknown";
}

export type SourceStats = {
  source: SourceKey;
  total: number;
  success: number; // transcript_found
  successPct: number;
  avgQuality: number; // mean pipeline score over found
};

export function aggregateBySource(rows: BenchmarkResultRow[]): SourceStats[] {
  const map = new Map<SourceKey, BenchmarkResultRow[]>();
  for (const r of rows) {
    const k = sourceOf(r);
    const arr = map.get(k) ?? [];
    arr.push(r);
    map.set(k, arr);
  }
  const out: SourceStats[] = [];
  for (const [source, list] of map) {
    const total = list.length;
    const success = list.filter((r) => r.transcript_found).length;
    const found = list.filter((r) => r.transcript_found);
    const avgQuality = found.length
      ? Math.round(
          found.reduce((a, r) => a + scorePipeline(r), 0) / found.length,
        )
      : 0;
    out.push({
      source,
      total,
      success,
      successPct: total ? Math.round((success / total) * 100) : 0,
      avgQuality,
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

// ---------- Auto-generated observations ----------

export function generateObservations(rows: BenchmarkResultRow[]): string[] {
  const out: string[] = [];
  const found = rows.filter((r) => r.transcript_found);
  if (found.length < 3) return out;

  const scored = found.map((r) => ({ r, s: computeScores(r) }));
  const bands = scored.reduce(
    (acc, x) => {
      const b = pipelineBand(x.s.pipeline);
      acc[b] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 } as Record<"high" | "medium" | "low", number>,
  );

  // Reason frequency among medium/low
  const mLow = scored.filter(
    (x) => pipelineBand(x.s.pipeline) !== "high",
  );
  const reasonCounts: Record<ReasonCode, number> = {} as any;
  for (const { r } of mLow)
    for (const code of triggeredReasons(r))
      reasonCounts[code] = (reasonCounts[code] ?? 0) + 1;
  const topReason = Object.entries(reasonCounts).sort(
    (a, b) => b[1] - a[1],
  )[0];
  if (topReason && mLow.length) {
    const [code, n] = topReason as [ReasonCode, number];
    const pct = Math.round((n / mLow.length) * 100);
    out.push(
      `${pct}% of Medium/Low results are caused by: ${REASON_LABELS[code]}.`,
    );
  }

  // Long vs short
  const longF = scored.filter((x) => (x.r.transcript_word_count ?? 0) >= 1000);
  const shortF = scored.filter((x) => (x.r.transcript_word_count ?? 0) < 300);
  if (longF.length >= 3 && shortF.length >= 3) {
    const longAvg =
      longF.reduce((a, x) => a + x.s.pipeline, 0) / longF.length;
    const shortAvg =
      shortF.reduce((a, x) => a + x.s.pipeline, 0) / shortF.length;
    if (longAvg - shortAvg >= 10)
      out.push(
        `Long-form videos score ${Math.round(longAvg - shortAvg)} pts higher on average than short clips.`,
      );
    else if (shortAvg - longAvg >= 10)
      out.push(
        `Short clips score ${Math.round(shortAvg - longAvg)} pts higher than long-form on average.`,
      );
  }

  // Source comparison: Gemini ASR vs YouTube captions
  const ytF = scored.filter((x) => sourceOf(x.r) === "youtube");
  const asrF = scored.filter((x) => sourceOf(x.r) === "asr");
  if (ytF.length >= 3 && asrF.length >= 3) {
    const ytAvg = ytF.reduce((a, x) => a + x.s.sentences, 0) / ytF.length;
    const asrAvg = asrF.reduce((a, x) => a + x.s.sentences, 0) / asrF.length;
    if (ytAvg - asrAvg >= 10)
      out.push(
        `Gemini ASR transcripts have lower sentence-segmentation scores than YouTube captions (${Math.round(asrAvg)} vs ${Math.round(ytAvg)}).`,
      );
  }

  // Translation as a bottleneck?
  const trAvg = scored.reduce((a, x) => a + x.s.translation, 0) / scored.length;
  if (trAvg >= 95)
    out.push(
      "Translation quality is not the limiting factor — pipeline ceiling is set by sentence segmentation.",
    );

  // Distribution headline
  const total = scored.length;
  out.push(
    `Distribution: ${bands.high} High, ${bands.medium} Medium, ${bands.low} Low (out of ${total} successful videos).`,
  );

  return out;
}
