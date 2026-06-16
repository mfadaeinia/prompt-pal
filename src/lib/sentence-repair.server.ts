// Server-only helpers for AI-assisted sentence segmentation repair.
//
// Flow:
//   1. Deterministic sentence splitting already produced `deterministic` units.
//   2. Score that output (avg words, longest, short/long counts, punctuation,
//      timing gaps) → "high" | "medium" | "low".
//   3. If quality is medium/low AND we have raw caption chunks, call Gemini
//      with the chunks + timestamps and ask for clean sentence-level units.
//   4. Validate AI output: text-set overlap, timestamps present, monotonic
//      order, no large content loss/hallucination.
//   5. Return final sentences + a metrics object the benchmark persists.

import type { RawChunk, TranscriptSentence } from "@/lib/transcript.functions";

export type SentenceQualityRating = "high" | "medium" | "low";

export type SentenceQualityScore = {
  rating: SentenceQualityRating;
  reasons: string[];
  metrics: {
    sentenceCount: number;
    avgWordsPerSentence: number;
    longestWords: number;
    shortFragmentPct: number;
    giantSentencePct: number;
    punctuationCoveragePct: number;
    medianGapSeconds: number | null;
  };
};

export type RepairOutcome = {
  final: TranscriptSentence[];
  finalSource: "deterministic" | "ai_repaired";
  deterministicQuality: SentenceQualityRating;
  finalQuality: SentenceQualityRating;
  aiRepairUsed: boolean;
  aiRepairSuccess: boolean;
  repairReason: string;
  diagnostics: {
    deterministicPreview: PreviewUnit[];
    repairedPreview: PreviewUnit[] | null;
    rawChunksPreview: Array<{ i: number; start: number; end: number; text: string }>;
    validationError?: string | null;
    aiHttpStatus?: number | null;
  };
};

export type PreviewUnit = {
  text: string;
  start: number;
  end: number;
  words: number;
};

// ---------- helpers ----------

