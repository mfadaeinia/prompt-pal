import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { YoutubeTranscript } from "youtube-transcript";

const Input = z.object({ url: z.string().min(1).max(500) });
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

export type TranscriptSource = "cache" | "youtube" | "fallback" | "manual";

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

export type FetchTranscriptResult = {
  videoId: string;
  sentences: TranscriptSentence[];
  source: TranscriptSource;
  language?: string | null;
  cacheHit: boolean;
  quality: TranscriptQualityReport;
};

export type TranscriptErrorType =
  | "rate_limited"
  | "captions_disabled"
  | "not_found"
  | "network"
  | "unknown";

type RawChunk = { text: string; offset: number; duration: number };

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

  // Heuristic: punctuation is "sparse" if avg segment is huge OR any single
  // segment is huge OR we ended up with <1 segment per 40 words.
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
    // Almost no punctuation — segment purely from raw chunks + timing.
    final = segmentByChunksAndTiming(cleaned);
    strategy = "timing+chunks";
  } else {
    // Mixed: split any oversize punctuation segment further.
    final = [];
    let id = 0;
    for (const seg of punctSegments) {
      if (wordCount(seg.text) <= 25) {
        final.push({ ...seg, id: id++ });
        continue;
      }
      // Find chunks overlapping this segment's time range and re-segment them.
      const segEnd = seg.endTime || seg.offset + 5;
      const subChunks = cleaned.filter(
        (c) => c.offset + c.duration >= seg.offset && c.offset <= segEnd
      );
      const subSegs = subChunks.length
        ? segmentByChunksAndTiming(subChunks)
        : [seg];
      for (const s of subSegs) final.push({ ...s, id: id++ });
    }
    strategy = "hybrid";
  }

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

async function readCache(videoId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("youtube_transcript_cache" as any)
    .select("transcript_json, language")
    .eq("video_id", videoId)
    .maybeSingle();
  if (error) {
    console.warn("[transcript] cache read error", error.message);
    return null;
  }
  return data as { transcript_json: RawChunk[]; language: string | null } | null;
}

