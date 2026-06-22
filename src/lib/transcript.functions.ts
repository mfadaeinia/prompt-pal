import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { YoutubeTranscript } from "youtube-transcript";
import { detectLanguage, sameBaseLanguage } from "@/lib/lang-detect.server";

const Input = z.object({
  url: z.string().min(1).max(500),
  /**
   * The language SPOKEN in the video (ISO-639-1, e.g. "en", "nl").
   */
  spokenLanguage: z.string().min(1).max(20).optional(),
  /** Deprecated alias for spokenLanguage. */
  requestedLanguage: z.string().min(1).max(20).optional(),
  /** Benchmark hooks — bypass cache / captions, force a provider. */
  skipCache: z.boolean().optional(),
  skipYoutube: z.boolean().optional(),
  forceProvider: z.enum(["openai", "transcribr"]).optional(),
});
const ManualInput = z.object({
  url: z.string().min(1).max(500),
  text: z.string().min(1).max(200_000),
});

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export type TranscriptSentence = {
  id: number;
  text: string;
  offset: number; // seconds (startTime)
  duration: number;
  endTime: number; // seconds
};

export type TranscriptSource = "cache" | "youtube" | "fallback" | "asr" | "manual";

export type TranscriptQuality = "high" | "medium" | "low";

export type TranscriptQualityReport = {
  quality: TranscriptQuality;
  reasons: string[];
  metrics: {
    sentenceCount: number;
    avgWordsPerSentence: number;
    shortFragmentRatio: number;
    hasPunctuationInRaw: boolean;
  };
};

export type AsrWord = {
  text: string;
  start: number; // seconds
  end: number;   // seconds
};

export type AsrResult = {
  /** Detected language code (e.g. "en", "nl") */
  language: string;
  /** Word-level timestamps — required. Sentences are built from these. */
  words: AsrWord[];
  /** Raw provider segments kept only for debugging */
  rawSegments?: unknown;
};

export type AsrTrace = {
  invoked: boolean;
  httpStatus: number | null;
  errorMessage: string | null;
  rawSegments: number;
  keptSegments: number;
  discardedReason: string | null;
};

/** Generic, provider-agnostic ASR diagnostics persisted to benchmark rows. */
export type GenericAsrTrace = {
  provider: "transcribr" | "openai" | null;
  model: string | null;
  httpStatus: number | null;
  errorBody: string | null;
  segmentsCount: number | null;
  durationMs: number | null;
  language: string | null;
  failureCode: string | null;
  /** Audio-extractor (e.g. RapidAPI youtube-mp36) diagnostics — populated
   *  for providers that go through an extractor step (currently OpenAI). */
  extractor?: {
    provider: string | null;        // e.g. "youtube-mp36.p.rapidapi.com"
    httpStatus: number | null;
    responseStatus: string | null;  // e.g. "ok" | "fail" | "processing"
    responseBody: string | null;    // truncated to 1000 chars
    audioUrlFound: boolean | null;
    audioUrl: string | null;
    latencyMs: number | null;
    failureReason: string | null;   // classified bucket
  } | null;
};


export type ProviderTrace = {
  transcribr: TranscribrTrace;
  asr: AsrTrace;
  /** Generic ASR diagnostics. Populated for whichever provider ASR_PROVIDER selected. */
  asrGeneric?: GenericAsrTrace;
};

export type CacheProvenance = {
  cacheRowId: string | null;
  cacheKey: string;
  videoId: string;
  requestedLanguage: string;
  provider: string; // "youtube" | "fallback" | "manual" | (legacy "unknown")
  providerResponseLanguage: string | null;
  sourceVersion: number;
  transcriptLengthChars: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TranscriptStageTimings = {
  total_server_ms: number | null;
  cache_lookup_ms: number | null;
  youtube_caption_attempt_ms: number | null;
  audio_extract_ms: number | null;
  audio_download_ms: number | null;
  openai_transcription_ms: number | null;
  chunk_mapping_ms: number | null;
  sentence_build_ms: number | null;
  cache_write_ms: number | null;
  // Diagnostic context
  provider_used: string | null;
  cache_hit: boolean | null;
  audio_size_mb: number | null;
  openai_segments_count: number | null;
  sentence_count: number | null;
  video_duration_seconds: number | null;
};

export type FetchTranscriptResult = {
  videoId: string;
  sentences: TranscriptSentence[];
  source: TranscriptSource;
  /** When source==="cache", which provider produced the cached row. */
  cachedFromProvider?: string | null;
  /** Language that came back from the caption/ASR provider (i.e. what's
   *  actually in the transcript text). Equivalent to spoken_language when
   *  validated. Null when the provider didn't report it. */
  language?: string | null;
  /** Spoken language the caller asked us to transcribe (echoed back). */
  spokenLanguage?: string | null;
  /** Same as language; explicit field so the UI can show
   *  "Transcript language" without aliasing the provider response. */
  transcriptLanguage?: string | null;
  cacheHit: boolean;
  quality: TranscriptQualityReport;
  providerTrace?: ProviderTrace;
  /** Full provenance for the row we returned (cache hit OR newly written). */
  provenance?: CacheProvenance | null;
  /** Raw caption chunks before deterministic segmentation. Populated for
   *  all success paths so downstream consumers (benchmark, repair) can
   *  re-segment without a second fetch. */
  rawChunks?: RawChunk[];
  /** Per-stage timings for founder diagnostics. */
  stageTimings?: TranscriptStageTimings;
};

export type TranscriptErrorType =
  | "rate_limited"
  | "captions_disabled"
  | "not_found"
  | "network"
  | "asr_failed"
  | "asr_timeout"
  | "asr_empty"
  | "validation_failed"
  | "unknown";

export type RawChunk = { text: string; offset: number; duration: number };


export function buildSentencesFromChunksExport(chunks: RawChunk[]): TranscriptSentence[] {
  return buildSentencesFromChunks(chunks);
}

/**
 * Convert Whisper-style word-level timestamps into clickable sentence units.
 *
 * Each AsrWord becomes a 1-word RawChunk (offset = word.start, duration = end - start).
 * The existing deterministic segmenter (`buildSentencesFromChunks`) then groups
 * words by punctuation, timing gaps, capitalization, and max-word heuristics.
 *
 * Guarantees:
 *   - Every sentence's `offset` traces back to a real word.start (no invented times).
 *   - Every sentence's `endTime` traces back to a real word.end.
 *   - No paraphrase/hallucination: text is concatenated verbatim from words[].
 *   - Sentences are sorted by offset; ids reassigned 0..n-1.
 *
 * Invalid words (NaN, end <= start, empty text) are dropped silently.
 */
export function buildSentencesFromAsrWords(words: AsrWord[]): TranscriptSentence[] {
  if (!Array.isArray(words) || words.length === 0) return [];

  const chunks: RawChunk[] = [];
  for (const w of words) {
    if (!w || typeof w.text !== "string") continue;
    const text = w.text.trim();
    if (!text) continue;
    const start = Number(w.start);
    const end = Number(w.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (end <= start) continue;
    chunks.push({ text, offset: start, duration: end - start });
  }

  if (chunks.length === 0) return [];
  chunks.sort((a, b) => a.offset - b.offset);

  const sentences = buildSentencesFromChunks(chunks);
  return sentences.map((s, i) => ({ ...s, id: i }));
}

/** Convenience wrapper: build sentences directly from an AsrResult. */
export function buildSentencesFromAsrResult(asr: AsrResult): TranscriptSentence[] {
  return buildSentencesFromAsrWords(asr.words);
}

function classifyError(err: unknown): TranscriptErrorType {
  const msg = (err instanceof Error ? err.message : String(err || "")).toLowerCase();
  if (
    msg.includes("too many requests") ||
    msg.includes("429") ||
    msg.includes("captcha") ||
    msg.includes("rate") ||
    msg.includes("blocked")
  ) return "rate_limited";
  if (msg.includes("transcript is disabled") || msg.includes("disabled transcript") || msg.includes("captions"))
    return "captions_disabled";
  if (msg.includes("not find") || msg.includes("no transcript") || msg.includes("unavailable"))
    return "not_found";
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("timeout"))
    return "network";
  return "unknown";
}

// User-facing message is intentionally generic — no provider names, no
// status codes, no "captions disabled" or "CAPTCHA" wording. The internal
// `errorType` is for telemetry only.
const FRIENDLY_TRANSCRIPT_ERROR =
  "We couldn't automatically load subtitles for this video right now.";

function logEvent(payload: {
  video_id: string | null;
  fetch_source: TranscriptSource | "none";
  success: boolean;
  cache_hit?: boolean;
  error_type?: TranscriptErrorType | null;
  error_message?: string | null;
}) {
  try {
    console.log("[transcript]", JSON.stringify(payload));
  } catch {}
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;#39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function wordCount(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

// Segment via punctuation. May return a few huge segments when the provider
// returns unpunctuated text — caller decides whether to fall back.
function segmentByPunctuation(
  cleaned: RawChunk[]
): TranscriptSentence[] {
  let joined = "";
  const charTime: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (i > 0) {
      joined += " ";
      charTime.push(cleaned[i - 1].offset + cleaned[i - 1].duration);
    }
    const len = c.text.length;
    for (let j = 0; j < len; j++) {
      charTime.push(c.offset + (len > 0 ? (j / len) * c.duration : 0));
    }
    joined += c.text;
  }

  const decoded = decodeEntities(joined);
  const out: TranscriptSentence[] = [];
  const sentenceRegex = /[^.!?\n]+[.!?]+|[^.!?\n]+$/g;
  let id = 0;
  let match: RegExpExecArray | null;
  while ((match = sentenceRegex.exec(decoded)) !== null) {
    const text = match[0].trim();
    if (!text) continue;
    const startChar = match.index;
    const startTime = charTime[Math.min(startChar, charTime.length - 1)] ?? 0;
    out.push({ id: id++, text, offset: startTime, duration: 0, endTime: 0 });
  }
  for (let i = 0; i < out.length; i++) {
    const cur = out[i];
    const next = out[i + 1];
    cur.endTime = next ? next.offset : cur.offset + 5;
  }
  return out;
}

// Fallback segmentation: walk raw chunks and emit a segment when we hit a
// target word count, a large timing gap between chunks, or punctuation.
// Aims for ~10–25 words per segment while preserving timestamps.
function segmentByChunksAndTiming(
  cleaned: RawChunk[],
  opts: { target?: number; max?: number; gapSeconds?: number } = {}
): TranscriptSentence[] {
  const target = opts.target ?? 15;
  const max = opts.max ?? 25;
  const gapSeconds = opts.gapSeconds ?? 1.2;

  const out: TranscriptSentence[] = [];
  let id = 0;
  let buf: string[] = [];
  let bufWords = 0;
  let bufStart = 0;
  let bufEnd = 0;
  let bufOpen = false;

  const flush = () => {
    if (!buf.length) return;
    const text = decodeEntities(buf.join(" ").replace(/\s+/g, " ").trim());
    if (!text) {
      buf = [];
      bufWords = 0;
      bufOpen = false;
      return;
    }
    out.push({
      id: id++,
      text,
      offset: bufStart,
      duration: Math.max(0, bufEnd - bufStart),
      endTime: bufEnd,
    });
    buf = [];
    bufWords = 0;
    bufOpen = false;
  };

  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    const prev = i > 0 ? cleaned[i - 1] : null;
    const prevEnd = prev ? prev.offset + prev.duration : c.offset;
    const gap = prev ? c.offset - prevEnd : 0;

    // Break on a large timing gap before adding this chunk.
    if (bufOpen && gap >= gapSeconds && bufWords >= Math.min(6, target)) {
      flush();
    }

    if (!bufOpen) {
      bufStart = c.offset;
      bufOpen = true;
    }
    buf.push(c.text);
    bufWords += wordCount(c.text);
    bufEnd = c.offset + c.duration;

    const endsWithPunct = /[.!?]\s*$/.test(c.text.trim());

    if (bufWords >= max || (endsWithPunct && bufWords >= target)) {
      flush();
    } else if (bufWords >= target) {
      // Look ahead — if next chunk starts mid-thought, still flush at target.
      flush();
    }
  }
  flush();

  // Final endTime fix-up so consecutive segments meet.
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i].endTime <= out[i].offset) {
      out[i].endTime = out[i + 1].offset;
    }
  }
  return out;
}

