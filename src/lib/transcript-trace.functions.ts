/**
 * Single-video transcript pipeline trace.
 *
 * Runs every layer of the production pipeline in read-only mode (no cache
 * writes, no benchmark_video_results rows). Returns a structured trace so
 * the founder can see exactly where a video succeeds or fails.
 *
 * Mirrors the live order in fetchTranscript:
 *   1. Validate YouTube video (oEmbed)
 *   2. Cache lookup (youtube_transcript_cache)
 *   3. YouTube captions (youtube-transcript lib, per-lang loop)
 *   4. OpenAI Whisper (audio extraction + transcription)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { YoutubeTranscript } from "youtube-transcript";
import { extractVideoId } from "@/lib/youtube-id";

const Input = z.object({
  url: z.string().min(1).max(500),
  expectedLanguage: z.string().max(20).optional(),
});

export type StepStatus = "ok" | "fail" | "skipped";

export type PipelineTrace = {
  input: {
    rawUrl: string;
    expectedLanguage: string | null;
    videoId: string | null;
    videoUrl: string;
  };
  step1_validate: {
    attempted: boolean;
    status: StepStatus;
    httpStatus: number | null;
    title: string | null;
    author: string | null;
    errorMessage: string | null;
  };
  step2_cache: {
    attempted: boolean;
    status: StepStatus;
    hit: boolean;
    rowsForVideo: number;
    cacheRowId: string | null;
    cacheKey: string | null;
    provider: string | null;
    language: string | null;
    requestedLanguage: string | null;
    providerResponseLanguage: string | null;
    /** Was this row accepted only because the lookup was "_any_"? */
    acceptedViaAnyShortcut: boolean;
    /** Language detected from transcript text (first ~800 chars). */
    textDetectedLanguage: string | null;
    textDetectionConfidence: number | null;
    /** True when stored language disagrees with text-detected language. */
    languageMismatchDetected: boolean;
    /** Language we will hand to the explanation pipeline. */
    finalLanguageUsed: string | null;
    validationStatus: string | null;
    transcriptLengthChars: number | null;
    updatedAt: string | null;
    missReason: string | null;
    /** Pipeline version the live fetcher requires for a cache hit. */
    pipelineVersion: number | null;
    rowsAtCurrentVersion: number;
    staleVersions: number[];
    /** Why the live pipeline discarded each candidate row. */
    rejections: Array<{
      cacheRowId: string;
      reason: string;
      sourceVersion: number | null;
      language: string | null;
      requestedLanguage: string | null;
      providerResponseLanguage: string | null;
      provider: string | null;
    }>;
  };
  step3_youtube: {
    attempted: boolean;
    status: StepStatus;
    languageUsed: string | null;
    chunkCount: number;
    transcriptChars: number;
    attempts: Array<{ lang: string; ok: boolean; chunks: number; error: string | null }>;
    errorMessage: string | null;
  };
  step4_openai_whisper: {
    attempted: boolean;
    status: StepStatus;
    skipReason: string | null;
    audioExtractorProvider: string | null;
    audioUrlFound: boolean;
    audioExtractionFailed: boolean;
    openaiInvoked: boolean;
    openaiHttpStatus: number | null;
    transcriptChars: number;
    segmentsCount: number;
    language: string | null;
    model: string | null;
    failureReason: string | null;
    extractorFailureReason: string | null;
  };

  final: {
    transcriptGenerated: boolean;
    finalSource: "cache" | "youtube" | "fallback" | "openai_whisper" | "none";
    failureCode: string | null;
    failureReason: string | null;
  };
};

