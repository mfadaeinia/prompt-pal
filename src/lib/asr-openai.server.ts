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
  /** True the instant the OpenAI transcription request is dispatched.
   *  Never derived from httpStatus (which stays null on abort/network error). */
  openaiInvoked: boolean;
  /** Last pipeline stage entered — survives timeouts so we know where we stopped. */
  stage:
    | "start"
    | "extract"
    | "download"
    | "openai_request"
    | "parse"
    | "done";
  /** Per-stage budgets actually applied (ms). */
  budgets: { extractMs: number; downloadMs: number; openaiMs: number; totalMs: number };
  httpStatus: number | null;
  errorBody: string | null;
  errorMessage: string | null;
  segmentsCount: number;
  durationMs: number | null;
  language: string | null;
  audioBytes: number | null;
  audioExtractStatus: number | null;
  audioExtractError: string | null;
  // RapidAPI step diagnostics
  rapidapi_host: string | null;
  rapidapi_endpoint: string | null;
  rapidapi_http_status: number | null;
  rapidapi_response_status: string | null;
  rapidapi_poll_attempts: number;
  rapidapi_poll_total_ms: number;
  audio_url_found: boolean;
  audio_url_field_used: "link" | "url" | null;
  audio_download_status: number | null;
  audio_size_mb: number | null;

  // --- New: rich extractor diagnostics ---
  /** Total time spent on audio extraction (poll loop), ms. */
  extractor_latency_ms: number | null;
  /** Raw response body from the extractor (last poll), truncated. */
  extractor_response_body: string | null;
  /** Resolved temporary audio URL when extraction succeeded. */
  extractor_audio_url: string | null;
  /** Classified extractor failure reason (provider-agnostic). */
  extractor_failure_reason:
    | null
    | "video_unavailable"
    | "age_restricted"
    | "geo_restricted"
    | "live_stream"
    | "private_video"
    | "extraction_failed"
    | "provider_rate_limit"
    | "provider_timeout"
    | "provider_no_key"
    | "provider_unknown";

  /** Stage timings (ms) for the OpenAI ASR path. */
  audio_download_ms: number | null;
  openai_request_ms: number | null;


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
    | "openai_not_reached_budget_exhausted"
    | "unknown";
};



export type OpenAiAsrResult = {
  chunks: Array<{ text: string; offset: number; duration: number }>;
  language: string | null;
  model: string;
};

const OPENAI_AUDIO_LIMIT_BYTES = 25 * 1024 * 1024; // 25 MB
const DEFAULT_MODEL = "whisper-1";
const TOTAL_TIMEOUT_MS = 180_000;
/** Per-stage budgets. Previously a single 90s budget wrapped the whole pipeline,
 *  so slow RapidAPI polling alone could exhaust it and surface as `asr_timeout`
 *  before the OpenAI request was ever dispatched. */
const EXTRACT_BUDGET_MS = 50_000;
const DOWNLOAD_BUDGET_MS = 45_000;
const OPENAI_BUDGET_MS = 90_000;
/** Below this remaining OpenAI budget the request is pointless — report it
 *  explicitly instead of dispatching a request that aborts instantly. */
const OPENAI_MIN_BUDGET_MS = 5_000;

function stageLog(videoId: string, event: string, fields: Record<string, unknown> = {}) {
  console.log(`[asr-openai] ${event}`, JSON.stringify({ videoId, ...fields }));
}

const RAPIDAPI_HOST_DEFAULT = "youtube-mp36.p.rapidapi.com";
const RAPIDAPI_PATH = "/dl?id=";

function makeTrace(): OpenAiAsrTrace {
  return {
    provider: "openai",
    model: DEFAULT_MODEL,
    invoked: false,
    openaiInvoked: false,
    stage: "start",
    budgets: {
      extractMs: EXTRACT_BUDGET_MS,
      downloadMs: DOWNLOAD_BUDGET_MS,
      openaiMs: OPENAI_BUDGET_MS,
      totalMs: TOTAL_TIMEOUT_MS,
    },
    httpStatus: null,
    errorBody: null,
    errorMessage: null,
    segmentsCount: 0,
    durationMs: null,
    language: null,
    audioBytes: null,
    audioExtractStatus: null,
    audioExtractError: null,
    rapidapi_host: null,
    rapidapi_endpoint: null,
    rapidapi_http_status: null,
    rapidapi_response_status: null,
    rapidapi_poll_attempts: 0,
    rapidapi_poll_total_ms: 0,
    audio_url_found: false,

    audio_url_field_used: null,
    audio_download_status: null,
    audio_size_mb: null,
    extractor_latency_ms: null,
    extractor_response_body: null,
    extractor_audio_url: null,
    extractor_failure_reason: null,
    audio_download_ms: null,
    openai_request_ms: null,
    failureCode: null,
  };
}

