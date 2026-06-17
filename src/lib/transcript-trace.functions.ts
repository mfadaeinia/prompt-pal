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
 *   4. Transcribr fallback (https://www.transcribr.io)
 *   5. Gemini ASR — DISABLED in code (hallucination risk)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { YoutubeTranscript } from "youtube-transcript";

const Input = z.object({
  url: z.string().min(1).max(500),
  expectedLanguage: z.string().max(20).optional(),
});

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function extractVideoId(input: string): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (VIDEO_ID_RE.test(raw)) return raw;

  // Allow bare URLs without protocol
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const segments = u.pathname.split("/").filter(Boolean);

  const valid = (s: string | null | undefined): string | null =>
    s && VIDEO_ID_RE.test(s) ? s : null;

  if (host === "youtu.be") {
    return valid(segments[0] ?? null);
  }

  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    // /watch?v=ID  (regardless of other query params)
    if (segments[0] === "watch") {
      const v = valid(u.searchParams.get("v"));
      if (v) return v;
    }
    // /shorts/ID, /embed/ID, /live/ID, /v/ID
    if (["shorts", "embed", "live", "v"].includes(segments[0])) {
      return valid(segments[1] ?? null);
    }
    // Fallback: any ?v= param
    const v = valid(u.searchParams.get("v"));
    if (v) return v;
  }

  return null;
}

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
    validationStatus: string | null;
    transcriptLengthChars: number | null;
    updatedAt: string | null;
    missReason: string | null;
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
  step4_transcribr: {
    attempted: boolean;
    status: StepStatus;
    requestSent: boolean;
    httpStatus: number | null;
    languageReturned: string | null;
    rawSegments: number;
    keptSegments: number;
    transcriptChars: number;
    responseBodySnippet: string | null;
    errorMessage: string | null;
    skipReason: string | null;
  };
  step5_gemini: {
    attempted: boolean;
    status: "disabled";
    reason: string;
  };
  final: {
    transcriptGenerated: boolean;
    finalSource: "cache" | "youtube" | "fallback" | "none";
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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("youtube_transcript_cache" as any)
    .select(
      "id, video_id, language, provider, requested_language, provider_response_language, cache_key, transcript_length_chars, updated_at, transcript_json",
    )
    .eq("video_id", videoId)
    .order("updated_at", { ascending: false });
  if (error) {
    return {
      attempted: true,
      status: "fail",
      hit: false,
      rowsForVideo: 0,
      cacheRowId: null,
      cacheKey: null,
      provider: null,
      language: null,
      validationStatus: null,
      transcriptLengthChars: null,
      updatedAt: null,
      missReason: `db_error: ${error.message}`,
    };
  }
  const rows = (data ?? []) as any[];
  if (!rows.length) {
    return {
      attempted: true,
      status: "ok",
      hit: false,
      rowsForVideo: 0,
      cacheRowId: null,
      cacheKey: null,
      provider: null,
      language: null,
      validationStatus: null,
      transcriptLengthChars: null,
      updatedAt: null,
      missReason: "no_rows_for_video_id",
    };
  }
  let picked: any | null = null;
  let missReason: string | null = null;
  if (expectedLanguage === "_any_") {
    picked = rows[0];
  } else {
    picked =
      rows.find(
        (r) =>
          (r.requested_language && r.requested_language === expectedLanguage) ||
          (r.provider_response_language && r.provider_response_language === expectedLanguage),
      ) ?? null;
    if (!picked) missReason = `no_row_matches_language:${expectedLanguage}`;
  }
  if (picked && (!picked.transcript_json || picked.transcript_json.length === 0)) {
    missReason = "row_present_but_transcript_json_empty";
    picked = null;
  }
  return {
    attempted: true,
    status: "ok",
    hit: !!picked,
    rowsForVideo: rows.length,
    cacheRowId: picked?.id ?? null,
    cacheKey: picked?.cache_key ?? null,
    provider: picked?.provider ?? null,
    language: picked?.language ?? null,
    validationStatus: null,
    transcriptLengthChars: picked?.transcript_length_chars ?? null,
    updatedAt: picked?.updated_at ?? null,
    missReason,
  };
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

async function step4Transcribr(videoId: string): Promise<PipelineTrace["step4_transcribr"]> {
  const apiKey = process.env.TRANSCRIBR_API_KEY;
  if (!apiKey) {
    return {
      attempted: false,
      status: "skipped",
      requestSent: false,
      httpStatus: null,
      languageReturned: null,
      rawSegments: 0,
      keptSegments: 0,
      transcriptChars: 0,
      responseBodySnippet: null,
      errorMessage: null,
      skipReason: "TRANSCRIBR_API_KEY missing",
    };
  }
  try {
    const res = await fetch("https://www.transcribr.io/api/v1/transcript", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
      body: JSON.stringify({ video_id: videoId }),
    });
    const bodyText = await res.text().catch(() => "");
    if (!res.ok) {
      return {
        attempted: true,
        status: "fail",
        requestSent: true,
        httpStatus: res.status,
        languageReturned: null,
        rawSegments: 0,
        keptSegments: 0,
        transcriptChars: 0,
        responseBodySnippet: bodyText.slice(0, 500),
        errorMessage: `HTTP ${res.status}`,
        skipReason: null,
      };
    }
    let json: any = null;
    try {
      json = JSON.parse(bodyText);
    } catch {
      return {
        attempted: true,
        status: "fail",
        requestSent: true,
        httpStatus: res.status,
        languageReturned: null,
        rawSegments: 0,
        keptSegments: 0,
        transcriptChars: 0,
        responseBodySnippet: bodyText.slice(0, 500),
        errorMessage: "invalid_json",
        skipReason: null,
      };
    }
    const transcript: any[] = Array.isArray(json?.transcript) ? json.transcript : [];
    const kept = transcript.filter((c) => String(c.text ?? "").length > 0);
    const chars = kept.reduce((n, c) => n + String(c.text ?? "").length, 0);
    return {
      attempted: true,
      status: kept.length > 0 ? "ok" : "fail",
      requestSent: true,
      httpStatus: res.status,
      languageReturned: json?.language ?? null,
      rawSegments: transcript.length,
      keptSegments: kept.length,
      transcriptChars: chars,
      responseBodySnippet: bodyText.slice(0, 300),
      errorMessage: kept.length > 0 ? null : "empty_or_blank_segments",
      skipReason: null,
    };
  } catch (e) {
    return {
      attempted: true,
      status: "fail",
      requestSent: true,
      httpStatus: null,
      languageReturned: null,
      rawSegments: 0,
      keptSegments: 0,
      transcriptChars: 0,
      responseBodySnippet: null,
      errorMessage: e instanceof Error ? e.message : String(e),
      skipReason: null,
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
        validationStatus: null, transcriptLengthChars: null, updatedAt: null, missReason: null,
      },
      step3_youtube: {
        attempted: false, status: "skipped", languageUsed: null,
        chunkCount: 0, transcriptChars: 0, attempts: [], errorMessage: null,
      },
      step4_transcribr: {
        attempted: false, status: "skipped", requestSent: false, httpStatus: null,
        languageReturned: null, rawSegments: 0, keptSegments: 0, transcriptChars: 0,
        responseBodySnippet: null, errorMessage: null, skipReason: null,
      },
      step5_gemini: {
        attempted: false,
        status: "disabled",
        reason: "Layer 4 (Gemini file_uri ASR) is permanently disabled in transcript.functions.ts — the gateway does not fetch YouTube audio and the model hallucinates transcripts. No real ASR backend is wired yet.",
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

    trace.step4_transcribr = await step4Transcribr(videoId);
    if (trace.step4_transcribr.status === "ok") {
      trace.final = {
        transcriptGenerated: true,
        finalSource: "fallback",
        failureCode: null,
        failureReason: null,
      };
      return trace;
    }

    // All available layers failed (Gemini is disabled by code).
    const reasons: string[] = [];
    if (trace.step3_youtube.errorMessage) reasons.push(`youtube: ${trace.step3_youtube.errorMessage}`);
    if (trace.step4_transcribr.skipReason) reasons.push(`transcribr_skipped: ${trace.step4_transcribr.skipReason}`);
    else if (trace.step4_transcribr.errorMessage) reasons.push(`transcribr: ${trace.step4_transcribr.errorMessage}`);
    reasons.push("gemini_asr_disabled");
    trace.final = {
      transcriptGenerated: false,
      finalSource: "none",
      failureCode: "all_layers_failed",
      failureReason: reasons.join(" | "),
    };
    return trace;
  });