async function step1Validate(videoId: string): Promise<PipelineTrace["step1_validate"]> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      return {
        attempted: true,
        status: "fail",
        httpStatus: res.status,
        title: null,
        author: null,
        errorMessage: `oEmbed HTTP ${res.status}`,
      };
    }
    const json: any = await res.json().catch(() => ({}));
    return {
      attempted: true,
      status: "ok",
      httpStatus: res.status,
      title: json?.title ?? null,
      author: json?.author_name ?? null,
      errorMessage: null,
    };
  } catch (e) {
    return {
      attempted: true,
      status: "fail",
      httpStatus: null,
      title: null,
      author: null,
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

async function step2Cache(videoId: string, expectedLanguage: string): Promise<PipelineTrace["step2_cache"]> {
  const empty = (overrides: Partial<PipelineTrace["step2_cache"]>): PipelineTrace["step2_cache"] => ({
    attempted: true,
    status: "ok",
    hit: false,
    rowsForVideo: 0,
    cacheRowId: null,
    cacheKey: null,
    provider: null,
    language: null,
    requestedLanguage: null,
    providerResponseLanguage: null,
    acceptedViaAnyShortcut: false,
    textDetectedLanguage: null,
    textDetectionConfidence: null,
    languageMismatchDetected: false,
    finalLanguageUsed: null,
    validationStatus: null,
    transcriptLengthChars: null,
    updatedAt: null,
    missReason: null,
    pipelineVersion: null,
    rowsAtCurrentVersion: 0,
    staleVersions: [],
    rejections: [],
    ...overrides,
  });

  // Use the LIVE pipeline's own cache lookup (read-only) so this trace can
  // never disagree with what learners actually receive.
  const { inspectTranscriptCache } = await import("@/lib/transcript.functions");
  const details = await inspectTranscriptCache(videoId, expectedLanguage);
  if (details.dbError) {
    return empty({ status: "fail", missReason: details.missReason, pipelineVersion: details.pipelineVersion });
  }
  const picked = details.picked;

  // Lightweight text-based language validation for diagnostics.
  let textDetectedLanguage: string | null = null;
  let textDetectionConfidence: number | null = null;
  let languageMismatchDetected = false;
  let finalLanguageUsed: string | null = picked?.language ?? null;
  if (picked) {
    try {
      const { detectLanguage, sameBaseLanguage } = await import("@/lib/lang-detect.server");
      const text = (picked.transcript_json ?? [])
        .slice(0, 80)
        .map((c: any) => c?.text ?? "")
        .join(" ");
      if (text.length >= 80) {
        const det = detectLanguage(text);
        textDetectedLanguage = det.language;
        textDetectionConfidence = det.confidence;
        const claimed = picked.language ?? picked.provider_response_language ?? null;
        if (
          det.language &&
          det.confidence >= 0.4 &&
          claimed &&
          !sameBaseLanguage(det.language, claimed)
        ) {
          languageMismatchDetected = true;
          finalLanguageUsed = det.language;
        }
      }
    } catch (e) {
      console.warn("[trace] language detection failed", e);
    }
  }

  return empty({
    hit: !!picked,
    rowsForVideo: details.rowsForVideo,
    cacheRowId: picked?.id ?? null,
    cacheKey: picked?.cache_key ?? null,
    provider: picked?.provider ?? null,
    language: picked?.language ?? null,
    requestedLanguage: picked?.requested_language ?? null,
    providerResponseLanguage: picked?.provider_response_language ?? null,
    acceptedViaAnyShortcut: !!picked && expectedLanguage === "_any_",
    textDetectedLanguage,
    textDetectionConfidence,
    languageMismatchDetected,
    finalLanguageUsed,
    transcriptLengthChars: picked?.transcript_length_chars ?? null,
    updatedAt: picked?.updated_at ?? null,
    missReason: details.missReason,
    pipelineVersion: details.pipelineVersion,
    rowsAtCurrentVersion: details.rowsAtCurrentVersion,
    staleVersions: details.staleVersions,
    rejections: details.rejections,
  });
}

async function step3Youtube(videoId: string): Promise<PipelineTrace["step3_youtube"]> {
  const langCandidates = ["nl", "nl-NL", "en", "en-US", "en-GB", undefined];
  const attempts: PipelineTrace["step3_youtube"]["attempts"] = [];
  let pickedLang: string | null = null;
  let pickedChunks = 0;
  let pickedChars = 0;
  let lastErr: string | null = null;
  for (const lang of langCandidates) {
    try {
      const r = await YoutubeTranscript.fetchTranscript(videoId, lang ? { lang } : undefined);
      attempts.push({ lang: lang ?? "default", ok: true, chunks: r?.length ?? 0, error: null });
      if (r && r.length) {
        pickedLang = lang ?? null;
        pickedChunks = r.length;
        pickedChars = r.reduce((n, x) => n + (x.text?.length ?? 0), 0);
        break;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      attempts.push({ lang: lang ?? "default", ok: false, chunks: 0, error: msg.slice(0, 200) });
      lastErr = msg;
      if (/429|too many requests|captcha|rate|blocked/i.test(msg)) break;
    }
  }
  return {
    attempted: true,
    status: pickedChunks > 0 ? "ok" : "fail",
    languageUsed: pickedLang,
    chunkCount: pickedChunks,
    transcriptChars: pickedChars,
    attempts,
    errorMessage: pickedChunks > 0 ? null : lastErr,
  };
}

async function step4OpenAiWhisper(
  videoId: string,
  expectedLanguage: string,
): Promise<PipelineTrace["step4_openai_whisper"]> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      attempted: false, status: "skipped", skipReason: "OPENAI_API_KEY missing",
      audioExtractorProvider: null, audioUrlFound: false, audioExtractionFailed: false,
      openaiInvoked: false, openaiHttpStatus: null, transcriptChars: 0,
      segmentsCount: 0, language: null, model: null,
      failureReason: null, extractorFailureReason: null,
    };
  }
  try {
    const { transcribeWithOpenAi } = await import("@/lib/asr-openai.server");
    const lang = expectedLanguage === "_any_" ? null : expectedLanguage;
    const { result, trace: t } = await transcribeWithOpenAi({
      videoId,
      expectedLanguage: lang,
    });
    const audioExtractionFailed = !t.audio_url_found;
    const chars = (result?.chunks ?? []).reduce((n, c) => n + c.text.length, 0);
    const ok = !!result && result.chunks.length > 0;
    return {
      attempted: true,
      status: ok ? "ok" : "fail",
      skipReason: null,
      audioExtractorProvider: t.rapidapi_host,
      audioUrlFound: t.audio_url_found,
      audioExtractionFailed,
      openaiInvoked: t.openaiInvoked,
      openaiHttpStatus: t.httpStatus,
      transcriptChars: chars,
      segmentsCount: t.segmentsCount,
      language: t.language ?? result?.language ?? null,
      model: t.model,
      failureReason: audioExtractionFailed
        ? "audio_extraction_failed"
        : `${t.failureCode ?? "ok"} (stage=${t.stage})`,
      extractorFailureReason: t.extractor_failure_reason,
    };
  } catch (e) {
    return {
      attempted: true, status: "fail", skipReason: null,
      audioExtractorProvider: null, audioUrlFound: false, audioExtractionFailed: false,
      openaiInvoked: false, openaiHttpStatus: null, transcriptChars: 0,
      segmentsCount: 0, language: null, model: null,
      failureReason: e instanceof Error ? e.message : String(e),
      extractorFailureReason: null,
    };
  }
}