/** Classify an extractor failure based on HTTP status, response status, and any
 *  human-readable message from the provider. Provider-agnostic — works for
 *  youtube-mp36 today and any future extractor with similar semantics. */
export function classifyExtractorFailure(args: {
  httpStatus: number | null;
  responseStatus: string | null;
  message: string | null;
  failureCode: OpenAiAsrTrace["failureCode"];
}): OpenAiAsrTrace["extractor_failure_reason"] {
  const { httpStatus, responseStatus, failureCode } = args;
  if (failureCode === "audio_extract_no_key") return "provider_no_key";
  if (failureCode === "audio_download_failed") return "extraction_failed";
  if (failureCode === "asr_timeout") return "provider_timeout";
  const msg = (args.message ?? "").toLowerCase();
  if (httpStatus === 429) return "provider_rate_limit";
  if (httpStatus && httpStatus >= 500) return "extraction_failed";
  if (/age[- ]?restrict/.test(msg)) return "age_restricted";
  if (/private/.test(msg)) return "private_video";
  if (/\b(geo|country|region|not available in)\b/.test(msg)) return "geo_restricted";
  if (/\blive\b|livestream|live stream|ongoing/.test(msg)) return "live_stream";
  if (/unavailable|removed|deleted|not available|does not exist|404/.test(msg))
    return "video_unavailable";
  if (responseStatus === "fail") return "extraction_failed";
  if (failureCode === "audio_extract_empty") return "provider_timeout";
  if (failureCode === "audio_extract_http") return "extraction_failed";
  if (failureCode) return "provider_unknown";
  return null;
}


/**
 * Fetch a temporary audio URL for a YouTube video via RapidAPI youtube-mp36.
 * youtube-mp36 is asynchronous: the first call often returns `status: "processing"`
 * while the MP3 is being generated. We poll the same endpoint until the job
 * resolves to a downloadable link, fails, or we exhaust the polling budget.
 */
const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_MS = EXTRACT_BUDGET_MS;

async function extractAudioUrl(
  videoId: string,
  trace: OpenAiAsrTrace,
): Promise<string | null> {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_AUDIO_HOST || RAPIDAPI_HOST_DEFAULT;
  const endpoint = `https://${host}${RAPIDAPI_PATH}${encodeURIComponent(videoId)}`;
  trace.rapidapi_host = host;
  trace.rapidapi_endpoint = endpoint;

  if (!key) {
    trace.failureCode = "audio_extract_no_key";
    trace.audioExtractError = "RAPIDAPI_KEY not set";
    trace.extractor_latency_ms = 0;
    return null;
  }

  const pollStart = Date.now();
  let lastJsonError: string | null = null;
  let lastBody: string | null = null;
  let lastProviderMsg: string | null = null;

  while (true) {
    trace.rapidapi_poll_attempts += 1;
    try {
      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host": host,
          "x-rapidapi-key": key,
        },
      });
      trace.audioExtractStatus = res.status;
      trace.rapidapi_http_status = res.status;
      const text = await res.text().catch(() => "");
      lastBody = text;
      trace.extractor_response_body = text.slice(0, 1000);
      if (!res.ok) {
        trace.failureCode = "audio_extract_http";
        trace.audioExtractError = text.slice(0, 300) || `HTTP ${res.status}`;
        trace.rapidapi_poll_total_ms = Date.now() - pollStart;
        trace.extractor_latency_ms = trace.rapidapi_poll_total_ms;
        return null;
      }
      let json: any = null;
      try { json = JSON.parse(text); } catch {
        lastJsonError = "non-json audio service response";
        json = null;
      }
      const status = String(json?.status ?? "").toLowerCase();
      trace.rapidapi_response_status = status || null;
      if (json?.msg) lastProviderMsg = String(json.msg);

      let link: string | null = null;
      let field: "link" | "url" | null = null;
      if (json?.link) { link = String(json.link); field = "link"; }
      else if (json?.url) { link = String(json.url); field = "url"; }

      // Success: a usable link is present (some providers return ok|completed; trust the link).
      if (link && status !== "processing" && status !== "fail") {
        trace.audio_url_found = true;
        trace.audio_url_field_used = field;
        trace.extractor_audio_url = link;
        trace.rapidapi_poll_total_ms = Date.now() - pollStart;
        trace.extractor_latency_ms = trace.rapidapi_poll_total_ms;
        return link;
      }

      // Hard failure from provider — stop polling.
      if (status === "fail") {
        trace.failureCode = "audio_extract_empty";
        trace.audioExtractError = `status=fail${json?.msg ? `: ${json.msg}` : ""}`;
        trace.rapidapi_poll_total_ms = Date.now() - pollStart;
        trace.extractor_latency_ms = trace.rapidapi_poll_total_ms;
        return null;
      }

      // Still processing (or no link yet) — keep polling until budget exhausted.
      const elapsed = Date.now() - pollStart;
      if (elapsed + POLL_INTERVAL_MS >= POLL_MAX_MS) {
        trace.failureCode = "audio_extract_empty";
        trace.audioExtractError =
          lastJsonError ?? `status=${status || "no-link"} after ${trace.rapidapi_poll_attempts} polls`;
        trace.rapidapi_poll_total_ms = Date.now() - pollStart;
        trace.extractor_latency_ms = trace.rapidapi_poll_total_ms;
        return null;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    } catch (e) {
      trace.failureCode = "audio_extract_http";
      trace.audioExtractError = e instanceof Error ? e.message : String(e);
      trace.rapidapi_poll_total_ms = Date.now() - pollStart;
      trace.extractor_latency_ms = trace.rapidapi_poll_total_ms;
      if (lastBody && !trace.extractor_response_body) {
        trace.extractor_response_body = lastBody.slice(0, 1000);
      }
      return null;
    }
  }
  // unreachable
  void lastProviderMsg;
}





