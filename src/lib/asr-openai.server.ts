/**
 * OpenAI Whisper ASR — experimental, behind ASR_PROVIDER=openai flag.
 *
 * Pipeline:
 *   1. Audio extraction via RapidAPI (youtube-mp36 by default).
 *      Requires RAPIDAPI_KEY. Returns a temporary mp3 URL.
 *   2. Download audio bytes — reject if > 25 MB (OpenAI limit).
 *   3. POST multipart to https://api.openai.com/v1/audio/transcriptions
 *      with model=whisper-1, response_format=verbose_json.
 *   4. Map segments → RawChunk[].
 *
 * Failure cases are surfaced via the returned trace so callers can persist
 * generic asr_* diagnostics. We never throw raw provider errors at the user.
 */

export type OpenAiAsrTrace = {
  provider: "openai";
  model: string;
  invoked: boolean;
  httpStatus: number | null;
  errorBody: string | null;
  errorMessage: string | null;
  segmentsCount: number;
  durationMs: number | null;
  language: string | null;
  audioBytes: number | null;
  audioExtractStatus: number | null;
  audioExtractError: string | null;
  failureCode:
    | null
    | "audio_extract_no_key"
    | "audio_extract_http"
    | "audio_extract_empty"
    | "audio_too_large"
    | "audio_download_failed"
    | "openai_unauthorized"
    | "openai_insufficient_credits"
    | "openai_rate_limit"
    | "openai_provider_error"
    | "openai_empty_transcript"
    | "openai_wrong_language"
    | "openai_invalid_response"
    | "asr_timeout"
    | "unknown";
};

export type OpenAiAsrResult = {
  chunks: Array<{ text: string; offset: number; duration: number }>;
  language: string | null;
  model: string;
};

const OPENAI_AUDIO_LIMIT_BYTES = 25 * 1024 * 1024; // 25 MB
const DEFAULT_MODEL = "whisper-1";
const TOTAL_TIMEOUT_MS = 90_000;

function makeTrace(): OpenAiAsrTrace {
  return {
    provider: "openai",
    model: DEFAULT_MODEL,
    invoked: false,
    httpStatus: null,
    errorBody: null,
    errorMessage: null,
    segmentsCount: 0,
    durationMs: null,
    language: null,
    audioBytes: null,
    audioExtractStatus: null,
    audioExtractError: null,
    failureCode: null,
  };
}