// Merge fragments under `minWords` into their nearest neighbor unless they
// look like a valid short utterance (yes/no/thanks/etc).
function mergeTinyFragments(
  segs: TranscriptSentence[],
  minWords = 3,
): TranscriptSentence[] {
  if (segs.length <= 1) return segs;
  const valid = /^(yes|no|ok|okay|hi|hello|thanks|thank you|right|sure|exactly|maybe|wow|hmm|huh|nope|yeah|yep|absolutely)[.!?…]*$/i;
  const out: TranscriptSentence[] = [];
  for (const s of segs) {
    const w = wordCount(s.text);
    if (w < minWords && !valid.test(s.text.trim())) {
      const prev = out[out.length - 1];
      if (prev) {
        prev.text = `${prev.text} ${s.text}`.replace(/\s+/g, " ").trim();
        prev.endTime = s.endTime || prev.endTime;
        prev.duration = Math.max(0, prev.endTime - prev.offset);
        continue;
      }
    }
    out.push({ ...s });
  }
  return out.map((s, i) => ({ ...s, id: i }));
}

// Hard-cap any sentence > maxWords by splitting on the strongest internal
// boundary (punctuation, then conjunctions, then word-count chop). Preserves
// the total time span and distributes it proportionally to word counts.
function splitOversize(
  segs: TranscriptSentence[],
  maxWords = 35,
): TranscriptSentence[] {
  const out: TranscriptSentence[] = [];
  for (const s of segs) {
    const words = s.text.split(/\s+/);
    if (words.length <= maxWords) {
      out.push(s);
      continue;
    }
    const splitPattern =
      /[,;:—–]\s+|\s+(?:and|but|so|because|or|then|however|while|although)\s+/gi;
    const parts: string[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    const target = Math.max(
      15,
      Math.floor(words.length / Math.ceil(words.length / maxWords)),
    );
    const text = s.text;
    while ((m = splitPattern.exec(text)) !== null) {
      const head = text.slice(last, m.index + m[0].length).trim();
      if (wordCount(head) >= target * 0.7) {
        parts.push(head);
        last = m.index + m[0].length;
      }
    }
    const tail = text.slice(last).trim();
    if (tail) parts.push(tail);

    const final: string[] = [];
    for (const p of parts.length ? parts : [text]) {
      const pw = p.split(/\s+/);
      if (pw.length <= maxWords) {
        final.push(p);
      } else {
        for (let i = 0; i < pw.length; i += maxWords) {
          final.push(pw.slice(i, i + maxWords).join(" "));
        }
      }
    }
    const totalW = final.reduce((n, p) => n + wordCount(p), 0) || 1;
    let cursor = s.offset;
    const span = Math.max(0, (s.endTime || s.offset) - s.offset);
    for (const part of final) {
      const w = wordCount(part);
      const dur = span * (w / totalW);
      out.push({
        id: 0,
        text: part,
        offset: cursor,
        duration: dur,
        endTime: cursor + dur,
      });
      cursor += dur;
    }
  }
  return out.map((s, i) => ({ ...s, id: i }));
}

function buildSentencesFromChunks(chunks: RawChunk[]): TranscriptSentence[] {
  const cleaned = chunks
    .map((r) => ({
      text: r.text.replace(/\s+/g, " ").trim(),
      offset: r.offset,
      duration: r.duration,
    }))
    .filter((c) => c.text.length > 0);

  if (!cleaned.length) return [];

  const totalWords = cleaned.reduce((n, c) => n + wordCount(c.text), 0);
  const punctSegments = segmentByPunctuation(cleaned);
  const avgWords =
    punctSegments.length > 0 ? totalWords / punctSegments.length : Infinity;
  const longest = punctSegments.reduce(
    (m, s) => Math.max(m, wordCount(s.text)),
    0
  );

  const sparse =
    avgWords > 30 ||
    longest > 60 ||
    punctSegments.length < Math.max(2, Math.floor(totalWords / 40));

  let final: TranscriptSentence[];
  let strategy: "punctuation" | "timing+chunks" | "hybrid";

  if (!sparse) {
    final = punctSegments;
    strategy = "punctuation";
  } else if (punctSegments.length <= 3) {
    final = segmentByChunksAndTiming(cleaned, { target: 14, max: 25, gapSeconds: 1.0 });
    strategy = "timing+chunks";
  } else {
    final = [];
    let id = 0;
    for (const seg of punctSegments) {
      if (wordCount(seg.text) <= 25) {
        final.push({ ...seg, id: id++ });
        continue;
      }
      const segEnd = seg.endTime || seg.offset + 5;
      const subChunks = cleaned.filter(
        (c) => c.offset + c.duration >= seg.offset && c.offset <= segEnd
      );
      const subSegs = subChunks.length
        ? segmentByChunksAndTiming(subChunks, { target: 14, max: 25 })
        : [seg];
      for (const s of subSegs) final.push({ ...s, id: id++ });
    }
    strategy = "hybrid";
  }

  // Post-passes: enforce sentence-unit quality invariants.
  final = splitOversize(final, 35);
  final = mergeTinyFragments(final, 3);

  const segWordCounts = final.map((s) => wordCount(s.text));
  const segMax = segWordCounts.reduce((m, n) => Math.max(m, n), 0);
  const segMin = segWordCounts.length
    ? segWordCounts.reduce((m, n) => Math.min(m, n), Infinity)
    : 0;
  const segAvg = segWordCounts.length
    ? totalWords / segWordCounts.length
    : 0;

  console.log("[transcript-debug] segmentation", {
    strategy,
    raw_chunks: cleaned.length,
    total_words: totalWords,
    punctuation_segments: punctSegments.length,
    punctuation_avg_words: Number(avgWords.toFixed(1)),
    punctuation_longest_words: longest,
    sparse,
    final_segments: final.length,
    avg_words_per_segment: Number(segAvg.toFixed(1)),
    longest_segment_words: segMax,
    shortest_segment_words: segMin === Infinity ? 0 : segMin,
  });

  return final;
}

function assessQuality(
  rawChunks: RawChunk[],
  sentences: TranscriptSentence[]
): TranscriptQualityReport {
  const sentenceCount = sentences.length;
  const wordCounts = sentences.map((s) => wordCount(s.text));
  const totalWords = wordCounts.reduce((n, w) => n + w, 0);
  const avgWordsPerSentence =
    sentenceCount > 0 ? totalWords / sentenceCount : 0;

  const shortFragments = rawChunks.filter(
    (c) => (c.text ?? "").trim().length < 8
  ).length;
  const shortFragmentRatio =
    rawChunks.length > 0 ? shortFragments / rawChunks.length : 0;

  const rawText = rawChunks.map((c) => c.text).join(" ");
  const hasPunctuationInRaw = /[.!?]/.test(rawText);

  const reasons: string[] = [];
  let quality: TranscriptQuality = "high";

  // LOW signals
  if (sentenceCount < 3) reasons.push("fewer_than_3_sentences");
  if (sentenceCount > 0 && avgWordsPerSentence < 6)
    reasons.push("avg_sentence_too_short");
  if (shortFragmentRatio > 0.7) reasons.push("mostly_short_fragments");
  if (!hasPunctuationInRaw) reasons.push("no_punctuation_in_raw");

  if (reasons.length >= 2 || sentenceCount < 3 || !hasPunctuationInRaw) {
    quality = "low";
  } else if (
    avgWordsPerSentence > 35 ||
    avgWordsPerSentence < 8 ||
    shortFragmentRatio > 0.4
  ) {
    quality = "medium";
    if (avgWordsPerSentence > 35) reasons.push("very_long_avg_sentence");
  }

  return {
    quality,
    reasons,
    metrics: {
      sentenceCount,
      avgWordsPerSentence: Number(avgWordsPerSentence.toFixed(1)),
      shortFragmentRatio: Number(shortFragmentRatio.toFixed(2)),
      hasPunctuationInRaw,
    },
  };
}

function parseTimestamp(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = m[3] ? Number(m[3]) : null;
    if (c !== null) return a * 3600 + b * 60 + c;
    return a * 60 + b;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function chunksFromManualText(text: string): RawChunk[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const tsRegex = /^\[?(\d{1,2}:\d{1,2}(?::\d{1,2})?)\]?\s*[-–:]?\s*(.*)$/;
  const parsed: { t: number | null; text: string }[] = [];
  for (const line of lines) {
    const m = line.match(tsRegex);
    if (m && m[2]) {
      const t = parseTimestamp(m[1]);
      parsed.push({ t, text: m[2] });
    } else {
      parsed.push({ t: null, text: line });
    }
  }

  const hasTimes = parsed.some((p) => p.t !== null);
  if (hasTimes) {
    const chunks: RawChunk[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const cur = parsed[i];
      let t = cur.t;
      if (t === null) {
        const prev = chunks.length ? chunks[chunks.length - 1] : null;
        t = prev ? prev.offset + Math.max(1, prev.duration) : 0;
      }
      chunks.push({ text: cur.text, offset: t!, duration: 0 });
    }
    for (let i = 0; i < chunks.length; i++) {
      const next = chunks[i + 1];
      chunks[i].duration = next ? Math.max(0.5, next.offset - chunks[i].offset) : 4;
    }
    return chunks;
  }

  const perChunk = 3;
  return parsed.map((p, i) => ({
    text: p.text,
    offset: i * perChunk,
    duration: perChunk,
  }));
}

/**
 * Transcript pipeline version. BUMP when the timing/segmentation pipeline
 * changes in a way that makes older cached transcripts incorrect.
 *
 *   v1: original CBR byte→time mapping.
 *   v2: progressive Whisper stream, still byte-derived offsets (drifted).
 *   v3: cumulative Whisper-decoded durations across chunks. Eliminates
 *       progressive drift caused by VBR/padding/frame alignment.
 *
 * Any cached row with `source_version < TRANSCRIPT_PIPELINE_VERSION` is
 * treated as stale and the pipeline re-runs. We do NOT delete the old row —
 * the upsert on (video_id, requested_language, provider, source_version)
 * just writes a new row at the current version.
 */
export const TRANSCRIPT_PIPELINE_VERSION = 3;
const SOURCE_VERSION = TRANSCRIPT_PIPELINE_VERSION;

function makeCacheKey(videoId: string, requestedLanguage: string, provider: string, version = SOURCE_VERSION) {
  return `${videoId}|${requestedLanguage}|${provider}|${version}`;
}

type CacheRow = {
  id: string;
  video_id: string;
  transcript_json: RawChunk[];
  language: string | null;
  source: string | null;
  provider: string | null;
  requested_language: string | null;
  provider_response_language: string | null;
  source_version: number | null;
  cache_key: string | null;
  transcript_length_chars: number | null;
  created_at: string | null;
  updated_at: string | null;
};

function rowToProvenance(r: CacheRow): CacheProvenance {
  return {
    cacheRowId: r.id,
    cacheKey: r.cache_key ?? makeCacheKey(r.video_id, r.requested_language ?? "_any_", r.provider ?? r.source ?? "unknown", r.source_version ?? 1),
    videoId: r.video_id,
    requestedLanguage: r.requested_language ?? "_any_",
    provider: r.provider ?? r.source ?? "unknown",
    providerResponseLanguage: r.provider_response_language ?? r.language ?? null,
    sourceVersion: r.source_version ?? 1,
    transcriptLengthChars: r.transcript_length_chars ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Look up a cached transcript. Matches by (video_id, requested_language).
 *
 *   - If requestedLanguage is "_any_", we accept any language and prefer
 *     the most recently updated row — but we *validate* the picked row's
 *     language against the actual transcript text when it was written by
 *     the fallback ASR provider (Transcribr), which has historically
 *     mislabeled videos. A row whose stored language contradicts a
 *     high-confidence text detection is treated as poisoned and skipped.
 *
 *   - Otherwise we require requested_language === requestedLanguage OR
 *     provider_response_language === requestedLanguage OR the stored
 *     language matches the request, AND, for fallback rows, that the
 *     stored language doesn't contradict text detection.
 *
 *   - We never silently return a row whose language disagrees with what
 *     was asked for.
 */
async function readCache(videoId: string, requestedLanguage: string): Promise<CacheRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("youtube_transcript_cache" as any)
    .select("id, video_id, transcript_json, language, source, provider, requested_language, provider_response_language, source_version, cache_key, transcript_length_chars, created_at, updated_at")
    .eq("video_id", videoId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.warn("[transcript] cache read error", error.message);
    return null;
  }
  const allRows = (data ?? []) as unknown as CacheRow[];
  // Pipeline-version gate: rows written by older pipelines are stale and
  // must be re-run. Do NOT delete them — bumping the version naturally
  // routes future writes to a fresh row.
  const rows = allRows.filter((r) => (r.source_version ?? 1) >= TRANSCRIPT_PIPELINE_VERSION);
  if (allRows.length && !rows.length) {
    console.log("[transcript] cache rows present but all below current pipeline version — re-running", {
      videoId,
      requestedLanguage,
      currentVersion: TRANSCRIPT_PIPELINE_VERSION,
      staleVersions: allRows.map((r) => r.source_version ?? 1),
    });
  }
  if (!rows.length) return null;

  const isPoisoned = (r: CacheRow): boolean => {
    // Only re-validate rows whose provider's language claim is historically
    // unreliable ("fallback" = Transcribr). YouTube captions and Whisper
    // carry their own language tag we trust.
    const provider = (r.provider ?? r.source ?? "").toLowerCase();
    if (provider !== "fallback") return false;
    const claimed = r.language ?? r.provider_response_language ?? null;
    if (!claimed) return false;
    const text = (r.transcript_json ?? [])
      .slice(0, 80)
      .map((c) => c?.text ?? "")
      .join(" ");
    if (text.length < 80) return false;
    const detected = detectLanguage(text);
    if (!detected.language || detected.confidence < 0.4) return false;
    if (sameBaseLanguage(detected.language, claimed)) return false;
    console.warn("[transcript] poisoned cache row detected — skipping", {
      videoId,
      cacheRowId: r.id,
      provider,
      claimedLanguage: claimed,
      detectedLanguage: detected.language,
      confidence: detected.confidence,
      scores: detected.scores,
    });
    return true;
  };

  if (requestedLanguage === "_any_") {
    const picked = rows.find((r) => !isPoisoned(r));
    return picked ?? null;
  }
  const match = rows.find((r) => {
    const langMatch =
      (r.requested_language && r.requested_language === requestedLanguage) ||
      (r.provider_response_language && sameBaseLanguage(r.provider_response_language, requestedLanguage)) ||
      (r.language && sameBaseLanguage(r.language, requestedLanguage));
    if (!langMatch) return false;
    return !isPoisoned(r);
  });
  return match ?? null;
}

export type ValidationResult = {
  ok: boolean;
  reason?: string;
  details?: Record<string, unknown>;
};

/**
 * Validate a transcript before caching it.
 *   - non-empty (≥10 chars, ≥1 chunk)
 *   - has timestamps (not all zeros)
 *   - plausible length vs. video duration (if known): expect ≥0.3 chars/sec
 *   - language match (only when both expected & actual are present)
 */
export function validateTranscript(params: {
  chunks: RawChunk[];
  expectedLanguage?: string | null;
  providerLanguage?: string | null;
  videoDurationSeconds?: number | null;
}): ValidationResult {
  const { chunks } = params;
  if (!chunks || chunks.length === 0) {
    return { ok: false, reason: "empty_chunks" };
  }
  const totalChars = chunks.reduce((n, c) => n + (c.text?.length ?? 0), 0);
  if (totalChars < 10) {
    return { ok: false, reason: "transcript_too_short", details: { chars: totalChars } };
  }
  const hasNonZeroOffset = chunks.some((c) => Number(c.offset) > 0);
  const hasAnyDuration = chunks.some((c) => Number(c.duration) > 0);
  if (!hasNonZeroOffset && !hasAnyDuration) {
    return { ok: false, reason: "no_timestamps", details: { chunks: chunks.length } };
  }
  if (params.videoDurationSeconds && params.videoDurationSeconds > 30) {
    const ratio = totalChars / params.videoDurationSeconds;
    if (ratio < 0.3) {
      return {
        ok: false,
        reason: "implausible_length_for_duration",
        details: { chars: totalChars, seconds: params.videoDurationSeconds, charsPerSecond: Number(ratio.toFixed(2)) },
      };
    }
  }
  if (
    params.expectedLanguage &&
    params.providerLanguage &&
    params.expectedLanguage !== "_any_" &&
    !languagesMatch(params.expectedLanguage, params.providerLanguage)
  ) {
    return {
      ok: false,
      reason: "language_mismatch",
      details: { expected: params.expectedLanguage, got: params.providerLanguage },
    };
  }
  return { ok: true };
}

function languagesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().split(/[-_]/)[0];
  return norm(a) === norm(b);
}

async function writeCache(params: {
  videoId: string;
  videoUrl: string;
  chunks: RawChunk[];
  requestedLanguage: string;
  provider: "youtube" | "manual" | "fallback" | "openai";
  providerResponseLanguage: string | null;
}): Promise<{ ok: boolean; provenance?: CacheProvenance; validation: ValidationResult }> {
  const allowed = new Set(["youtube", "manual", "fallback", "openai"]);
  if (!allowed.has(params.provider)) {
    return { ok: false, validation: { ok: false, reason: `invalid_provider:${params.provider}` } };
  }
  const validation = validateTranscript({
    chunks: params.chunks,
    expectedLanguage: params.requestedLanguage === "_any_" ? null : params.requestedLanguage,
    providerLanguage: params.providerResponseLanguage,
  });
  if (!validation.ok) {
    console.warn("[transcript] refusing to cache — validation failed", validation);
    return { ok: false, validation };
  }

  // Decide the authoritative `language` field.
  //
  //   - youtube / openai / manual:  trust the provider/caller as-is.
  //   - fallback (Transcribr):      historically lies. Run text detection
  //     over the first ~800 chars and either confirm, correct, or null it.
  //
  // `provider_response_language` ALWAYS stores the raw provider claim for
  // diagnostics, so we never lose what Transcribr originally said.
  let authoritativeLanguage: string | null = params.providerResponseLanguage;
  let textDetected: ReturnType<typeof detectLanguage> | null = null;
  if (params.provider === "fallback") {
    const text = params.chunks.slice(0, 80).map((c) => c.text).join(" ");
    textDetected = detectLanguage(text);
    const specificRequest =
      params.requestedLanguage && params.requestedLanguage !== "_any_"
        ? params.requestedLanguage
        : null;
    const providerLang = params.providerResponseLanguage;
    const detected = textDetected.language;
    const confident = textDetected.confidence >= 0.4;

    if (specificRequest) {
      // Caller declared a language. Accept it as authoritative only if
      // detection agrees (or confidence is too low to disagree).
      if (!detected || !confident || sameBaseLanguage(detected, specificRequest)) {
        authoritativeLanguage = specificRequest;
      } else {
        authoritativeLanguage = detected;
        console.warn("[transcript] fallback text contradicts requested language", {
          videoId: params.videoId,
          requested: specificRequest,
          providerSaid: providerLang,
          textDetected: detected,
          confidence: textDetected.confidence,
        });
      }
    } else if (confident && detected) {
      // No caller hint. Trust text detection over the provider's claim.
      if (providerLang && !sameBaseLanguage(detected, providerLang)) {
        console.warn("[transcript] fallback provider language disagrees with text", {
          videoId: params.videoId,
          providerSaid: providerLang,
          textDetected: detected,
          confidence: textDetected.confidence,
        });
      }
      authoritativeLanguage = detected;
    } else {
      // Low confidence + no caller hint → don't poison future "_any_"
      // reads with an unvalidated language tag.
      authoritativeLanguage = null;
    }
  }

  const totalChars = params.chunks.reduce((n, c) => n + (c.text?.length ?? 0), 0);
  const cacheKey = makeCacheKey(params.videoId, params.requestedLanguage, params.provider);
  const now = new Date().toISOString();
  const row = {
    video_id: params.videoId,
    video_url: params.videoUrl,
    transcript_json: params.chunks,
    language: authoritativeLanguage,
    source: params.provider,
    provider: params.provider,
    requested_language: params.requestedLanguage,
    provider_response_language: params.providerResponseLanguage,
    source_version: SOURCE_VERSION,
    cache_key: cacheKey,
    transcript_length_chars: totalChars,
    updated_at: now,
  } as any;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("youtube_transcript_cache" as any)
    .upsert(row, { onConflict: "video_id,requested_language,provider,source_version" })
    .select("id, video_id, transcript_json, language, source, provider, requested_language, provider_response_language, source_version, cache_key, transcript_length_chars, created_at, updated_at")
    .maybeSingle();
  if (error) {
    console.warn("[transcript] cache write error", error.message);
    return { ok: false, validation: { ok: false, reason: `db_error:${error.message}` } };
  }
  if (textDetected) {
    console.log("[transcript] fallback cache write", {
      videoId: params.videoId,
      requestedLanguage: params.requestedLanguage,
      providerResponseLanguage: params.providerResponseLanguage,
      textDetectedLanguage: textDetected.language,
      textDetectedConfidence: textDetected.confidence,
      authoritativeLanguage,
    });
  }
  return { ok: true, validation, provenance: data ? rowToProvenance(data as unknown as CacheRow) : undefined };
}

/** Founder/debug: delete every cached row for a video, across all providers/languages. */
export const clearTranscriptCacheForVideo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ videoId: z.string().min(1).max(50) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: deleted, error } = await supabaseAdmin
      .from("youtube_transcript_cache" as any)
      .delete()
      .eq("video_id", data.videoId)
      .select("id, provider, requested_language");
    if (error) throw new Error(error.message);
    const rows = (deleted ?? []) as unknown as Array<{ id: string; provider: string; requested_language: string }>;
    console.log("[transcript] cache cleared", { videoId: data.videoId, removed: rows.length });
    return { ok: true, removed: rows.length, rows };
  });