async function downloadAudio(
  audioUrl: string,
  trace: OpenAiAsrTrace,
  budgetMs: number = DOWNLOAD_BUDGET_MS,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const tDl = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1_000, budgetMs));
  try {
    const res = await fetch(audioUrl, { signal: ctrl.signal });
    trace.audio_download_status = res.status;
    if (!res.ok) {
      trace.failureCode = "audio_download_failed";
      trace.audioExtractError = `audio download HTTP ${res.status}`;
      trace.audio_download_ms = Date.now() - tDl;
      return null;
    }
    const len = Number(res.headers.get("content-length") || "0");
    if (len && len > OPENAI_AUDIO_LIMIT_BYTES) {
      trace.failureCode = "audio_too_large";
      trace.audioBytes = len;
      trace.audio_size_mb = +(len / 1024 / 1024).toFixed(2);
      trace.audioExtractError = `audio ${trace.audio_size_mb} MB exceeds 25 MB`;
      trace.audio_download_ms = Date.now() - tDl;
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    trace.audioBytes = buf.byteLength;
    trace.audio_size_mb = +(buf.byteLength / 1024 / 1024).toFixed(2);
    trace.audio_download_ms = Date.now() - tDl;
    if (buf.byteLength > OPENAI_AUDIO_LIMIT_BYTES) {
      trace.failureCode = "audio_too_large";
      trace.audioExtractError = `audio ${trace.audio_size_mb} MB exceeds 25 MB`;
      return null;
    }
    return { bytes: buf, contentType: res.headers.get("content-type") || "audio/mpeg" };
  } catch (e) {
    trace.failureCode = "audio_download_failed";
    trace.audioExtractError = e instanceof Error ? e.message : String(e);
    trace.audio_download_ms = Date.now() - tDl;
    return null;
  } finally {
    clearTimeout(timer);
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

  // Overall guard. Each stage additionally gets its own budget so a slow
  // earlier stage can no longer masquerade as an OpenAI timeout.
  const deadline = tStart + TOTAL_TIMEOUT_MS;
  const remainingMs = () => Math.max(0, deadline - Date.now());
  stageLog(params.videoId, "fallback_started", { budgets: trace.budgets });

  // 1. Audio URL
  trace.stage = "extract";
  stageLog(params.videoId, "audio_extraction_started");
  const audioUrl = await extractAudioUrl(params.videoId, trace);
  stageLog(params.videoId, "audio_extraction_completed", {
    ms: trace.extractor_latency_ms,
    found: trace.audio_url_found,
    polls: trace.rapidapi_poll_attempts,
    failureCode: trace.failureCode,
  });
  if (!audioUrl) {
    trace.extractor_failure_reason = classifyExtractorFailure({
      httpStatus: trace.rapidapi_http_status,
      responseStatus: trace.rapidapi_response_status,
      message: trace.audioExtractError,
      failureCode: trace.failureCode,
    });
    trace.durationMs = Date.now() - tStart;
    return { result: null, trace };
  }

  // 2. Download bytes
  trace.stage = "download";
  stageLog(params.videoId, "audio_download_started", { url: audioUrl.slice(0, 120) });
  const audio = await downloadAudio(audioUrl, trace, Math.min(DOWNLOAD_BUDGET_MS, remainingMs()));
  stageLog(params.videoId, "audio_download_completed", {
    ms: trace.audio_download_ms,
    sizeMb: trace.audio_size_mb,
    httpStatus: trace.audio_download_status,
    mime: audio?.contentType ?? null,
    filename: "audio.mp3",
    failureCode: trace.failureCode,
  });
  if (!audio) {
    trace.durationMs = Date.now() - tStart;
    return { result: null, trace };
  }

  // 3. OpenAI transcription
  const openaiBudget = Math.min(OPENAI_BUDGET_MS, remainingMs());
  if (openaiBudget < OPENAI_MIN_BUDGET_MS) {
    // Explicit, non-misleading: we never dispatched the request.
    trace.stage = "openai_request";
    trace.failureCode = "openai_not_reached_budget_exhausted";
    trace.errorMessage = `only ${openaiBudget}ms left after extract(${trace.extractor_latency_ms}ms) + download(${trace.audio_download_ms}ms)`;
    trace.durationMs = Date.now() - tStart;
    stageLog(params.videoId, "openai_request_skipped", { reason: trace.errorMessage });
    return { result: null, trace };
  }

  try {
    const form = new FormData();
    const audioBuffer = audio.bytes.buffer.slice(
      audio.bytes.byteOffset,
      audio.bytes.byteOffset + audio.bytes.byteLength,
    ) as ArrayBuffer;
    form.append("file", new Blob([audioBuffer], { type: audio.contentType }), "audio.mp3");
    form.append("model", DEFAULT_MODEL);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    form.append("timestamp_granularities[]", "segment");
    if (params.expectedLanguage && params.expectedLanguage !== "_any_") {
      // OpenAI expects ISO-639-1 base (e.g. "nl", "en").
      const base = params.expectedLanguage.toLowerCase().split(/[-_]/)[0];
      form.append("language", base);
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), openaiBudget);
    // Set BEFORE the request leaves — this flag must never be inferred from
    // httpStatus, which stays null whenever the request aborts or throws.
    trace.stage = "openai_request";
    trace.openaiInvoked = true;
    stageLog(params.videoId, "openai_request_started", {
      model: DEFAULT_MODEL,
      timeoutMs: openaiBudget,
      sizeMb: trace.audio_size_mb,
      mime: audio.contentType,
    });
    let res: Response;
    const tOa = Date.now();
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
    trace.openai_request_ms = Date.now() - tOa;
    trace.httpStatus = res.status;
    trace.stage = "parse";
    stageLog(params.videoId, "openai_request_completed", {
      ms: trace.openai_request_ms,
      httpStatus: res.status,
    });
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
    const words: any[] = Array.isArray(json?.words) ? json.words : [];
    trace.segmentsCount = segments.length;
    trace.language = typeof json?.language === "string" ? json.language : null;

    if (!segments.length && !words.length) {
      trace.failureCode = "openai_empty_transcript";
      trace.errorMessage = "OpenAI returned 0 segments";
      trace.durationMs = Date.now() - tStart;
      return { result: null, trace };
    }
    if (params.expectedLanguage && params.expectedLanguage !== "_any_" && trace.language) {
      const expected = params.expectedLanguage.toLowerCase().split(/[-_]/)[0];
      // OpenAI returns full names ("dutch", "english"); normalize to ISO-639-1.
      const LANG_NAME_TO_ISO: Record<string, string> = {
        dutch: "nl", english: "en", german: "de", french: "fr", spanish: "es",
        italian: "it", portuguese: "pt", polish: "pl", russian: "ru",
        japanese: "ja", chinese: "zh", korean: "ko", turkish: "tr",
        arabic: "ar", swedish: "sv", danish: "da", norwegian: "no", finnish: "fi",
      };
      const raw = trace.language.toLowerCase().split(/[-_]/)[0];
      const got = LANG_NAME_TO_ISO[raw] ?? raw;
      if (expected !== got) {
        trace.failureCode = "openai_wrong_language";
        trace.errorMessage = `language mismatch expected=${expected} got=${got}`;
        trace.durationMs = Date.now() - tStart;
        return { result: null, trace };
      }
    }

    const sourceItems = words.length ? words : segments;
    const chunks = sourceItems
      .map((s) => ({
        text: String(s?.word ?? s?.text ?? "").trim(),
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
    trace.stage = "done";
    stageLog(params.videoId, "fallback_completed", {
      totalMs: trace.durationMs,
      chunks: chunks.length,
      language: trace.language,
    });
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
    stageLog(params.videoId, "fallback_failed", {
      stage: trace.stage,
      openaiInvoked: trace.openaiInvoked,
      failureCode: trace.failureCode,
      totalMs: trace.durationMs,
      message: msg,
    });
    return { result: null, trace };
  }
}