/** Fetch a temporary audio URL for a YouTube video via RapidAPI youtube-mp36. */
async function extractAudioUrl(
  videoId: string,
  trace: OpenAiAsrTrace,
): Promise<string | null> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    trace.failureCode = "audio_extract_no_key";
    trace.audioExtractError = "RAPIDAPI_KEY not set";
    return null;
  }
  const host = process.env.RAPIDAPI_AUDIO_HOST || "youtube-mp36.p.rapidapi.com";
  const url = `https://${host}/dl?id=${encodeURIComponent(videoId)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": host },
    });
    trace.audioExtractStatus = res.status;
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      trace.failureCode = "audio_extract_http";
      trace.audioExtractError = text.slice(0, 300) || `HTTP ${res.status}`;
      return null;
    }
    let json: any = null;
    try { json = JSON.parse(text); } catch {
      trace.failureCode = "audio_extract_empty";
      trace.audioExtractError = "non-json audio service response";
      return null;
    }
    const link = json?.link || json?.url || null;
    const status = String(json?.status ?? "").toLowerCase();
    if (!link || status === "processing" || status === "fail") {
      trace.failureCode = "audio_extract_empty";
      trace.audioExtractError = `status=${status || "no-link"}`;
      return null;
    }
    return String(link);
  } catch (e) {
    trace.failureCode = "audio_extract_http";
    trace.audioExtractError = e instanceof Error ? e.message : String(e);
    return null;
  }
}

async function downloadAudio(
  audioUrl: string,
  trace: OpenAiAsrTrace,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const res = await fetch(audioUrl);
    if (!res.ok) {
      trace.failureCode = "audio_download_failed";
      trace.audioExtractError = `audio download HTTP ${res.status}`;
      return null;
    }
    const len = Number(res.headers.get("content-length") || "0");
    if (len && len > OPENAI_AUDIO_LIMIT_BYTES) {
      trace.failureCode = "audio_too_large";
      trace.audioBytes = len;
      trace.audioExtractError = `audio ${(len / 1024 / 1024).toFixed(1)} MB exceeds 25 MB`;
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    trace.audioBytes = buf.byteLength;
    if (buf.byteLength > OPENAI_AUDIO_LIMIT_BYTES) {
      trace.failureCode = "audio_too_large";
      trace.audioExtractError = `audio ${(buf.byteLength / 1024 / 1024).toFixed(1)} MB exceeds 25 MB`;
      return null;
    }
    return { bytes: buf, contentType: res.headers.get("content-type") || "audio/mpeg" };
  } catch (e) {
    trace.failureCode = "audio_download_failed";
    trace.audioExtractError = e instanceof Error ? e.message : String(e);
    return null;
  }
}

function classifyOpenAiStatus(status: number): OpenAiAsrTrace["failureCode"] {
  if (status === 401) return "openai_unauthorized";
  if (status === 402) return "openai_insufficient_credits";
  if (status === 429) return "openai_rate_limit";
  if (status >= 500) return "openai_provider_error";
  return "openai_provider_error";
}

/**
 * Run the full OpenAI ASR pipeline for one YouTube video.
 * Returns null on any failure — inspect `trace.failureCode` for the reason.
 */
export async function transcribeWithOpenAi(params: {
  videoId: string;
  expectedLanguage?: string | null;
}): Promise<{ result: OpenAiAsrResult | null; trace: OpenAiAsrTrace }> {
  const trace = makeTrace();
  trace.invoked = true;
  const tStart = Date.now();

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    trace.failureCode = "openai_unauthorized";
    trace.errorMessage = "OPENAI_API_KEY not set";
    trace.durationMs = Date.now() - tStart;
    return { result: null, trace };
  }

  // Overall timeout guard.
  const deadline = tStart + TOTAL_TIMEOUT_MS;
  const remainingMs = () => Math.max(0, deadline - Date.now());

  // 1. Audio URL
  const audioUrl = await extractAudioUrl(params.videoId, trace);
  if (!audioUrl) {
    trace.durationMs = Date.now() - tStart;
    return { result: null, trace };
  }
  if (remainingMs() <= 0) {
    trace.failureCode = "asr_timeout";
    trace.durationMs = Date.now() - tStart;
    return { result: null, trace };
  }

  // 2. Download bytes
  const audio = await downloadAudio(audioUrl, trace);
  if (!audio) {
    trace.durationMs = Date.now() - tStart;
    return { result: null, trace };
  }
  if (remainingMs() <= 0) {
    trace.failureCode = "asr_timeout";
    trace.durationMs = Date.now() - tStart;
    return { result: null, trace };
  }

  // 3. OpenAI transcription
  try {
    const form = new FormData();
    const audioBuffer = audio.bytes.buffer.slice(
      audio.bytes.byteOffset,
      audio.bytes.byteOffset + audio.bytes.byteLength,
    ) as ArrayBuffer;
    form.append("file", new Blob([audioBuffer], { type: audio.contentType }), "audio.mp3");
    form.append("model", DEFAULT_MODEL);
    form.append("response_format", "verbose_json");
    if (params.expectedLanguage && params.expectedLanguage !== "_any_") {
      // OpenAI expects ISO-639-1 base (e.g. "nl", "en").
      const base = params.expectedLanguage.toLowerCase().split(/[-_]/)[0];
      form.append("language", base);
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), remainingMs());
    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    trace.httpStatus = res.status;
    const bodyText = await res.text().catch(() => "");
    if (!res.ok) {
      trace.failureCode = classifyOpenAiStatus(res.status);
      trace.errorBody = bodyText.slice(0, 500);
      trace.errorMessage = `OpenAI HTTP ${res.status}`;
      trace.durationMs = Date.now() - tStart;
      return { result: null, trace };
    }
    let json: any = null;
    try { json = JSON.parse(bodyText); } catch {
      trace.failureCode = "openai_invalid_response";
      trace.errorBody = bodyText.slice(0, 500);
      trace.errorMessage = "OpenAI returned non-JSON";
      trace.durationMs = Date.now() - tStart;
      return { result: null, trace };
    }
    const segments: any[] = Array.isArray(json?.segments) ? json.segments : [];
    trace.segmentsCount = segments.length;
    trace.language = typeof json?.language === "string" ? json.language : null;

    if (!segments.length) {
      trace.failureCode = "openai_empty_transcript";
      trace.errorMessage = "OpenAI returned 0 segments";
      trace.durationMs = Date.now() - tStart;
      return { result: null, trace };
    }
    if (params.expectedLanguage && params.expectedLanguage !== "_any_" && trace.language) {
      const expected = params.expectedLanguage.toLowerCase().split(/[-_]/)[0];
      const got = trace.language.toLowerCase().split(/[-_]/)[0];
      if (expected !== got) {
        trace.failureCode = "openai_wrong_language";
        trace.errorMessage = `language mismatch expected=${expected} got=${got}`;
        trace.durationMs = Date.now() - tStart;
        return { result: null, trace };
      }
    }

    const chunks = segments
      .map((s) => ({
        text: String(s?.text ?? "").trim(),
        offset: Number(s?.start ?? 0),
        duration: Math.max(0, Number(s?.end ?? 0) - Number(s?.start ?? 0)),
      }))
      .filter((c) => c.text.length > 0);

    if (!chunks.length) {
      trace.failureCode = "openai_empty_transcript";
      trace.errorMessage = "All segments blank after filter";
      trace.durationMs = Date.now() - tStart;
      return { result: null, trace };
    }

    trace.durationMs = Date.now() - tStart;
    return {
      result: { chunks, language: trace.language, model: DEFAULT_MODEL },
      trace,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/abort/i.test(msg)) trace.failureCode = "asr_timeout";
    else trace.failureCode = trace.failureCode ?? "unknown";
    trace.errorMessage = msg;
    trace.durationMs = Date.now() - tStart;
    return { result: null, trace };
  }
}

export function getAsrProvider(): "transcribr" | "openai" {
  const v = (process.env.ASR_PROVIDER || "transcribr").toLowerCase();
  return v === "openai" ? "openai" : "transcribr";
}