/** Founder/debug: delete every cached row for every active benchmark video. */
export const clearBenchmarkTranscriptCache = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true; removed: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: vids, error: vErr } = await supabaseAdmin
      .from("benchmark_videos" as any)
      .select("video_id")
      .eq("active", true);
    if (vErr) throw new Error(vErr.message);
    const ids = ((vids ?? []) as any[]).map((r) => r.video_id).filter(Boolean);
    if (!ids.length) return { ok: true, removed: 0 };
    const { data: deleted, error } = await supabaseAdmin
      .from("youtube_transcript_cache" as any)
      .delete()
      .in("video_id", ids)
      .select("id");
    if (error) throw new Error(error.message);
    const removed = (deleted ?? []).length;
    console.log("[transcript] benchmark cache cleared", { removed });
    return { ok: true, removed };
  });





async function recordTranscriptReport(params: {
  videoId: string;
  videoUrl: string;
  source: TranscriptSource;
  language: string | null;
  quality: TranscriptQualityReport;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = params.quality.quality;
    const full = q === "high";
    const limited = q === "low";
    const explanations = q !== "low";
    const { error } = await supabaseAdmin
      .from("video_transcript_reports" as any)
      .insert({
        video_id: params.videoId,
        video_url: params.videoUrl,
        transcript_source: params.source,
        language: params.language,
        sentence_count: params.quality.metrics.sentenceCount,
        avg_sentence_length: params.quality.metrics.avgWordsPerSentence,
        quality_score: q,
        quality_reasons: params.quality.reasons,
        full_learning_enabled: full,
        limited_mode_enabled: limited,
        explanation_generation_enabled: explanations,
      } as any);
    if (error) console.warn("[transcript] report write error", error.message);
  } catch (e) {
    console.warn("[transcript] report write threw", e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------------------
// Layer 3: Fallback transcript provider — Transcribr.io
// Docs: https://www.transcribr.io/youtube-transcript-api
// POST https://www.transcribr.io/api/v1/transcript
//   headers: X-API-Key: <TRANSCRIBR_API_KEY>
//   body:    { video_id }
//   resp:    { transcript: [{text, start, duration}], language, ... }
// ---------------------------------------------------------------------------
export type TranscribrTrace = {
  invoked: boolean;
  httpStatus: number | null;
  errorMessage: string | null;
  rawSegments: number;
  keptSegments: number;
  discardedReason: string | null;
  durationMs: number | null;
};

async function fetchFromFallbackProvider(params: {
  videoId: string;
  videoUrl: string;
  trace: TranscribrTrace;
}): Promise<{ chunks: RawChunk[]; language: string | null } | null> {
  const { trace } = params;
  const apiKey = process.env.TRANSCRIBR_API_KEY;
  if (!apiKey) {
    trace.invoked = false;
    trace.errorMessage = "TRANSCRIBR_API_KEY missing";
    console.warn("[transcript-debug] TRANSCRIBR_API_KEY missing — skipping fallback");
    return null;
  }
  trace.invoked = true;
  const tStart = Date.now();

  try {
    const res = await fetch("https://www.transcribr.io/api/v1/transcript", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
      body: JSON.stringify({ video_id: params.videoId }),
    });
    trace.httpStatus = res.status;
    console.log("[transcript-debug] Transcribr HTTP", { status: res.status, ok: res.ok });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      trace.errorMessage = text.slice(0, 300) || `HTTP ${res.status}`;
      trace.durationMs = Date.now() - tStart;
      console.warn("[transcript-debug] Transcribr error body", text.slice(0, 500));
      return null;
    }
    const json: any = await res.json();
    const transcript: any[] = Array.isArray(json?.transcript) ? json.transcript : [];
    trace.rawSegments = transcript.length;
    console.log("[transcript-debug] Transcribr response", {
      transcript_items: transcript.length,
      language: json?.language ?? null,
      top_level_keys: json && typeof json === "object" ? Object.keys(json) : [],
    });
    if (!transcript.length) {
      trace.discardedReason = "empty_transcript_array";
      trace.durationMs = Date.now() - tStart;
      return null;
    }
    const chunks: RawChunk[] = transcript
      .map((c) => ({
        text: String(c.text ?? ""),
        offset: Number(c.start ?? 0),
        duration: Number(c.duration ?? 0),
      }))
      .filter((c) => c.text.length > 0);
    trace.keptSegments = chunks.length;
    if (!chunks.length) {
      trace.discardedReason = "all_segments_blank_after_filter";
      trace.durationMs = Date.now() - tStart;
      return null;
    }
    trace.durationMs = Date.now() - tStart;
    return { chunks, language: json?.language ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    trace.errorMessage = msg;
    trace.durationMs = Date.now() - tStart;
    console.warn("[transcript-debug] Transcribr fetch threw", msg);
    return null;
  }
}




// ---------------------------------------------------------------------------
// Layer 4 (LLM-as-transcriber) is permanently removed.
//
// We previously sent the YouTube URL to Gemini via the Lovable AI Gateway as
// `file_data` and asked it to "transcribe". The gateway does NOT fetch and
// decode the video — the model only sees the URL as text and hallucinates a
// plausible-but-fake transcript that has nothing to do with the real audio.
//
// HARD RULE: transcript text may ONLY come from
//   1. cached entries previously produced by (2) or (3)
//   2. official YouTube captions (youtube-transcript)
//   3. an audio-based ASR provider (Transcribr today)
//   4. user-pasted manual text
//
// AI is allowed ONLY as a post-processor on text that already came from one
// of the above sources (sentence boundary repair in sentence-repair.server.ts,
// which validates token overlap and rejects hallucinated output). AI must
// never invent words and must never be asked to "transcribe" from a URL.
// ---------------------------------------------------------------------------



function makeEmptyTimings(): TranscriptStageTimings {
  return {
    total_server_ms: null,
    cache_lookup_ms: null,
    youtube_caption_attempt_ms: null,
    audio_extract_ms: null,
    audio_download_ms: null,
    openai_transcription_ms: null,
    chunk_mapping_ms: null,
    sentence_build_ms: null,
    cache_write_ms: null,
    provider_used: null,
    cache_hit: null,
    audio_size_mb: null,
    openai_segments_count: null,
    sentence_count: null,
    video_duration_seconds: null,
  };
}

function logTimings(label: string, videoId: string | null, t: TranscriptStageTimings) {
  try {
    console.log(`[transcript-timing] ${label}`, JSON.stringify({ videoId, ...t }));
  } catch {}
}

export const fetchTranscript = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<FetchTranscriptResult> => {
    const tStart = Date.now();
    const timings = makeEmptyTimings();
    console.log("[transcript-debug] URL received:", data.url);
    const videoId = extractVideoId(data.url);

    console.log("[transcript-debug] extracted videoId:", videoId);
    if (!videoId) {
      logEvent({
        video_id: null,
        fetch_source: "none",
        success: false,
        error_type: "unknown",
        error_message: "invalid_url",
      });
      throw new Error("This doesn't look like a YouTube link.");
    }

    // -------- Layer 1: Cache --------
    // Resolve the SPOKEN language: prefer `spokenLanguage`, fall back to the
    // legacy `requestedLanguage` field (treated as spoken language for
    // back-compat). NEVER treat the learner's UI/help language as the spoken
    // language — that would pull auto-translated caption tracks.
    const spokenLanguageRaw =
      (data.spokenLanguage ?? data.requestedLanguage)?.trim() || "";
    const spokenLanguage = spokenLanguageRaw || null; // null = auto/original
    const requestedLanguage = spokenLanguage ?? "_any_";
    const tCache = Date.now();
    const cached = data.skipCache ? null : await readCache(videoId, requestedLanguage);
    timings.cache_lookup_ms = Date.now() - tCache;
    if (cached?.transcript_json?.length) {
      const tBuild = Date.now();
      const sentences = buildSentencesFromChunks(cached.transcript_json);
      timings.sentence_build_ms = Date.now() - tBuild;

      const chars = sentences.reduce((n, s) => n + s.text.length, 0);
      const provenance = rowToProvenance(cached);
      console.log("[transcript-debug] cache HIT", {
        videoId,
        raw_chunks: cached.transcript_json.length,
        sentences: sentences.length,
        total_chars: chars,
        language: cached.language,
        provenance,
      });
      logEvent({
        video_id: videoId,
        fetch_source: "cache",
        success: true,
        cache_hit: true,
      });
      const quality = assessQuality(cached.transcript_json, sentences);
      await recordTranscriptReport({
        videoId,
        videoUrl: data.url,
        source: "cache",
        language: cached.language,
        quality,
      });
      timings.provider_used = provenance.provider;
      timings.cache_hit = true;
      timings.sentence_count = sentences.length;
      timings.total_server_ms = Date.now() - tStart;
      logTimings("slow:cache-hit", videoId, timings);
      return {
        videoId,
        sentences,
        source: "cache",
        cachedFromProvider: provenance.provider,
        language: cached.language,
        spokenLanguage,
        transcriptLanguage: cached.language,
        cacheHit: true,
        quality,
        provenance,
        rawChunks: cached.transcript_json,
        stageTimings: timings,
      };
    }
    console.log("[transcript-debug] cache MISS for", videoId);

    // Cache miss — try external providers.
    logEvent({
      video_id: videoId,
      fetch_source: "cache",
      success: false,
      cache_hit: false,
    });

    // Per-provider diagnostics (always returned/thrown so callers can attribute failures).
    const transcribrTrace: TranscribrTrace = {
      invoked: false, httpStatus: null, errorMessage: null,
      rawSegments: 0, keptSegments: 0, discardedReason: null,
      durationMs: null,
    };
    const asrTrace: AsrTrace = {
      invoked: false, httpStatus: null, errorMessage: null,
      rawSegments: 0, keptSegments: 0, discardedReason: null,
    };

    // -------- Layer 2: YouTube captions --------
    //
    // CRITICAL: never iterate through unrelated languages here. youtube-transcript
    // happily returns YouTube's AUTO-TRANSLATED caption track for a language
    // the video isn't actually in (e.g. asking for "nl" on an English video
    // yields a machine-translated Dutch transcript). That's how transcripts
    // ended up in the wrong language.
    //
    // Strategy:
    //   - If the caller declared a spoken language → request exactly that
    //     (and its regional variants).
    //   - Otherwise → request the video's DEFAULT/ORIGINAL track only
    //     (no `lang` option = original creator-uploaded captions).
    let raw: RawChunk[] | null = null;
    let usedLang: string | null = null;
    let lastErr: unknown = null;
    let blocked = false;
    const langCandidates: (string | undefined)[] = data.skipYoutube
      ? []
      : spokenLanguage
      ? [
          spokenLanguage,
          spokenLanguage === "en" ? "en-US" : null,
          spokenLanguage === "en" ? "en-GB" : null,
          spokenLanguage === "nl" ? "nl-NL" : null,
          undefined,
        ].filter((v): v is string | undefined => v !== null)
      : [undefined];
    const tYt = Date.now();
    for (const lang of langCandidates) {
      try {
        const r = await YoutubeTranscript.fetchTranscript(
          videoId,
          lang ? { lang } : undefined
        );
        console.log("[transcript-debug] youtube-transcript attempt", {
          lang: lang ?? "default",
          chunks: r?.length ?? 0,
        });
        if (r && r.length) {
          const tMap = Date.now();
          raw = r.map((x) => ({
            text: x.text,
            offset: x.offset / 1000,
            duration: x.duration / 1000,
          }));
          timings.chunk_mapping_ms = Date.now() - tMap;
          usedLang = lang ?? spokenLanguage ?? null;
          break;
        }
      } catch (e) {
        lastErr = e;
        const cls = classifyError(e);
        console.warn("[transcript-debug] youtube-transcript error", {
          lang: lang ?? "default",
          classified: cls,
          message: e instanceof Error ? e.message : String(e),
        });
        if (cls === "rate_limited") {
          blocked = true;
          break;
        }
      }
    }
    timings.youtube_caption_attempt_ms = Date.now() - tYt;
    if (blocked) {
      console.warn("[transcript-debug] youtube blocked — skipping remaining langs, going to fallback");
    }

    if (raw && raw.length) {
      const tBuild = Date.now();
      const sentences = buildSentencesFromChunks(raw);
      timings.sentence_build_ms = Date.now() - tBuild;
      const chars = sentences.reduce((n, s) => n + s.text.length, 0);
      console.log("[transcript-debug] youtube SUCCESS", {
        videoId,
        raw_chunks: raw.length,
        sentences: sentences.length,
        total_chars: chars,
        language: usedLang,
      });
      const tWrite = Date.now();
      const cacheWrite = await writeCache({
        videoId,
        videoUrl: data.url,
        chunks: raw,
        requestedLanguage,
        provider: "youtube",
        providerResponseLanguage: usedLang,
      });
      timings.cache_write_ms = Date.now() - tWrite;
      logEvent({
        video_id: videoId,
        fetch_source: "youtube",
        success: true,
        cache_hit: false,
      });
      const quality = assessQuality(raw, sentences);
      await recordTranscriptReport({
        videoId,
        videoUrl: data.url,
        source: "youtube",
        language: usedLang,
        quality,
      });
      if (!cacheWrite.ok) {
        console.warn("[transcript-debug] youtube result not cached", cacheWrite.validation);
      }
      timings.provider_used = "youtube";
      timings.cache_hit = false;
      timings.sentence_count = sentences.length;
      timings.total_server_ms = Date.now() - tStart;
      logTimings("slow:youtube", videoId, timings);
      return {
        videoId,
        sentences,
        source: "youtube",
        language: usedLang,
        spokenLanguage,
        transcriptLanguage: usedLang,
        cacheHit: false,
        quality,
        provenance: cacheWrite.provenance ?? null,
        rawChunks: raw,
        providerTrace: { transcribr: transcribrTrace, asr: asrTrace },
        stageTimings: timings,
      };
    }

    // -------- Layer 3: ASR provider (Transcribr default, OpenAI behind flag) --------
    const { getAsrProvider, transcribeWithOpenAi } = await import("@/lib/asr-openai.server");
    const asrProvider = data.forceProvider ?? getAsrProvider();
    console.log("[transcript-debug] ASR_PROVIDER =", asrProvider, data.forceProvider ? "(forced)" : "");

    let fb: { chunks: RawChunk[]; language: string | null } | null = null;
    let fbSource: "fallback" | "openai" = "fallback";
    const asrGeneric: GenericAsrTrace = {
      provider: null, model: null, httpStatus: null, errorBody: null,
      segmentsCount: null, durationMs: null, language: null, failureCode: null,
      extractor: null,
    };

    const runOpenAi = async () => {
      const expectedLang = spokenLanguage;
      const oa = await transcribeWithOpenAi({ videoId, expectedLanguage: expectedLang });
      asrGeneric.provider = "openai";
      asrGeneric.model = oa.trace.model;
      asrGeneric.httpStatus = oa.trace.httpStatus ?? oa.trace.audioExtractStatus;
      asrGeneric.errorBody = oa.trace.errorBody ?? oa.trace.audioExtractError;
      asrGeneric.segmentsCount = oa.trace.segmentsCount;
      asrGeneric.durationMs = oa.trace.durationMs;
      asrGeneric.language = oa.trace.language;
      asrGeneric.failureCode = oa.trace.failureCode;
      asrGeneric.extractor = {
        provider: oa.trace.rapidapi_host,
        httpStatus: oa.trace.rapidapi_http_status,
        responseStatus: oa.trace.rapidapi_response_status,
        responseBody: oa.trace.extractor_response_body,
        audioUrlFound: oa.trace.audio_url_found,
        audioUrl: oa.trace.extractor_audio_url,
        latencyMs: oa.trace.extractor_latency_ms,
        failureReason: oa.trace.extractor_failure_reason,
      };
      // Pull per-stage timings from the OpenAI trace
      timings.audio_extract_ms = oa.trace.extractor_latency_ms;
      timings.audio_download_ms = oa.trace.audio_download_ms;
      timings.openai_transcription_ms = oa.trace.openai_request_ms;
      timings.audio_size_mb = oa.trace.audio_size_mb;
      timings.openai_segments_count = oa.trace.segmentsCount;
      if (oa.result && oa.result.chunks.length) {
        fb = { chunks: oa.result.chunks, language: oa.result.language };
        fbSource = "openai";
      }
    };

    if (asrProvider === "openai") {
      await runOpenAi();
    } else {
      console.log("[transcript-debug] trying fallback provider (Transcribr)");
      fb = await fetchFromFallbackProvider({
        videoId,
        videoUrl: data.url,
        trace: transcribrTrace,
      });
      asrGeneric.provider = "transcribr";
      asrGeneric.model = "transcribr-v1";
      asrGeneric.httpStatus = transcribrTrace.httpStatus;
      asrGeneric.errorBody = transcribrTrace.errorMessage;
      asrGeneric.segmentsCount = transcribrTrace.rawSegments;
      asrGeneric.durationMs = transcribrTrace.durationMs;
      asrGeneric.language = fb?.language ?? null;
      asrGeneric.failureCode = transcribrTrace.errorMessage ? "transcribr_error" : null;

      // -------- Layer 4: OpenAI Whisper as final fallback --------
      if (!fb || !fb.chunks.length) {
        console.log("[transcript-debug] Transcribr empty — trying OpenAI Whisper fallback");
        await runOpenAi();
      }
    }


    console.log("[transcript-debug] ASR result", {
      provider: asrProvider,
      chunks: fb?.chunks.length ?? 0,
      language: fb?.language ?? null,
      failureCode: asrGeneric.failureCode,
    });

    if (fb && fb.chunks.length) {
      const tMap = Date.now();
      // Chunks already mapped by ASR provider — measure normalization cost only.
      const normalizedChunks = fb.chunks;
      timings.chunk_mapping_ms = Date.now() - tMap;
      const tBuild = Date.now();
      const sentences = buildSentencesFromChunks(normalizedChunks);
      timings.sentence_build_ms = Date.now() - tBuild;
      const chars = sentences.reduce((n, s) => n + s.text.length, 0);
      console.log("[transcript-debug] ASR SUCCESS", {
        videoId, provider: asrProvider, raw_chunks: fb.chunks.length,
        sentences: sentences.length, total_chars: chars,
      });
      const tWrite = Date.now();
      const cacheWrite = await writeCache({
        videoId,
        videoUrl: data.url,
        chunks: fb.chunks,
        requestedLanguage,
        provider: fbSource,
        providerResponseLanguage: fb.language,
      });
      timings.cache_write_ms = Date.now() - tWrite;
      logEvent({
        video_id: videoId,
        fetch_source: "fallback",
        success: true,
        cache_hit: false,
      });
      const quality = assessQuality(fb.chunks, sentences);
      await recordTranscriptReport({
        videoId,
        videoUrl: data.url,
        source: "fallback",
        language: fb.language,
        quality,
      });
      if (!cacheWrite.ok) {
        console.warn("[transcript-debug] ASR result not cached", cacheWrite.validation);
      }
      timings.provider_used = fbSource;
      timings.cache_hit = false;
      timings.sentence_count = sentences.length;
      timings.total_server_ms = Date.now() - tStart;
      logTimings("slow:asr", videoId, timings);
      return {
        videoId,
        sentences,
        source: "fallback",
        cachedFromProvider: fbSource,
        language: fb.language,
        spokenLanguage,
        transcriptLanguage: fb.language,
        cacheHit: false,
        quality,
        provenance: cacheWrite.provenance ?? null,
        rawChunks: fb.chunks,
        providerTrace: { transcribr: transcribrTrace, asr: asrTrace, asrGeneric },
        stageTimings: timings,
      };
    }

    // -------- Layer 4: Hallucination-prone LLM-ASR remains DISABLED --------
    asrTrace.invoked = false;
    asrTrace.errorMessage = "disabled: gateway file_uri to YouTube hallucinates";
    const providerTrace: ProviderTrace = { transcribr: transcribrTrace, asr: asrTrace, asrGeneric };


    // All layers failed — surface a single friendly message.
    // Prefer the ASR-specific error type so the benchmark can distinguish
    // A01/A03/A04 from a YouTube-only failure (C01).
    const errorType: TranscriptErrorType = classifyError(lastErr);


    console.error("[transcript-debug] ALL LAYERS FAILED", {
      videoId,
      errorType,
      asrProvider: asrGeneric.provider,
      asrFailureCode: asrGeneric.failureCode,
      lastErrorMessage: lastErr instanceof Error ? lastErr.message : String(lastErr ?? ""),
    });
    logEvent({
      video_id: videoId,
      fetch_source: "asr",
      success: false,
      cache_hit: false,
      error_type: errorType,
      error_message:
        asrGeneric.failureCode ?? (lastErr instanceof Error ? lastErr.message : String(lastErr ?? "")),
    });
    const err = new Error(FRIENDLY_TRANSCRIPT_ERROR) as Error & {
      errorType?: TranscriptErrorType;
      videoId?: string;
      providerMessage?: string;
      providerTrace?: ProviderTrace;
    };
    err.errorType = errorType;
    err.videoId = videoId;
    err.providerMessage =
      lastErr instanceof Error ? lastErr.message : String(lastErr ?? "");
    err.providerTrace = providerTrace;
    throw err;
  });

export const saveManualTranscript = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ManualInput.parse(d))
  .handler(async ({ data }): Promise<FetchTranscriptResult> => {
    const videoId = extractVideoId(data.url);
    if (!videoId) {
      throw new Error("This doesn't look like a YouTube link.");
    }
    const chunks = chunksFromManualText(data.text);
    if (!chunks.length) throw new Error("Transcript text is empty.");
    const sentences = buildSentencesFromChunks(chunks);
    await writeCache({
      videoId,
      videoUrl: data.url,
      chunks,
      requestedLanguage: "_any_",
      provider: "manual",
      providerResponseLanguage: null,
    });
    logEvent({ video_id: videoId, fetch_source: "manual", success: true });
    const quality = assessQuality(chunks, sentences);
    await recordTranscriptReport({
      videoId,
      videoUrl: data.url,
      source: "manual",
      language: null,
      quality,
    });
    return {
      videoId,
      sentences,
      source: "manual",
      language: null,
      cacheHit: false,
      quality,
    };
  });

