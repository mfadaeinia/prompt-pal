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

export type TranscriptSource = "cache" | "youtube" | "manual";

export type FetchTranscriptResult = {
  videoId: string;
  sentences: TranscriptSentence[];
  source: TranscriptSource;
  language?: string | null;
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

function friendlyMessage(type: TranscriptErrorType): string {
  switch (type) {
    case "rate_limited":
      return "We could not retrieve subtitles automatically right now. This may happen because YouTube temporarily limits transcript requests. Try again later or paste a transcript manually.";
    case "captions_disabled":
      return "This video doesn't have subtitles available. Paste a transcript manually to continue.";
    case "not_found":
      return "No transcript was found for this video. Paste a transcript manually to continue.";
    case "network":
      return "Network problem while fetching the transcript. Try again, or paste a transcript manually.";
    default:
      return "Automatic subtitles could not be loaded. Paste a transcript manually to continue.";
  }
}

function logEvent(payload: {
  video_id: string | null;
  fetch_source: TranscriptSource | "none";
  success: boolean;
  error_type?: TranscriptErrorType | null;
  error_message?: string | null;
}) {
  try {
    console.log("[transcript]", JSON.stringify(payload));
  } catch {}
}

function buildSentencesFromChunks(chunks: RawChunk[]): TranscriptSentence[] {
  const cleaned = chunks.map((r) => ({
    text: r.text.replace(/\s+/g, " ").trim(),
    offset: r.offset,
    duration: r.duration,
  }));

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

  const decoded = joined
    .replace(/&amp;#39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

  const sentences: TranscriptSentence[] = [];
  const sentenceRegex = /[^.!?\n]+[.!?]+|[^.!?\n]+$/g;

  let id = 0;
  let match: RegExpExecArray | null;
  while ((match = sentenceRegex.exec(decoded)) !== null) {
    const text = match[0].trim();
    if (!text) continue;
    const startChar = match.index;
    const startTime = charTime[Math.min(startChar, charTime.length - 1)] ?? 0;
    sentences.push({
      id: id++,
      text,
      offset: startTime,
      duration: 0,
      endTime: 0,
    });
  }

  for (let i = 0; i < sentences.length; i++) {
    const cur = sentences[i];
    const next = sentences[i + 1];
    cur.endTime = next ? next.offset : cur.offset + 5;
  }

  return sentences;
}

function parseTimestamp(s: string): number | null {
  // Accept h:mm:ss, mm:ss, or seconds
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

  // Try to detect timestamped lines: `[0:15] text`, `0:15 text`, `00:00:15 text`
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
    // Fill missing timestamps by interpolation between known anchors
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

  // No timestamps: distribute uniformly assuming ~3s per chunk
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
  source: "youtube" | "manual";
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

export const fetchTranscript = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<FetchTranscriptResult> => {
    const videoId = extractVideoId(data.url);
    if (!videoId) {
      logEvent({
        video_id: null,
        fetch_source: "none",
        success: false,
        error_type: "unknown",
        error_message: "invalid_url",
      });
      throw new Error("Could not parse a YouTube video ID from that URL.");
    }

    // 1. Cache lookup
    const cached = await readCache(videoId);
    if (cached?.transcript_json?.length) {
      const sentences = buildSentencesFromChunks(cached.transcript_json);
      logEvent({ video_id: videoId, fetch_source: "cache", success: true });
      return { videoId, sentences, source: "cache", language: cached.language };
    }

    // 2. Fetch from YouTube
    let raw: RawChunk[] | null = null;
    let usedLang: string | null = null;
    let lastErr: unknown = null;
    const langCandidates = ["en", "nl", "en-US", "en-GB", undefined];
    for (const lang of langCandidates) {
      try {
        const r = await YoutubeTranscript.fetchTranscript(
          videoId,
          lang ? { lang } : undefined
        );
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
      }
    }

    if (!raw || !raw.length) {
      const errorType = classifyError(lastErr);
      logEvent({
        video_id: videoId,
        fetch_source: "youtube",
        success: false,
        error_type: errorType,
        error_message: lastErr instanceof Error ? lastErr.message : String(lastErr ?? ""),
      });
      const err = new Error(friendlyMessage(errorType)) as Error & {
        errorType?: TranscriptErrorType;
        videoId?: string;
      };
      err.errorType = errorType;
      err.videoId = videoId;
      throw err;
    }

    const sentences = buildSentencesFromChunks(raw);
    await writeCache({
      videoId,
      videoUrl: data.url,
      chunks: raw,
      language: usedLang,
      source: "youtube",
    });
    logEvent({ video_id: videoId, fetch_source: "youtube", success: true });
    return { videoId, sentences, source: "youtube", language: usedLang };
  });

export const saveManualTranscript = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ManualInput.parse(d))
  .handler(async ({ data }): Promise<FetchTranscriptResult> => {
    const videoId = extractVideoId(data.url);
    if (!videoId) {
      throw new Error("Could not parse a YouTube video ID from that URL.");
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
    return { videoId, sentences, source: "manual", language: null };
  });