async function writeCache(params: {
  videoId: string;
  videoUrl: string;
  chunks: RawChunk[];
  language: string | null;
  source: "youtube" | "manual" | "fallback";
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("youtube_transcript_cache" as any)
    .upsert(
      {
        video_id: params.videoId,
        video_url: params.videoUrl,
        transcript_json: params.chunks,
        language: params.language,
        source: params.source,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "video_id" }
    );
  if (error) console.warn("[transcript] cache write error", error.message);
}

// ---------------------------------------------------------------------------
// Layer 3: Fallback transcript provider — Transcribr.io
// Docs: https://www.transcribr.io/youtube-transcript-api
// POST https://www.transcribr.io/api/v1/transcript
//   headers: X-API-Key: <TRANSCRIBR_API_KEY>
//   body:    { video_id }
//   resp:    { transcript: [{text, start, duration}], language, ... }
// ---------------------------------------------------------------------------
async function fetchFromFallbackProvider(params: {
  videoId: string;
  videoUrl: string;
}): Promise<{ chunks: RawChunk[]; language: string | null } | null> {
  const apiKey = process.env.TRANSCRIBR_API_KEY;
  if (!apiKey) {
    console.warn("[transcript-debug] TRANSCRIBR_API_KEY missing — skipping fallback");
    return null;
  }

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
    console.log("[transcript-debug] Transcribr HTTP", {
      status: res.status,
      ok: res.ok,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[transcript-debug] Transcribr error body", text.slice(0, 500));
      return null;
    }
    const json: any = await res.json();
    const transcript: any[] = Array.isArray(json?.transcript)
      ? json.transcript
      : [];
    console.log("[transcript-debug] Transcribr response", {
      transcript_items: transcript.length,
      language: json?.language ?? null,
      top_level_keys: json && typeof json === "object" ? Object.keys(json) : [],
    });
    if (!transcript.length) return null;
    const chunks: RawChunk[] = transcript
      .map((c) => ({
        text: String(c.text ?? ""),
        // Transcribr returns seconds already.
        offset: Number(c.start ?? 0),
        duration: Number(c.duration ?? 0),
      }))
      .filter((c) => c.text.length > 0);
    if (!chunks.length) return null;
    return { chunks, language: json?.language ?? null };
  } catch (e) {
    console.warn("[transcript-debug] Transcribr fetch threw", e instanceof Error ? e.message : String(e));
    return null;
  }
}


export const fetchTranscript = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<FetchTranscriptResult> => {
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
    const cached = await readCache(videoId);
    if (cached?.transcript_json?.length) {
      const sentences = buildSentencesFromChunks(cached.transcript_json);
      const chars = sentences.reduce((n, s) => n + s.text.length, 0);
      console.log("[transcript-debug] cache HIT", {
        videoId,
        raw_chunks: cached.transcript_json.length,
        sentences: sentences.length,
        total_chars: chars,
        language: cached.language,
      });
      logEvent({
        video_id: videoId,
        fetch_source: "cache",
        success: true,
        cache_hit: true,
      });
      return {
        videoId,
        sentences,
        source: "cache",
        language: cached.language,
        cacheHit: true,
        quality: assessQuality(cached.transcript_json, sentences),
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

    // -------- Layer 2: YouTube captions --------
    let raw: RawChunk[] | null = null;
    let usedLang: string | null = null;
    let lastErr: unknown = null;
    const langCandidates = ["nl", "nl-NL", "en", "en-US", "en-GB", undefined];
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
          raw = r.map((x) => ({
            text: x.text,
            offset: x.offset / 1000,
            duration: x.duration / 1000,
          }));
          usedLang = lang ?? null;
          break;
        }
      } catch (e) {
        lastErr = e;
        console.warn("[transcript-debug] youtube-transcript error", {
          lang: lang ?? "default",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (raw && raw.length) {
      const sentences = buildSentencesFromChunks(raw);
      const chars = sentences.reduce((n, s) => n + s.text.length, 0);
      console.log("[transcript-debug] youtube SUCCESS", {
        videoId,
        raw_chunks: raw.length,
        sentences: sentences.length,
        total_chars: chars,
        language: usedLang,
      });
      await writeCache({
        videoId,
        videoUrl: data.url,
        chunks: raw,
        language: usedLang,
        source: "youtube",
      });
      logEvent({
        video_id: videoId,
        fetch_source: "youtube",
        success: true,
        cache_hit: false,
      });
      return {
        videoId,
        sentences,
        source: "youtube",
        language: usedLang,
        cacheHit: false,
        quality: assessQuality(raw, sentences),
      };
    }

    // -------- Layer 3: Fallback provider --------
    console.log("[transcript-debug] trying fallback provider (Transcribr)");
    const fb = await fetchFromFallbackProvider({
      videoId,
      videoUrl: data.url,
    });
    console.log("[transcript-debug] fallback result", {
      chunks: fb?.chunks.length ?? 0,
      language: fb?.language ?? null,
    });
    if (fb && fb.chunks.length) {
      const sentences = buildSentencesFromChunks(fb.chunks);
      const chars = sentences.reduce((n, s) => n + s.text.length, 0);
      console.log("[transcript-debug] fallback SUCCESS", {
        videoId,
        raw_chunks: fb.chunks.length,
        sentences: sentences.length,
        total_chars: chars,
      });
      await writeCache({
        videoId,
        videoUrl: data.url,
        chunks: fb.chunks,
        language: fb.language,
        source: "fallback",
      });
      logEvent({
        video_id: videoId,
        fetch_source: "fallback",
        success: true,
        cache_hit: false,
      });
      return {
        videoId,
        sentences,
        source: "fallback",
        language: fb.language,
        cacheHit: false,
        quality: assessQuality(fb.chunks, sentences),
      };
    }


    // All layers failed — surface a single friendly message.
    const errorType = classifyError(lastErr);
    console.error("[transcript-debug] ALL LAYERS FAILED", {
      videoId,
      errorType,
      lastErrorMessage: lastErr instanceof Error ? lastErr.message : String(lastErr ?? ""),
    });
    logEvent({
      video_id: videoId,
      fetch_source: "fallback",
      success: false,
      cache_hit: false,
      error_type: errorType,
      error_message:
        lastErr instanceof Error ? lastErr.message : String(lastErr ?? ""),
    });
    const err = new Error(FRIENDLY_TRANSCRIPT_ERROR) as Error & {
      errorType?: TranscriptErrorType;
      videoId?: string;
      providerMessage?: string;
    };
    err.errorType = errorType;
    err.videoId = videoId;
    err.providerMessage =
      lastErr instanceof Error ? lastErr.message : String(lastErr ?? "");
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
      language: null,
      source: "manual",
    });
    logEvent({ video_id: videoId, fetch_source: "manual", success: true });
    return {
      videoId,
      sentences,
      source: "manual",
      language: null,
      cacheHit: false,
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