const DemoInput = z.object({
  videoId: z.string().min(1).max(50),
  videoUrl: z.string().min(1).max(500),
  language: z.string().min(1).max(20).nullable().optional(),
  sentences: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]),
        startTime: z.number(),
        endTime: z.number(),
        text: z.string(),
        translation: z.string().optional().nullable(),
        meaning: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .min(1)
    .max(5000),
});

export const saveDemoTranscript = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DemoInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const chunks: RawChunk[] = data.sentences.map((s) => ({
      text: s.text,
      offset: s.startTime,
      duration: Math.max(0.5, s.endTime - s.startTime),
    }));
    const { error } = await supabaseAdmin
      .from("youtube_transcript_cache" as any)
      .upsert(
        {
          video_id: data.videoId,
          video_url: data.videoUrl,
          transcript_json: chunks,
          language: data.language ?? null,
          source: "manual",
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "video_id" }
      );
    if (error) throw new Error(error.message);
    logEvent({ video_id: data.videoId, fetch_source: "manual", success: true });
    return { ok: true, videoId: data.videoId, count: data.sentences.length };
  });

/* ------------------------------------------------------------------ */
/* Fast-path transcript fetch (cache + youtube only).                 */
/* The client calls this first to render sentences quickly. On a      */
/* "miss" it falls back to fetchTranscript (with skipCache=true +     */
/* skipYoutube=true) which only runs the slower ASR layers.           */
/* ------------------------------------------------------------------ */