function wc(s: string): number {
  const t = (s || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

function toPreview(s: TranscriptSentence): PreviewUnit {
  return {
    text: s.text,
    start: Number((s.offset ?? 0).toFixed(2)),
    end: Number((s.endTime ?? s.offset ?? 0).toFixed(2)),
    words: wc(s.text),
  };
}

// ---------- 1. Score deterministic output ----------

export function scoreSentenceQuality(
  sentences: TranscriptSentence[],
): SentenceQualityScore {
  const sentenceCount = sentences.length;
  const words = sentences.map((s) => wc(s.text));
  const total = words.reduce((a, b) => a + b, 0);
  const avg = sentenceCount ? total / sentenceCount : 0;
  const longest = words.reduce((m, n) => Math.max(m, n), 0);
  const shortN = words.filter((w) => w > 0 && w < 4).length;
  const giantN = words.filter((w) => w > 35).length;
  const shortPct = sentenceCount ? (shortN / sentenceCount) * 100 : 0;
  const giantPct = sentenceCount ? (giantN / sentenceCount) * 100 : 0;
  const punctN = sentences.filter((s) => /[.!?…]\s*$/.test(s.text.trim())).length;
  const punctPct = sentenceCount ? (punctN / sentenceCount) * 100 : 0;

  const gaps: number[] = [];
  for (let i = 1; i < sentences.length; i++) {
    const g = sentences[i].offset - (sentences[i - 1].endTime ?? sentences[i - 1].offset);
    if (Number.isFinite(g) && g >= 0) gaps.push(g);
  }
  let medianGap: number | null = null;
  if (gaps.length) {
    const sorted = [...gaps].sort((a, b) => a - b);
    medianGap = Number(sorted[Math.floor(sorted.length / 2)].toFixed(2));
  }

  const reasons: string[] = [];
  if (sentenceCount < 10) reasons.push(`only ${sentenceCount} sentences`);
  if (shortPct > 25) reasons.push(`${shortPct.toFixed(0)}% short fragments`);
  if (giantPct > 10) reasons.push(`${giantPct.toFixed(0)}% giant sentences`);
  if (punctPct < 60) reasons.push(`punctuation coverage ${punctPct.toFixed(0)}%`);
  if (avg > 28 || avg < 6) reasons.push(`avg length ${avg.toFixed(1)}w outside 6–28`);
  if (longest > 60) reasons.push(`longest ${longest}w >60`);

  let rating: SentenceQualityRating = "high";
  if (reasons.length >= 2 || giantPct > 15 || sentenceCount < 5 || longest > 80) {
    rating = "low";
  } else if (reasons.length === 1) {
    rating = "medium";
  }

  return {
    rating,
    reasons,
    metrics: {
      sentenceCount,
      avgWordsPerSentence: Number(avg.toFixed(2)),
      longestWords: longest,
      shortFragmentPct: Number(shortPct.toFixed(1)),
      giantSentencePct: Number(giantPct.toFixed(1)),
      punctuationCoveragePct: Number(punctPct.toFixed(1)),
      medianGapSeconds: medianGap,
    },
  };
}

// ---------- 2. AI repair ----------

type AiSentence = {
  text: string;
  start_time: number;
  end_time: number;
  source_chunk_indexes: number[];
};

async function callGeminiRepair(
  chunks: RawChunk[],
): Promise<{ ok: true; sentences: AiSentence[]; httpStatus: number } | { ok: false; reason: string; httpStatus: number | null }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { ok: false, reason: "LOVABLE_API_KEY missing", httpStatus: null };

  // Cap the number of chunks sent so prompt stays bounded.
  const capped = chunks.slice(0, 600);

  const prompt = [
    "You receive raw subtitle/caption chunks from a video. Each chunk has an index, a start time (seconds), a duration (seconds), and text.",
    "Your job: combine these chunks into NATURAL sentence-level units that a language learner can click on.",
    "STRICT RULES:",
    "- Preserve the spoken content EXACTLY. Do not summarize. Do not invent. Do not translate.",
    "- Do not drop substantive content (filler words like 'uh' may be removed; meaningful words must stay).",
    "- Merge short caption fragments into complete sentences when they form one sentence.",
    "- Split very long merged text into learner-friendly sentences (prefer 8–25 words; short is OK when natural).",
    "- Keep sentence order identical to the source.",
    "- For each output sentence include: text, start_time (sec), end_time (sec), source_chunk_indexes (array of 0-based indexes of every source chunk you drew from).",
    "- start_time must equal the start of the first source chunk; end_time must equal the end (start+duration) of the last source chunk.",
    "Return ONLY a JSON object: { \"sentences\": [ { \"text\": string, \"start_time\": number, \"end_time\": number, \"source_chunk_indexes\": [number, ...] } ] }.",
    "Source chunks (JSON):",
    JSON.stringify(
      capped.map((c, i) => ({
        i,
        start: Number(c.offset.toFixed(2)),
        dur: Number(c.duration.toFixed(2)),
        text: c.text,
      })),
    ),
  ].join("\n");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "raw-fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { ok: false, reason: `HTTP ${res.status}`, httpStatus: res.status };
    }
    const json: any = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    if (!raw) return { ok: false, reason: "empty_content", httpStatus: res.status };

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      try {
        parsed = JSON.parse(stripped);
      } catch (e) {
        return {
          ok: false,
          reason: `invalid_json: ${e instanceof Error ? e.message : String(e)}`,
          httpStatus: res.status,
        };
      }
    }

    const arr: any[] = Array.isArray(parsed?.sentences) ? parsed.sentences : [];
    if (!arr.length) return { ok: false, reason: "no_sentences", httpStatus: res.status };

    const sentences: AiSentence[] = arr
      .map((s) => ({
        text: String(s?.text ?? "").trim(),
        start_time: Number(s?.start_time ?? NaN),
        end_time: Number(s?.end_time ?? NaN),
        source_chunk_indexes: Array.isArray(s?.source_chunk_indexes)
          ? s.source_chunk_indexes.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
          : [],
      }))
      .filter((s) => s.text.length > 0);
    return { ok: true, sentences, httpStatus: res.status };
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: msg.toLowerCase().includes("abort") ? "timeout" : msg, httpStatus: null };
  }
}

// ---------- 3. Validate AI output ----------

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function multiset(arr: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of arr) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function multisetOverlap(a: string[], b: string[]): number {
  const ma = multiset(a);
  const mb = multiset(b);
  let inter = 0;
  for (const [k, v] of ma) {
    const w = mb.get(k);
    if (w) inter += Math.min(v, w);
  }
  const total = Math.max(a.length, b.length, 1);
  return inter / total;
}