export const traceTranscriptPipeline = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<PipelineTrace> => {
    const videoId = extractVideoId(data.url);
    const expectedLanguage = data.expectedLanguage?.trim() || "_any_";
    const videoUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : data.url;

    const trace: PipelineTrace = {
      input: {
        rawUrl: data.url,
        expectedLanguage: data.expectedLanguage?.trim() || null,
        videoId,
        videoUrl,
      },
      step1_validate: {
        attempted: false, status: "skipped", httpStatus: null, title: null, author: null, errorMessage: null,
      },
      step2_cache: {
        attempted: false, status: "skipped", hit: false, rowsForVideo: 0,
        cacheRowId: null, cacheKey: null, provider: null, language: null,
        requestedLanguage: null, providerResponseLanguage: null,
        acceptedViaAnyShortcut: false,
        textDetectedLanguage: null, textDetectionConfidence: null,
        languageMismatchDetected: false, finalLanguageUsed: null,
        validationStatus: null, transcriptLengthChars: null, updatedAt: null, missReason: null,
        pipelineVersion: null, rowsAtCurrentVersion: 0, staleVersions: [], rejections: [],
      },
      step3_youtube: {
        attempted: false, status: "skipped", languageUsed: null,
        chunkCount: 0, transcriptChars: 0, attempts: [], errorMessage: null,
      },
      step4_openai_whisper: {
        attempted: false, status: "skipped", skipReason: null,
        audioExtractorProvider: null, audioUrlFound: false, audioExtractionFailed: false,
        openaiInvoked: false, openaiHttpStatus: null, transcriptChars: 0,
        segmentsCount: 0, language: null, model: null,
        failureReason: null, extractorFailureReason: null,
      },

      final: {
        transcriptGenerated: false,
        finalSource: "none",
        failureCode: null,
        failureReason: null,
      },
    };

    if (!videoId) {
      trace.final.failureCode = "invalid_url";
      trace.final.failureReason = "Could not extract an 11-character YouTube video id from the URL.";
      return trace;
    }

    trace.step1_validate = await step1Validate(videoId);
    trace.step2_cache = await step2Cache(videoId, expectedLanguage);

    if (trace.step2_cache.hit) {
      trace.final = {
        transcriptGenerated: true,
        finalSource: "cache",
        failureCode: null,
        failureReason: null,
      };
      return trace;
    }

    trace.step3_youtube = await step3Youtube(videoId);
    if (trace.step3_youtube.status === "ok") {
      trace.final = {
        transcriptGenerated: true,
        finalSource: "youtube",
        failureCode: null,
        failureReason: null,
      };
      return trace;
    }

    trace.step4_openai_whisper = await step4OpenAiWhisper(videoId, expectedLanguage);
    if (trace.step4_openai_whisper.status === "ok") {
      trace.final = {
        transcriptGenerated: true,
        finalSource: "openai_whisper",
        failureCode: null,
        failureReason: null,
      };
      return trace;
    }

    // All layers failed.
    const reasons: string[] = [];
    if (trace.step3_youtube.errorMessage) reasons.push(`youtube: ${trace.step3_youtube.errorMessage}`);
    if (trace.step4_openai_whisper.skipReason) reasons.push(`openai_whisper_skipped: ${trace.step4_openai_whisper.skipReason}`);
    else if (trace.step4_openai_whisper.failureReason) reasons.push(`openai_whisper: ${trace.step4_openai_whisper.failureReason}`);
    trace.final = {
      transcriptGenerated: false,
      finalSource: "none",
      failureCode: "all_layers_failed",
      failureReason: reasons.join(" | "),
    };
    return trace;

  });