export type FetchTranscriptFastResult =
  | { status: "ready"; result: FetchTranscriptResult }
  | { status: "miss"; videoId: string | null; reason: string; youtubeError: string | null };

export const fetchTranscriptFast = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<FetchTranscriptFastResult> => {
    const tStart = Date.now();
    const timings = makeEmptyTimings();
    const videoId = extractVideoId(data.url);
    if (!videoId) {
      return { status: "miss", videoId: null, reason: "invalid_url", youtubeError: null };
    }
    const spokenLanguageRaw =
      (data.spokenLanguage ?? data.requestedLanguage)?.trim() || "";
    const spokenLanguage = spokenLanguageRaw || null;
    const requestedLanguage = spokenLanguage ?? "_any_";

    // ---- Layer 1: cache ----
    if (!data.skipCache) {
      const tCache = Date.now();
      const cached = await readCache(videoId, requestedLanguage);
      timings.cache_lookup_ms = Date.now() - tCache;
      if (cached?.transcript_json?.length) {
        const tBuild = Date.now();
        const sentences = buildSentencesFromChunks(cached.transcript_json);
        timings.sentence_build_ms = Date.now() - tBuild;
        const provenance = rowToProvenance(cached);
        const quality = assessQuality(cached.transcript_json, sentences);
        timings.provider_used = provenance.provider;
        timings.cache_hit = true;
        timings.sentence_count = sentences.length;
        timings.total_server_ms = Date.now() - tStart;
        logTimings("fast:cache-hit", videoId, timings);
        return {
          status: "ready",
          result: {
            videoId,
            sentences,
            source: "cache",
            cachedFromProvider: provenance.provider,
            language: cached.language,
            spokenLanguage,
            transcriptLanguage: cached.language,
            cacheHit: true,
            quality,
            provenance,
            rawChunks: cached.transcript_json,
            stageTimings: timings,
          },
        };
      }
    }

    // ---- Layer 2: YouTube captions ----
    if (data.skipYoutube) {
      timings.total_server_ms = Date.now() - tStart;
      logTimings("fast:youtube-skipped", videoId, timings);
      return { status: "miss", videoId, reason: "youtube_skipped", youtubeError: null };
    }
    const langCandidates: (string | undefined)[] = spokenLanguage
      ? [
          spokenLanguage,
          spokenLanguage === "en" ? "en-US" : null,
          spokenLanguage === "en" ? "en-GB" : null,
          spokenLanguage === "nl" ? "nl-NL" : null,
          undefined,
        ].filter((v): v is string | undefined => v !== null)
      : [undefined];

    let raw: RawChunk[] | null = null;
    let usedLang: string | null = null;
    let lastErr: string | null = null;
    let blocked = false;
    const tYt = Date.now();
    for (const lang of langCandidates) {
      try {
        const r = await YoutubeTranscript.fetchTranscript(
          videoId,
          lang ? { lang } : undefined,
        );
        if (r && r.length) {
          const tMap = Date.now();
          raw = r.map((x) => ({
            text: x.text,
            offset: x.offset / 1000,
            duration: x.duration / 1000,
          }));
          timings.chunk_mapping_ms = Date.now() - tMap;
          usedLang = lang ?? spokenLanguage ?? null;
          break;
        }
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        if (classifyError(e) === "rate_limited") {
          blocked = true;
          break;
        }
      }
    }
    timings.youtube_caption_attempt_ms = Date.now() - tYt;

    if (raw && raw.length) {
      // Validate that the caption track YouTube returned is actually in the
      // language the caller asked for. Some videos expose auto-translated
      // tracks (e.g. an English video with Arabic auto-captions) and YouTube
      // may hand us those when the explicit lang fetch fails. If a spoken
      // language was requested but the returned text is clearly a different
      // language, treat as a miss so we fall through to ASR — which detects
      // the true spoken language from audio.
      const joinedText = raw.map((r) => r.text).join(" ");
      const detected = detectLanguage(joinedText);
      console.log("[lang-pipeline][server] youtube-captions", {
        videoId,
        requestedSpokenLanguage: spokenLanguage,
        youtubeReturnedLang: usedLang,
        detectedFromText: detected.language,
        detectionConfidence: detected.confidence,
      });
      if (
        spokenLanguage &&
        detected.language &&
        detected.confidence >= 0.4 &&
        !sameBaseLanguage(detected.language, spokenLanguage)
      ) {
        console.warn(
          "[lang-pipeline][server] youtube caption language mismatch — discarding",
          { videoId, requestedSpokenLanguage: spokenLanguage, detectedFromText: detected.language },
        );
        timings.total_server_ms = Date.now() - tStart;
        logTimings("fast:youtube-lang-mismatch", videoId, timings);
        return {
          status: "miss",
          videoId,
          reason: "youtube_lang_mismatch",
          youtubeError: `captions detected as ${detected.language}, expected ${spokenLanguage}`,
        };
      }
      const tBuild = Date.now();
      const sentences = buildSentencesFromChunks(raw);
      timings.sentence_build_ms = Date.now() - tBuild;
      const quality = assessQuality(raw, sentences);
      const tWrite = Date.now();
      const cacheWrite = await writeCache({
        videoId,
        videoUrl: data.url,
        chunks: raw,
        requestedLanguage,
        provider: "youtube",
        providerResponseLanguage: usedLang,
      });
      timings.cache_write_ms = Date.now() - tWrite;
      timings.provider_used = "youtube";
      timings.cache_hit = false;
      timings.sentence_count = sentences.length;
      timings.total_server_ms = Date.now() - tStart;
      logTimings("fast:youtube", videoId, timings);
      return {
        status: "ready",
        result: {
          videoId,
          sentences,
          source: "youtube",
          language: detected.language ?? usedLang,
          spokenLanguage,
          transcriptLanguage: detected.language ?? usedLang,
          cacheHit: false,
          quality,
          provenance: cacheWrite.provenance ?? null,
          rawChunks: raw,
          stageTimings: timings,
        },
      };
    }

    timings.total_server_ms = Date.now() - tStart;
    logTimings("fast:miss", videoId, timings);
    return {
      status: "miss",
      videoId,
      reason: blocked ? "youtube_blocked" : "no_captions",
      youtubeError: lastErr,
    };
  });