export function validateRepairedSentences(
  chunks: RawChunk[],
  repaired: AiSentence[],
): { ok: true } | { ok: false; reason: string } {
  if (!repaired.length) return { ok: false, reason: "empty_output" };

  const srcText = chunks.map((c) => c.text).join(" ");
  const dstText = repaired.map((s) => s.text).join(" ");
  const srcTok = tokenize(srcText);
  const dstTok = tokenize(dstText);

  const ratio = dstTok.length / Math.max(srcTok.length, 1);
  if (ratio < 0.7) return { ok: false, reason: `content_dropped (ratio=${ratio.toFixed(2)})` };
  if (ratio > 1.3) return { ok: false, reason: `content_inflated (ratio=${ratio.toFixed(2)})` };

  const overlap = multisetOverlap(srcTok, dstTok);
  if (overlap < 0.7) return { ok: false, reason: `low_overlap (${overlap.toFixed(2)})` };

  // Timestamps present + monotonic
  let lastEnd = -Infinity;
  const srcStart = chunks[0]?.offset ?? 0;
  const lastChunk = chunks[chunks.length - 1];
  const srcEnd = lastChunk ? lastChunk.offset + lastChunk.duration : 0;
  for (const s of repaired) {
    if (!Number.isFinite(s.start_time) || !Number.isFinite(s.end_time)) {
      return { ok: false, reason: "missing_timestamps" };
    }
    if (s.end_time < s.start_time) return { ok: false, reason: "end_before_start" };
    if (s.start_time + 0.5 < lastEnd) return { ok: false, reason: "non_monotonic_order" };
    if (s.start_time < srcStart - 1 || s.end_time > srcEnd + 1) {
      return { ok: false, reason: "timestamp_out_of_range" };
    }
    lastEnd = s.end_time;
  }

  return { ok: true };
}

// ---------- 4. Orchestrator ----------

export async function repairSentencesIfNeeded(args: {
  chunks: RawChunk[];
  deterministic: TranscriptSentence[];
}): Promise<RepairOutcome> {
  const { chunks, deterministic } = args;

  const detScore = scoreSentenceQuality(deterministic);
  const deterministicPreview = deterministic.slice(0, 20).map(toPreview);
  const rawChunksPreview = chunks.slice(0, 30).map((c, i) => ({
    i,
    start: Number(c.offset.toFixed(2)),
    end: Number((c.offset + c.duration).toFixed(2)),
    text: c.text,
  }));

  // Skip AI for already-clean output, or when we have nothing to give the model.
  if (detScore.rating === "high" || !chunks.length || deterministic.length < 3) {
    return {
      final: deterministic,
      finalSource: "deterministic",
      deterministicQuality: detScore.rating,
      finalQuality: detScore.rating,
      aiRepairUsed: false,
      aiRepairSuccess: false,
      repairReason:
        detScore.rating === "high"
          ? "deterministic_quality_high"
          : "skipped_no_chunks_or_too_few_sentences",
      diagnostics: {
        deterministicPreview,
        repairedPreview: null,
        rawChunksPreview,
      },
    };
  }

  const ai = await callGeminiRepair(chunks);
  if (!ai.ok) {
    return {
      final: deterministic,
      finalSource: "deterministic",
      deterministicQuality: detScore.rating,
      finalQuality: detScore.rating,
      aiRepairUsed: true,
      aiRepairSuccess: false,
      repairReason: `ai_call_failed: ${ai.reason}`,
      diagnostics: {
        deterministicPreview,
        repairedPreview: null,
        rawChunksPreview,
        aiHttpStatus: ai.httpStatus,
      },
    };
  }

  const validation = validateRepairedSentences(chunks, ai.sentences);
  if (!validation.ok) {
    const repairedPreview = ai.sentences.slice(0, 20).map((s, i) => ({
      text: s.text,
      start: Number(s.start_time.toFixed(2)),
      end: Number(s.end_time.toFixed(2)),
      words: wc(s.text),
    })) as PreviewUnit[];
    return {
      final: deterministic,
      finalSource: "deterministic",
      deterministicQuality: detScore.rating,
      finalQuality: detScore.rating,
      aiRepairUsed: true,
      aiRepairSuccess: false,
      repairReason: `validation_failed: ${validation.reason}`,
      diagnostics: {
        deterministicPreview,
        repairedPreview,
        rawChunksPreview,
        validationError: validation.reason,
        aiHttpStatus: ai.httpStatus,
      },
    };
  }

  // Accept AI output → convert to TranscriptSentence shape.
  const repaired: TranscriptSentence[] = ai.sentences.map((s, i) => ({
    id: i,
    text: s.text,
    offset: s.start_time,
    duration: Math.max(0, s.end_time - s.start_time),
    endTime: s.end_time,
  }));
  const repairedScore = scoreSentenceQuality(repaired);
  const repairedPreview = repaired.slice(0, 20).map(toPreview);

  return {
    final: repaired,
    finalSource: "ai_repaired",
    deterministicQuality: detScore.rating,
    finalQuality: repairedScore.rating,
    aiRepairUsed: true,
    aiRepairSuccess: true,
    repairReason: `repaired_${detScore.rating}_to_${repairedScore.rating}`,
    diagnostics: {
      deterministicPreview,
      repairedPreview,
      rawChunksPreview,
      aiHttpStatus: ai.httpStatus,
    },
  };
}
