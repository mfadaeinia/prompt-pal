import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------------- Types ----------------

export type FailureCode =
  // Video / source-asset failures
  | "V01" // Video URL inaccessible (404, private, removed)
  | "V02" // Download / probe timeout
  | "V03" // Empty video file / zero-byte response
  | "V04" // Unsupported format / non-video URL
  // Transcript failures (after successful URL access)
  | "T01" // No transcript after successful processing (legacy: captions not available)
  | "T02" // Empty transcript
  | "T03" // Transcript too short
  | "T04" // Provider blocked / rate-limited (transient — not a real failure)
  // Caption-availability (informational — not counted as a hard failure
  // when ASR fallback succeeds)
  | "C01" // YouTube captions unavailable
  // ASR fallback failures
  | "A01" // ASR fallback failed (captions missing AND ASR could not produce a transcript)
  | "A02" // Audio extraction failed (reserved — Worker runtime cannot extract audio locally)
  | "A03" // ASR provider timeout
  | "A04" // ASR provider returned empty transcript
  // Sentence-builder failures
  | "S01" // Too few sentences
  | "S02" // Giant merged sentence (>100 words in any one)
  | "S03" // Missing sentence boundaries
  // Translation
  | "L01" // Translation failed
  // Catch-all
  | "P01"; // Pipeline exception

export const FAILURE_LABELS: Record<FailureCode, string> = {
  V01: "V01 — Video URL inaccessible",
  V02: "V02 — Download / probe timeout",
  V03: "V03 — Empty video file",
  V04: "V04 — Unsupported format",
  T01: "T01 — No captions available (legacy)",
  T02: "T02 — Empty transcript",
  T03: "T03 — Transcript too short",
  T04: "T04 — Provider rate-limited (transient)",
  C01: "C01 — YouTube captions unavailable (informational)",
  A01: "A01 — ASR fallback failed",
  A02: "A02 — Audio extraction failed",
  A03: "A03 — ASR provider timeout",
  A04: "A04 — ASR provider returned empty transcript",
  S01: "S01 — Too few sentences",
  S02: "S02 — Giant merged sentence",
  S03: "S03 — Missing sentence boundaries",
  L01: "L01 — Translation failed",
  P01: "P01 — Pipeline exception",
};

export const ALL_FAILURE_CODES: FailureCode[] = [
  "V01", "V02", "V03", "V04",
  "T01", "T02", "T03", "T04",
  "C01", "A01", "A02", "A03", "A04",
  "S01", "S02", "S03",
  "L01", "P01",
];

/** Codes that are informational only — they should not count against the
 *  transcript reliability score. */
export const SOFT_FAILURE_CODES: FailureCode[] = ["T04", "C01"];

export type BenchmarkMode = "quick" | "full";

export type BenchmarkVideoRow = {
  id: string;
  youtube_url: string;
  video_id: string;
  title: string | null;
  category: string;
  difficulty: string;
  language: string;
  active: boolean;
  notes: string | null;
};

export type BenchmarkRunRow = {
  id: string;
  run_date: string;
  release_version: string | null;
  mode: BenchmarkMode;
  status: "running" | "completed" | "failed";
  total_videos: number;
  transcript_success_count: number;
  sentence_success_count: number;
  translation_success_count: number;
  pipeline_success_count: number;
  transcript_success_rate: number;
  sentence_success_rate: number;
  translation_success_rate: number;
  pipeline_success_rate: number;
  started_at: string;
  finished_at: string | null;
};

export type PipelineLogEntry = { step: string; ok: boolean; detail?: string; ms?: number };

export type BenchmarkResultRow = {
  id: string;
  run_id: string;
  benchmark_video_id: string;
  category: string;
  transcript_found: boolean;
  transcript_source: string | null;
  transcript_word_count: number;
  sentence_count: number;
  avg_sentence_length: number;
  longest_sentence_words: number;
  coverage_percent: number;
  translation_success: boolean;
  quality_rating: "high" | "medium" | "low";
  quality_reason: string | null;
  failure_code: FailureCode | null;
  processing_time_ms: number;
  error_message: string | null;
  provider_error: string | null;
  // Transcribr provider diagnostics (persisted per-row).
  transcribr_invoked: boolean | null;
  transcribr_status: number | null;
  transcribr_error: string | null;
  transcribr_segments_count: number | null;
  transcribr_duration_ms: number | null;
  // Generic ASR diagnostics (provider-agnostic).
  asr_provider: string | null;
  asr_model: string | null;
  asr_http_status: number | null;
  asr_error_body: string | null;
  asr_segments_count: number | null;
  asr_duration_ms: number | null;
  asr_language: string | null;
  asr_failure_code: string | null;

  // Audio extractor diagnostics (provider-agnostic).
  extractor_provider: string | null;
  extractor_http_status: number | null;
  extractor_response_status: string | null;
  extractor_response_body: string | null;
  extractor_audio_url_found: boolean | null;
  extractor_audio_url: string | null;
  extractor_latency_ms: number | null;
  extractor_failure_reason: string | null;
  openai_invoked: boolean | null;
  // Pipeline trace
  video_url_status: string | null;
  http_status_code: number | null;
  download_status: string | null;
  download_size_mb: number | null;
  cache_hit: boolean;
  transcript_generated: boolean;
  transcript_length_chars: number;
  translation_generated: boolean;
  pipeline_logs: PipelineLogEntry[] | null;
  // Sentence segmentation diagnostics
  short_fragment_pct: number | null;
  giant_sentence_pct: number | null;
  punctuation_coverage_pct: number | null;
  median_gap_seconds: number | null;
  sentence_quality_rating: "high" | "medium" | "low" | null;
  sentence_quality_reason: string | null;
  sentence_preview: Array<{
    text: string;
    start: number;
    end: number;
    words: number;
  }> | null;
  // Sentence repair (AI-assisted)
  deterministic_quality: "high" | "medium" | "low" | null;
  ai_repair_used: boolean | null;
  ai_repair_success: boolean | null;
  final_sentence_quality: "high" | "medium" | "low" | null;
  repair_reason: string | null;
  repair_diagnostics: {
    deterministicPreview?: Array<{ text: string; start: number; end: number; words: number }>;
    repairedPreview?: Array<{ text: string; start: number; end: number; words: number }> | null;
    rawChunksPreview?: Array<{ i: number; start: number; end: number; text: string }>;
    validationError?: string | null;
    aiHttpStatus?: number | null;
  } | null;
  // joined
  video_url?: string;
  video_id_ext?: string;
  video_title?: string | null;
};


// ---------------- Deterministic quality classification ----------------

export function classifyQuality(args: {
  sentenceCount: number;
  avgSentenceLength: number;
  coveragePercent: number;
  transcriptFound: boolean;
}): { rating: "high" | "medium" | "low"; reason: string } {
  const { sentenceCount, avgSentenceLength, coveragePercent, transcriptFound } = args;

  if (!transcriptFound) {
    return { rating: "low", reason: "Transcript retrieval failed" };
  }

  const highOk =
    sentenceCount >= 100 &&
    avgSentenceLength >= 5 &&
    avgSentenceLength <= 25 &&
    coveragePercent >= 80;
  if (highOk) {
    return {
      rating: "high",
      reason: `≥100 sentences (${sentenceCount}), avg ${avgSentenceLength.toFixed(1)} words (5–25), coverage ${coveragePercent.toFixed(0)}% (≥80%)`,
    };
  }

  if (sentenceCount < 20 || coveragePercent < 60) {
    const why: string[] = [];
    if (sentenceCount < 20) why.push(`only ${sentenceCount} sentences (<20)`);
    if (coveragePercent < 60)
      why.push(`coverage ${coveragePercent.toFixed(0)}% (<60%)`);
    return { rating: "low", reason: why.join("; ") };
  }

  if (sentenceCount >= 20 && sentenceCount <= 100 && coveragePercent >= 60) {
    return {
      rating: "medium",
      reason: `${sentenceCount} sentences (20–100), coverage ${coveragePercent.toFixed(0)}% (≥60%)`,
    };
  }

  return {
    rating: "medium",
    reason: `Did not meet high-quality thresholds (sentences=${sentenceCount}, avg=${avgSentenceLength.toFixed(1)}, coverage=${coveragePercent.toFixed(0)}%)`,
  };
}

// ---------------- Reads ----------------

export const listBenchmarkVideos = createServerFn({ method: "GET" }).handler(
  async (): Promise<BenchmarkVideoRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("benchmark_videos" as any)
      .select("*")
      .order("category", { ascending: true })
      .order("title", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as BenchmarkVideoRow[];
  },
);

export type DatasetHealth = {
  total: number;
  accessible: number;
  broken: number;
  expired: number;
  missing: number;
  cacheAvailable: number;
  checkedAt: string | null;
  perVideo: Array<{
    id: string;
    video_id: string;
    youtube_url: string;
    title: string | null;
    status: "ok" | "404" | "expired" | "access_denied" | "timeout" | "unknown";
    httpCode: number | null;
    cached: boolean;
  }>;
};

export type LatestBenchmark = {
  run: BenchmarkRunRow | null;
  results: BenchmarkResultRow[];
  history: BenchmarkRunRow[];
  dataset: {
    total: number;
    active: number;
    inactive: number;
    byCategory: Record<string, { total: number; active: number }>;
  };
};

export const getLatestBenchmark = createServerFn({ method: "GET" }).handler(
  async (): Promise<LatestBenchmark> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [runsRes, videosRes] = await Promise.all([
      supabaseAdmin
        .from("benchmark_runs" as any)
        .select("*")
        .order("run_date", { ascending: false })
        .limit(20),
      supabaseAdmin.from("benchmark_videos" as any).select("category, active"),
    ]);
    if (runsRes.error) throw new Error(runsRes.error.message);
    if (videosRes.error) throw new Error(videosRes.error.message);

    const history = (runsRes.data ?? []) as unknown as BenchmarkRunRow[];
    const completed = history.filter((r) => r.status === "completed");
    const run = completed[0] ?? history[0] ?? null;

    let results: BenchmarkResultRow[] = [];
    if (run) {
      const r = await supabaseAdmin
        .from("benchmark_video_results" as any)
        .select("*, benchmark_videos(youtube_url, video_id, title)")
        .eq("run_id", run.id);
      if (r.error) throw new Error(r.error.message);
      results = ((r.data ?? []) as any[]).map((row) => ({
        ...row,
        video_url: row.benchmark_videos?.youtube_url ?? null,
        video_id_ext: row.benchmark_videos?.video_id ?? null,
        video_title: row.benchmark_videos?.title ?? null,
      })) as BenchmarkResultRow[];
    }

    const videos = ((videosRes.data ?? []) as unknown) as Array<{
      category: string;
      active: boolean;
    }>;
    const byCategory: Record<string, { total: number; active: number }> = {};
    for (const v of videos) {
      const k = v.category;
      if (!byCategory[k]) byCategory[k] = { total: 0, active: 0 };
      byCategory[k].total += 1;
      if (v.active) byCategory[k].active += 1;
    }

    return {
      run,
      results,
      history,
      dataset: {
        total: videos.length,
        active: videos.filter((v) => v.active).length,
        inactive: videos.filter((v) => !v.active).length,
        byCategory,
      },
    };
  },
);

// ---------------- Pipeline comparison (current vs openai_only) ----------------

export type PipelineModeStats = {
  run: (BenchmarkRunRow & { pipeline_mode: string }) | null;
  totalRows: number;
  transcriptSuccess: number;
  extractionSuccess: number;
  openaiSuccess: number;
  avgOpenaiLatencyMs: number | null;
  avgExtractorLatencyMs: number | null;
  quality: { high: number; medium: number; low: number };
  failureReasons: Record<string, number>;
};

export type PipelineComparison = {
  current: PipelineModeStats;
  openai_only: PipelineModeStats;
};

async function loadModeStats(
  supabaseAdmin: any,
  pipelineMode: "current" | "openai_only",
): Promise<PipelineModeStats> {
  const { data: runs } = await supabaseAdmin
    .from("benchmark_runs" as any)
    .select("*")
    .eq("pipeline_mode", pipelineMode)
    .eq("status", "completed")
    .order("run_date", { ascending: false })
    .limit(1);
  const run = ((runs ?? []) as any[])[0] ?? null;
  const empty: PipelineModeStats = {
    run, totalRows: 0, transcriptSuccess: 0, extractionSuccess: 0, openaiSuccess: 0,
    avgOpenaiLatencyMs: null, avgExtractorLatencyMs: null,
    quality: { high: 0, medium: 0, low: 0 }, failureReasons: {},
  };
  if (!run) return empty;
  const { data: rows } = await supabaseAdmin
    .from("benchmark_video_results" as any)
    .select(
      "transcript_found, quality_rating, failure_code, asr_failure_code, asr_provider, asr_segments_count, asr_duration_ms, extractor_audio_url_found, extractor_latency_ms, extractor_failure_reason",
    )
    .eq("run_id", run.id);
  const list = (rows ?? []) as any[];
  let transcriptSuccess = 0, extractionSuccess = 0, openaiSuccess = 0;
  let oaLatSum = 0, oaLatN = 0, exLatSum = 0, exLatN = 0;
  const quality = { high: 0, medium: 0, low: 0 };
  const failureReasons: Record<string, number> = {};
  for (const r of list) {
    if (r.transcript_found) transcriptSuccess += 1;
    if (r.extractor_audio_url_found) extractionSuccess += 1;
    if ((r.asr_segments_count ?? 0) > 0 && !r.asr_failure_code) openaiSuccess += 1;
    if (typeof r.asr_duration_ms === "number") { oaLatSum += r.asr_duration_ms; oaLatN += 1; }
    if (typeof r.extractor_latency_ms === "number") { exLatSum += r.extractor_latency_ms; exLatN += 1; }
    if (r.quality_rating && quality[r.quality_rating as "high"|"medium"|"low"] !== undefined) {
      quality[r.quality_rating as "high"|"medium"|"low"] += 1;
    }
    const reason = r.extractor_failure_reason ?? r.asr_failure_code ?? r.failure_code;
    if (reason && !r.transcript_found) {
      failureReasons[reason] = (failureReasons[reason] ?? 0) + 1;
    }
  }
  return {
    run, totalRows: list.length,
    transcriptSuccess, extractionSuccess, openaiSuccess,
    avgOpenaiLatencyMs: oaLatN ? Math.round(oaLatSum / oaLatN) : null,
    avgExtractorLatencyMs: exLatN ? Math.round(exLatSum / exLatN) : null,
    quality, failureReasons,
  };
}

export const getPipelineComparison = createServerFn({ method: "GET" }).handler(
  async (): Promise<PipelineComparison> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [current, openai_only] = await Promise.all([
      loadModeStats(supabaseAdmin, "current"),
      loadModeStats(supabaseAdmin, "openai_only"),
    ]);
    return { current, openai_only };
  },
);


// ---------------- Dataset Health probe ----------------

/** Probe a YouTube URL via the public oembed endpoint. Cheap and CORS-friendly.
 *  - 200 → accessible
 *  - 401 → private / access denied
 *  - 404 → not found / removed (treated as broken/expired)
 *  - other → unknown
 */
async function probeYoutubeUrl(
  url: string,
): Promise<{ status: DatasetHealth["perVideo"][number]["status"]; httpCode: number | null }> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(endpoint, { method: "GET", signal: ctrl.signal });
    clearTimeout(timer);
    if (r.status === 200) return { status: "ok", httpCode: 200 };
    if (r.status === 401 || r.status === 403) return { status: "access_denied", httpCode: r.status };
    if (r.status === 404) return { status: "404", httpCode: 404 };
    return { status: "unknown", httpCode: r.status };
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (msg.includes("abort") || msg.includes("timeout")) return { status: "timeout", httpCode: null };
    return { status: "unknown", httpCode: null };
  }
}

export const getDatasetSize = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ total: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("benchmark_videos" as any)
      .select("id", { count: "exact", head: true })
      .eq("active", true);
    if (error) throw new Error(error.message);
    return { total: count ?? 0 };
  },
);

export const getDatasetHealth = createServerFn({ method: "GET" }).handler(
  async (): Promise<DatasetHealth> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("benchmark_videos" as any)
      .select("id, youtube_url, video_id, title, active")
      .eq("active", true);
    if (error) throw new Error(error.message);
    const list = ((data ?? []) as any[]) as Array<{
      id: string; youtube_url: string; video_id: string; title: string | null;
    }>;

    // Cache availability lookup
    const { data: cacheRows } = await supabaseAdmin
      .from("youtube_transcript_cache" as any)
      .select("video_id");
    const cached = new Set<string>(((cacheRows ?? []) as any[]).map((r) => r.video_id));

    // Probe with limited concurrency
    const CONCURRENCY = 8;
    const perVideo: DatasetHealth["perVideo"] = [];
    let i = 0;
    async function worker() {
      while (i < list.length) {
        const idx = i++;
        const v = list[idx];
        const probe = await probeYoutubeUrl(v.youtube_url);
        perVideo[idx] = {
          id: v.id,
          video_id: v.video_id,
          youtube_url: v.youtube_url,
          title: v.title,
          status: probe.status,
          httpCode: probe.httpCode,
          cached: cached.has(v.video_id),
        };
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, () => worker()));

    const accessible = perVideo.filter((p) => p.status === "ok").length;
    const broken = perVideo.filter((p) => p.status === "404" || p.status === "access_denied").length;
    const expired = perVideo.filter((p) => p.status === "404").length;
    const missing = perVideo.filter((p) => p.status === "timeout" || p.status === "unknown").length;
    const cacheAvailable = perVideo.filter((p) => p.cached).length;

    return {
      total: list.length,
      accessible,
      broken,
      expired,
      missing,
      cacheAvailable,
      checkedAt: new Date().toISOString(),
      perVideo,
    };
  },
);

// ---------------- Runner (per-video, client-driven) ----------------

const PipelineModeEnum = z.enum(["current", "openai_only"]);

const StartInput = z.object({
  mode: z.enum(["quick", "full"]),
  releaseVersion: z.string().max(80).optional(),
  pipelineMode: PipelineModeEnum.optional(),
});

const ProcessInput = z.object({
  runId: z.string().uuid(),
  videoId: z.string().uuid(),
  pipelineMode: PipelineModeEnum.optional(),
});

const FinalizeInput = z.object({ runId: z.string().uuid(), status: z.enum(["completed", "failed"]).optional() });

function wc(s: string) {
  const t = (s || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Step 1 — create the run row, return the list of videos to process. */
export const startBenchmarkRun = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StartInput.parse(d))
  .handler(async ({ data }): Promise<{ runId: string; videos: { id: string; youtube_url: string; title: string | null }[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const limit = data.mode === "quick" ? 10 : 200;
    const { data: videos, error: vErr } = await supabaseAdmin
      .from("benchmark_videos" as any)
      .select("id, youtube_url, title")
      .eq("active", true)
      .order("category", { ascending: true })
      .limit(limit);
    if (vErr) throw new Error(vErr.message);
    const list = ((videos ?? []) as unknown) as { id: string; youtube_url: string; title: string | null }[];
    if (!list.length) throw new Error("No active benchmark videos. Seed the dataset first.");

    const { data: runRow, error: rErr } = await supabaseAdmin
      .from("benchmark_runs" as any)
      .insert({
        mode: data.mode,
        status: "running",
        release_version: data.releaseVersion ?? null,
        total_videos: list.length,
        started_at: new Date().toISOString(),
        pipeline_mode: data.pipelineMode ?? "current",
      } as any)
      .select("id")
      .single();
    if (rErr) throw new Error(rErr.message);

    return { runId: (runRow as any).id as string, videos: list };
  });

/** Step 2 — process ONE video and insert its result row. */
export const processBenchmarkVideo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ProcessInput.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; rateLimited: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchTranscript } = await import("@/lib/transcript.functions");
    const { explainSentence } = await import("@/lib/explain.functions");

    let pipelineMode: "current" | "openai_only" = data.pipelineMode ?? "current";
    if (!data.pipelineMode) {
      const { data: runRow } = await supabaseAdmin
        .from("benchmark_runs" as any)
        .select("pipeline_mode")
        .eq("id", data.runId)
        .maybeSingle();
      const pm = (runRow as any)?.pipeline_mode;
      if (pm === "openai_only" || pm === "current") pipelineMode = pm;
    }

    const { data: vRow, error: vErr } = await supabaseAdmin
      .from("benchmark_videos" as any)
      .select("id, youtube_url, video_id, category")
      .eq("id", data.videoId)
      .single();
    if (vErr) throw new Error(vErr.message);
    const v = vRow as unknown as { id: string; youtube_url: string; video_id: string; category: string };

    const t0 = Date.now();
    const logs: PipelineLogEntry[] = [];
    const log = (e: PipelineLogEntry) => logs.push(e);

    let transcript_found = false;
    let transcript_source: string | null = null;
    let transcript_word_count = 0;
    let transcript_length_chars = 0;
    let sentence_count = 0;
    let avg_sentence_length = 0;
    let longest_sentence_words = 0;
    let coverage_percent = 0;
    let translation_success = false;
    let translation_generated = false;
    let failure_code: FailureCode | null = null;
    let error_message: string | null = null;
    let provider_error: string | null = null;
    let transcribr_invoked: boolean | null = null;
    let transcribr_status: number | null = null;
    let transcribr_error: string | null = null;
    let transcribr_segments_count: number | null = null;
    let transcribr_duration_ms: number | null = null;
    // Generic ASR diagnostics (provider-agnostic; populated for whichever
    // provider ASR_PROVIDER selected — currently "transcribr" or "openai").
    let asr_provider: string | null = null;
    let asr_model: string | null = null;
    let asr_http_status: number | null = null;
    let asr_error_body: string | null = null;
    let asr_segments_count: number | null = null;
    let asr_duration_ms: number | null = null;
    let asr_language: string | null = null;
    let asr_failure_code: string | null = null;
    // Extractor (RapidAPI youtube-mp36 today, provider-agnostic schema).
    let extractor_provider: string | null = null;
    let extractor_http_status: number | null = null;
    let extractor_response_status: string | null = null;
    let extractor_response_body: string | null = null;
    let extractor_audio_url_found: boolean | null = null;
    let extractor_audio_url: string | null = null;
    let extractor_latency_ms: number | null = null;
    let extractor_failure_reason: string | null = null;
    let openai_invoked: boolean | null = null;


    // Pipeline trace fields
    let video_url_status: string = "unknown";
    let http_status_code: number | null = null;
    let download_status: string = "skipped";
    let download_size_mb: number | null = null;
    let cache_hit = false;
    let transcript_generated = false;

    // Sentence diagnostics (populated after segmentation)
    let sentenceShortPct = 0;
    let sentenceGiantPct = 0;
    let sentencePunctPct = 0;
    let transcriptText: string | null = null;
    let transcriptPreview: string | null = null;
    let cacheRowId: string | null = null;
    let cacheKey: string | null = null;
    let sentenceMedianGap: number | null = null;
    let sentencePreview: Array<{ text: string; start: number; end: number; words: number }> = [];
    let sentenceQualityRating: "high" | "medium" | "low" = "low";
    let sentenceQualityReason: string | null = null;

    // Sentence repair (AI-assisted) diagnostics
    let deterministic_quality: "high" | "medium" | "low" | null = null;
    let ai_repair_used = false;
    let ai_repair_success = false;
    let final_sentence_quality: "high" | "medium" | "low" | null = null;
    let repair_reason: string | null = null;
    let repair_diagnostics: any = null;

    // STEP 1 — probe URL accessibility
    try {
      const tProbe = Date.now();
      const probe = await probeYoutubeUrl(v.youtube_url);
      http_status_code = probe.httpCode;
      if (probe.status === "ok") {
        video_url_status = "OK";
        log({ step: "url_probe", ok: true, detail: `HTTP 200`, ms: Date.now() - tProbe });
      } else if (probe.status === "404") {
        video_url_status = "404";
        failure_code = "V01";
        error_message = "Video URL returned 404";
        log({ step: "url_probe", ok: false, detail: `HTTP 404 — removed or invalid`, ms: Date.now() - tProbe });
      } else if (probe.status === "access_denied") {
        video_url_status = "Access Denied";
        failure_code = "V01";
        error_message = "Video is private or restricted";
        log({ step: "url_probe", ok: false, detail: `HTTP ${probe.httpCode} — access denied`, ms: Date.now() - tProbe });
      } else if (probe.status === "timeout") {
        video_url_status = "Timeout";
        failure_code = "V02";
        error_message = "URL probe timed out";
        log({ step: "url_probe", ok: false, detail: `timeout after 6s`, ms: Date.now() - tProbe });
      } else {
        video_url_status = "Unknown";
        log({ step: "url_probe", ok: false, detail: `HTTP ${probe.httpCode ?? "?"}`, ms: Date.now() - tProbe });
      }
    } catch (e) {
      video_url_status = "Error";
      failure_code = "P01";
      error_message = e instanceof Error ? e.message : String(e);
      log({ step: "url_probe", ok: false, detail: error_message });
    }

    // STEP 2 — check cache
    try {
      const { data: cached } = await supabaseAdmin
        .from("youtube_transcript_cache" as any)
        .select("video_id")
        .eq("video_id", v.video_id)
        .maybeSingle();
      cache_hit = Boolean(cached);
      log({ step: "cache_check", ok: true, detail: cache_hit ? "hit" : "miss" });
    } catch {
      log({ step: "cache_check", ok: false, detail: "lookup failed" });
    }

    // STEP 3 — fetch transcript (only if URL probe didn't already disqualify)
    if (!failure_code) {
      try {
        const tFetch = Date.now();
        const tr = await fetchTranscript({
          data: {
            url: v.youtube_url,
            skipCache: pipelineMode === "openai_only",
            skipYoutube: pipelineMode === "openai_only",
            forceProvider: pipelineMode === "openai_only" ? "openai" : undefined,
          },
        });
        log({ step: "transcript_fetch", ok: true, detail: `source=${tr.source}`, ms: Date.now() - tFetch });

        transcript_found = true;
        transcript_generated = true;
        transcript_source = tr.source;
        download_status = tr.source === "cache" ? "cache" : "Success";
        cacheRowId = tr.provenance?.cacheRowId ?? null;
        cacheKey = tr.provenance?.cacheKey ?? null;

        // Capture Transcribr trace on success path too (e.g. if Transcribr
        // was attempted and failed before YouTube captions succeeded, or
        // when source === "fallback" the trace shows what Transcribr returned).
        {
          const tr2 = tr.providerTrace?.transcribr;
          if (tr2) {
            transcribr_invoked = tr2.invoked;
            transcribr_status = tr2.httpStatus;
            transcribr_error = tr2.errorMessage;
            transcribr_segments_count = tr2.rawSegments;
            transcribr_duration_ms = tr2.durationMs;
          }
          const ag = tr.providerTrace?.asrGeneric;
          if (ag) {
            asr_provider = ag.provider;
            asr_model = ag.model;
            asr_http_status = ag.httpStatus;
            asr_error_body = ag.errorBody;
            asr_segments_count = ag.segmentsCount;
            asr_duration_ms = ag.durationMs;
            asr_language = ag.language;
            asr_failure_code = ag.failureCode;
            if (ag.provider === "openai") openai_invoked = (ag.segmentsCount ?? 0) > 0 || ag.httpStatus != null;
            if (ag.extractor) {
              extractor_provider = ag.extractor.provider;
              extractor_http_status = ag.extractor.httpStatus;
              extractor_response_status = ag.extractor.responseStatus;
              extractor_response_body = ag.extractor.responseBody;
              extractor_audio_url_found = ag.extractor.audioUrlFound;
              extractor_audio_url = ag.extractor.audioUrl;
              extractor_latency_ms = ag.extractor.latencyMs;
              extractor_failure_reason = ag.extractor.failureReason;
            }
          }
        }





        // ---- Sentence repair (deterministic → conditional AI repair) ----
        let sentences = tr.sentences ?? [];
        if (tr.rawChunks && tr.rawChunks.length && sentences.length) {
          try {
            const { repairSentencesIfNeeded } = await import(
              "@/lib/sentence-repair.server"
            );
            const tRepair = Date.now();
            const repair = await repairSentencesIfNeeded({
              chunks: tr.rawChunks,
              deterministic: sentences,
            });
            deterministic_quality = repair.deterministicQuality;
            ai_repair_used = repair.aiRepairUsed;
            ai_repair_success = repair.aiRepairSuccess;
            final_sentence_quality = repair.finalQuality;
            repair_reason = repair.repairReason;
            repair_diagnostics = repair.diagnostics;
            if (repair.finalSource === "ai_repaired") {
              sentences = repair.final;
            }
            log({
              step: "sentence_repair",
              ok: true,
              detail:
                `det=${repair.deterministicQuality} used=${repair.aiRepairUsed}` +
                ` success=${repair.aiRepairSuccess} final=${repair.finalQuality}` +
                ` (${repair.repairReason})`,
              ms: Date.now() - tRepair,
            });
          } catch (e) {
            log({
              step: "sentence_repair",
              ok: false,
              detail: e instanceof Error ? e.message : String(e),
            });
          }
        }
        sentence_count = sentences.length;

        const wordsPerSentence = sentences.map((s) => wc(s.text));
        const totalSentenceWords = wordsPerSentence.reduce((a, b) => a + b, 0);
        longest_sentence_words = wordsPerSentence.reduce((m, n) => Math.max(m, n), 0);
        avg_sentence_length = sentence_count
          ? Number((totalSentenceWords / sentence_count).toFixed(2))
          : 0;
        transcript_word_count = totalSentenceWords;
        transcript_length_chars = sentences.reduce((n, s) => n + (s.text?.length ?? 0), 0);
        download_size_mb = Number((transcript_length_chars / (1024 * 1024)).toFixed(4));
        coverage_percent = totalSentenceWords > 0 ? 100 : 0;

        // ---- Sentence segmentation diagnostics ----
        const shortFragCount = wordsPerSentence.filter((w) => w > 0 && w < 4).length;
        const giantCount = wordsPerSentence.filter((w) => w > 35).length;
        sentenceShortPct = sentence_count
          ? Number(((shortFragCount / sentence_count) * 100).toFixed(1))
          : 0;
        sentenceGiantPct = sentence_count
          ? Number(((giantCount / sentence_count) * 100).toFixed(1))
          : 0;
        const allText = sentences.map((s) => s.text).join(" ");
        const sentencesWithTerminator = sentences.filter((s) =>
          /[.!?…]\s*$/.test(s.text.trim()),
        ).length;
        sentencePunctPct = sentence_count
          ? Number(((sentencesWithTerminator / sentence_count) * 100).toFixed(1))
          : 0;
        // Median gap between sentence boundaries (seconds)
        const gaps: number[] = [];
        for (let i = 1; i < sentences.length; i++) {
          const g = sentences[i].offset - (sentences[i - 1].endTime ?? sentences[i - 1].offset);
          if (Number.isFinite(g) && g >= 0) gaps.push(g);
        }
        if (gaps.length) {
          const sorted = [...gaps].sort((a, b) => a - b);
          const mid = sorted[Math.floor(sorted.length / 2)];
          sentenceMedianGap = Number(mid.toFixed(2));
        }
        sentencePreview = sentences.slice(0, 20).map((s) => ({
          text: s.text,
          start: Number(s.offset.toFixed(2)),
          end: Number((s.endTime ?? s.offset).toFixed(2)),
          words: wc(s.text),
        }));
        // Capture full transcript text for human review
        transcriptText = sentences.map((s) => s.text).join(" ").trim();
        transcriptPreview = transcriptText.slice(0, 200);

        // Sentence UX quality (independent of pipeline success).
        const susReasons: string[] = [];
        let susRating: "high" | "medium" | "low" = "high";
        if (sentence_count < 10) susReasons.push(`only ${sentence_count} sentences`);
        if (sentenceShortPct > 25) susReasons.push(`${sentenceShortPct}% short fragments`);
        if (sentenceGiantPct > 10) susReasons.push(`${sentenceGiantPct}% giant sentences`);
        if (sentencePunctPct < 60) susReasons.push(`punctuation coverage ${sentencePunctPct}%`);
        if (avg_sentence_length > 28 || avg_sentence_length < 6)
          susReasons.push(`avg length ${avg_sentence_length}w outside 6–28`);
        if (susReasons.length >= 2 || sentenceGiantPct > 15 || sentence_count < 5)
          susRating = "low";
        else if (susReasons.length === 1) susRating = "medium";
        sentenceQualityRating = susRating;
        sentenceQualityReason = susReasons.length
          ? susReasons.join("; ")
          : `clean — avg ${avg_sentence_length}w, ${sentencePunctPct}% punctuated`;

        // Pipeline-failure codes (NOT triggered by UX quality alone)
        if (transcript_word_count === 0) failure_code = "T02";
        else if (transcript_word_count < 50) failure_code = "T03";
        else if (sentence_count < 5) failure_code = "S01";
        // S02/S03 are now informational-only — the splitOversize post-pass
        // guarantees no >100-word sentences, so these codes are vestigial.

        const sentenceBuiltOk = !failure_code && sentence_count >= 5;
        log({
          step: "sentence_build",
          ok: sentenceBuiltOk,
          detail: `count=${sentence_count} avgLen=${avg_sentence_length} short=${sentenceShortPct}% giant=${sentenceGiantPct}% punct=${sentencePunctPct}% ux=${susRating}`,
        });
        void allText;

        // STEP 4 — translation
        if (sentenceBuiltOk) {
          const sample = sentences.find((s) => wc(s.text) >= 4) ?? sentences[0];
          try {
            const tTr = Date.now();
            const ex = await explainSentence({
              data: { sentence: sample.text.slice(0, 800), targetLanguage: "English" },
            });
            const err = (ex as { error?: string }).error;
            translation_success = !err && (ex.explanation?.length ?? 0) > 10;
            translation_generated = translation_success;
            if (!translation_success && !failure_code) failure_code = "L01";
            log({ step: "translation", ok: translation_success, detail: err ?? `len=${ex.explanation?.length ?? 0}`, ms: Date.now() - tTr });
          } catch (e) {
            translation_success = false;
            if (!failure_code) failure_code = "L01";
            const m = e instanceof Error ? e.message : String(e);
            error_message = error_message ?? m;
            log({ step: "translation", ok: false, detail: m });
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const errorType = (e as { errorType?: string } | null)?.errorType;
        const providerMessage = (e as { providerMessage?: string } | null)?.providerMessage ?? null;
        // Keep the raw provider error separate from the friendly user-facing message.
        provider_error = providerMessage ?? msg;
        error_message = msg;
        const low = msg.toLowerCase();
        // Prefer the structured errorType attached by fetchTranscript when present.
        if (errorType === "rate_limited" || low.includes("too many requests") || low.includes("429") || low.includes("captcha")) {
          failure_code = "T04";
        } else if (errorType === "asr_timeout") {
          // Captions unavailable AND ASR provider timed out.
          failure_code = "A03";
        } else if (errorType === "asr_empty") {
          // Captions unavailable AND ASR returned no segments.
          failure_code = "A04";
        } else if (errorType === "asr_failed") {
          // Captions unavailable AND ASR provider failed (HTTP error / bad JSON / no key).
          failure_code = "A01";
        } else if (errorType === "captions_disabled" || errorType === "not_found" || low.includes("subtitles") || low.includes("no transcript") || low.includes("not find") || low.includes("disabled")) {
          // YouTube reported no captions and we have no further info — treat
          // as a hard transcript failure since ASR wasn't reached or didn't
          // surface its own error.
          failure_code = "A01";
        } else if (errorType === "network" || low.includes("timeout") || low.includes("network")) {
          failure_code = "V02";
        } else {
          failure_code = "P01";
        }
        download_status = "Failed";
        log({ step: "transcript_fetch", ok: false, detail: `[${errorType ?? "?"}] ${msg}` });
        // Per-provider diagnostics — surface for every transcript failure
        // (e.g. T01/A01) so the founder dashboard can answer:
        //   • Was Transcribr invoked? What HTTP code / error did it return?
        //   • Was ASR invoked? Did it return a transcript that got discarded?
        const pt = (e as { providerTrace?: import("@/lib/transcript.functions").ProviderTrace } | null)?.providerTrace;
        if (pt) {
          const tr = pt.transcribr;
          // Persist Transcribr diagnostics directly to dedicated columns
          // so failures can be aggregated without parsing the log array.
          transcribr_invoked = tr.invoked;
          transcribr_status = tr.httpStatus;
          transcribr_error = tr.errorMessage;
          transcribr_segments_count = tr.rawSegments;
          transcribr_duration_ms = tr.durationMs;
          const trDiscarded = tr.rawSegments > 0 && tr.keptSegments === 0;
          log({
            step: "provider:transcribr",
            ok: tr.keptSegments > 0,
            detail:
              `invoked=${tr.invoked ? "yes" : "no"}` +
              ` http=${tr.httpStatus ?? "-"}` +
              ` segments=${tr.rawSegments}` +
              ` kept=${tr.keptSegments}` +
              (trDiscarded ? ` discarded=${tr.discardedReason ?? "yes"}` : "") +
              (tr.errorMessage ? ` error=${tr.errorMessage.slice(0, 160)}` : ""),
          });
          const ar = pt.asr;
          const arDiscarded = ar.rawSegments > 0 && ar.keptSegments === 0;
          log({
            step: "provider:asr_gemini",
            ok: ar.keptSegments > 0,
            detail:
              `invoked=${ar.invoked ? "yes" : "no"}` +
              ` http=${ar.httpStatus ?? "-"}` +
              ` segments=${ar.rawSegments}` +
              ` kept=${ar.keptSegments}` +
              (arDiscarded ? ` discarded=${ar.discardedReason ?? "yes"}` : "") +
              (ar.errorMessage ? ` error=${ar.errorMessage.slice(0, 160)}` : ""),
          });
          const ag = pt.asrGeneric;
          if (ag) {
            asr_provider = ag.provider;
            asr_model = ag.model;
            asr_http_status = ag.httpStatus;
            asr_error_body = ag.errorBody;
            asr_segments_count = ag.segmentsCount;
            asr_duration_ms = ag.durationMs;
            asr_language = ag.language;
            asr_failure_code = ag.failureCode;
            if (ag.provider === "openai") openai_invoked = ag.httpStatus != null;
            if (ag.extractor) {
              extractor_provider = ag.extractor.provider;
              extractor_http_status = ag.extractor.httpStatus;
              extractor_response_status = ag.extractor.responseStatus;
              extractor_response_body = ag.extractor.responseBody;
              extractor_audio_url_found = ag.extractor.audioUrlFound;
              extractor_audio_url = ag.extractor.audioUrl;
              extractor_latency_ms = ag.extractor.latencyMs;
              extractor_failure_reason = ag.extractor.failureReason;
            }

            log({
              step: `provider:asr_${ag.provider ?? "unknown"}`,
              ok: (ag.segmentsCount ?? 0) > 0 && !ag.failureCode,
              detail:
                `provider=${ag.provider ?? "-"}` +
                ` model=${ag.model ?? "-"}` +
                ` http=${ag.httpStatus ?? "-"}` +
                ` segments=${ag.segmentsCount ?? 0}` +
                ` lang=${ag.language ?? "-"}` +
                (ag.failureCode ? ` failure=${ag.failureCode}` : "") +
                (ag.errorBody ? ` error=${ag.errorBody.slice(0, 160)}` : ""),
            });
          }
        }
      }
    }

    const { rating, reason } = classifyQuality({
      sentenceCount: sentence_count,
      avgSentenceLength: avg_sentence_length,
      coveragePercent: coverage_percent,
      transcriptFound: transcript_found,
    });

    const processing_time_ms = Date.now() - t0;

    const { error: insErr } = await supabaseAdmin
      .from("benchmark_video_results" as any)
      .insert({
        run_id: data.runId,
        benchmark_video_id: v.id,
        category: v.category,
        transcript_found,
        transcript_source,
        transcript_word_count,
        sentence_count,
        avg_sentence_length,
        longest_sentence_words,
        coverage_percent,
        translation_success,
        quality_rating: rating,
        quality_reason: reason,
        failure_code,
        processing_time_ms,
        error_message,
        provider_error,
        transcribr_invoked,
        transcribr_status,
        transcribr_error,
        transcribr_segments_count,
        transcribr_duration_ms,
        asr_provider,
        asr_model,
        asr_http_status,
        asr_error_body,
        asr_segments_count,
        asr_duration_ms,
        asr_language,
        asr_failure_code,
        extractor_provider,
        extractor_http_status,
        extractor_response_status,
        extractor_response_body,
        extractor_audio_url_found,
        extractor_audio_url,
        extractor_latency_ms,
        extractor_failure_reason,
        openai_invoked,

        video_url_status,
        http_status_code,
        download_status,
        download_size_mb,
        cache_hit,
        transcript_generated,
        transcript_length_chars,
        translation_generated,
        pipeline_logs: logs as any,
        short_fragment_pct: sentenceShortPct,
        giant_sentence_pct: sentenceGiantPct,
        punctuation_coverage_pct: sentencePunctPct,
        median_gap_seconds: sentenceMedianGap,
        sentence_quality_rating: transcript_found ? sentenceQualityRating : null,
        sentence_quality_reason: transcript_found ? sentenceQualityReason : null,
        sentence_preview: sentencePreview as any,
        deterministic_quality,
        ai_repair_used,
        ai_repair_success,
        final_sentence_quality,
        repair_reason,
        repair_diagnostics: repair_diagnostics as any,
        transcript_text: transcriptText,
        transcript_preview: transcriptPreview,
        cache_row_id: cacheRowId,
        cache_key: cacheKey,
        pipeline_mode: pipelineMode,
      } as any);
    if (insErr) throw new Error(insErr.message);

    return { ok: true, rateLimited: failure_code === "T04" };
  });

/** Step 3 — aggregate result rows into the run row, mark completed. */
export const finalizeBenchmarkRun = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => FinalizeInput.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: results, error: resErr } = await supabaseAdmin
      .from("benchmark_video_results" as any)
      .select("transcript_found, sentence_count, failure_code, translation_success, quality_rating")
      .eq("run_id", data.runId);
    if (resErr) throw new Error(resErr.message);

    const rows = (results ?? []) as unknown as Array<{
      transcript_found: boolean;
      sentence_count: number;
      failure_code: FailureCode | null;
      translation_success: boolean;
      quality_rating: "high" | "medium" | "low";
    }>;

    const { data: runRow, error: rErr } = await supabaseAdmin
      .from("benchmark_runs" as any)
      .select("total_videos")
      .eq("id", data.runId)
      .single();
    if (rErr) throw new Error(rErr.message);
    const total = Math.max(1, (runRow as any).total_videos as number);

    let transcriptOk = 0, sentenceOk = 0, translationOk = 0, pipelineOk = 0;
    for (const r of rows) {
      if (r.transcript_found) transcriptOk += 1;
      const sentenceBuilt =
        r.transcript_found && r.sentence_count >= 5 && !["S01", "S02", "S03"].includes(r.failure_code ?? "");
      if (sentenceBuilt) sentenceOk += 1;
      if (r.translation_success) translationOk += 1;
      // Pipeline success = transcript + sentence units + translation.
      // Sentence UX quality (high/medium/low) is reported separately and
      // does NOT mark the pipeline as failed.
      if (r.transcript_found && sentenceBuilt && r.translation_success) pipelineOk += 1;
    }

    const pct = (n: number) => Number(((n / total) * 100).toFixed(2));
    const status = data.status ?? "completed";
    const { error: upErr } = await supabaseAdmin
      .from("benchmark_runs" as any)
      .update({
        status,
        finished_at: new Date().toISOString(),
        transcript_success_count: transcriptOk,
        sentence_success_count: sentenceOk,
        translation_success_count: translationOk,
        pipeline_success_count: pipelineOk,
        transcript_success_rate: pct(transcriptOk),
        sentence_success_rate: pct(sentenceOk),
        translation_success_rate: pct(translationOk),
        pipeline_success_rate: pct(pipelineOk),
      } as any)
      .eq("id", data.runId);
    if (upErr) throw new Error(upErr.message);

    // Auto-sample up to 5 results per quality bucket for the founder review queue
    try {
      const { data: sampleRows } = await supabaseAdmin
        .from("benchmark_video_results" as any)
        .select("id, quality_rating, transcript_found")
        .eq("run_id", data.runId);
      const eligible = ((sampleRows ?? []) as any[]).filter((r) => r.transcript_found);
      const pickN = <T,>(arr: T[], n: number): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a.slice(0, n);
      };
      const buckets: Array<["high" | "medium" | "low", any[]]> = [
        ["high", eligible.filter((r) => r.quality_rating === "high")],
        ["medium", eligible.filter((r) => r.quality_rating === "medium")],
        ["low", eligible.filter((r) => r.quality_rating === "low")],
      ];
      for (const [bucket, rows] of buckets) {
        const picks = pickN(rows, 5);
        if (picks.length === 0) continue;
        await supabaseAdmin
          .from("benchmark_video_results" as any)
          .update({ sampling_bucket: bucket } as any)
          .in("id", picks.map((p) => p.id));
      }
    } catch (e) {
      console.error("[benchmark] sampling failed", e);
    }

    return { ok: true };
  });

// ---------------- Golden dataset management ----------------

function extractYoutubeId(url: string): string | null {
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

const GoldenVideoInput = z.object({
  youtube_url: z.string().url(),
  video_id: z.string().min(1).max(32).optional(),
  title: z.string().max(500).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  difficulty: z.string().max(40).nullable().optional(),
  language: z.string().max(20).nullable().optional(),
  active: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const UpsertInput = z.object({
  videos: z.array(GoldenVideoInput).min(1).max(1000),
  /** When true, every existing video NOT in the payload is set to active=false. */
  replaceMode: z.boolean().optional(),
});

export type UpsertBenchmarkResult = {
  inserted: number;
  updated: number;
  deactivated: number;
  errors: { youtube_url: string; reason: string }[];
};

/** Upsert (and optionally replace) the active benchmark dataset.
 *  Matches existing rows on `video_id`. Never deletes rows — out-of-payload
 *  rows are only set to `active=false` when `replaceMode` is true. */
export const upsertBenchmarkVideos = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data }): Promise<UpsertBenchmarkResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const errors: { youtube_url: string; reason: string }[] = [];
    const normalized: Array<Required<Pick<z.infer<typeof GoldenVideoInput>, "youtube_url">> & {
      video_id: string;
      title: string | null;
      category: string | null;
      difficulty: string | null;
      language: string | null;
      active: boolean;
      notes: string | null;
    }> = [];

    for (const v of data.videos) {
      const vid = v.video_id ?? extractYoutubeId(v.youtube_url);
      if (!vid) {
        errors.push({ youtube_url: v.youtube_url, reason: "Could not extract YouTube video_id" });
        continue;
      }
      normalized.push({
        youtube_url: v.youtube_url,
        video_id: vid,
        title: v.title ?? null,
        category: v.category ?? null,
        difficulty: v.difficulty ?? null,
        language: v.language ?? null,
        active: v.active ?? true,
        notes: v.notes ?? null,
      });
    }

    // Deduplicate on video_id, last write wins.
    const byId = new Map<string, (typeof normalized)[number]>();
    for (const n of normalized) byId.set(n.video_id, n);
    const rows = Array.from(byId.values());

    // Find existing rows so we can report inserted vs updated counts.
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("benchmark_videos" as any)
      .select("id, video_id");
    if (exErr) throw new Error(exErr.message);
    const existingIds = new Set<string>(((existing ?? []) as any[]).map((r) => r.video_id));
    const incomingIds = new Set<string>(rows.map((r) => r.video_id));

    let inserted = 0;
    let updated = 0;

    if (rows.length) {
      const { error: upErr } = await supabaseAdmin
        .from("benchmark_videos" as any)
        .upsert(rows as any, { onConflict: "video_id" });
      if (upErr) throw new Error(upErr.message);
      for (const r of rows) {
        if (existingIds.has(r.video_id)) updated++;
        else inserted++;
      }
    }

    let deactivated = 0;
    if (data.replaceMode) {
      const toDeactivate = ((existing ?? []) as any[])
        .filter((r) => !incomingIds.has(r.video_id))
        .map((r) => r.id);
      if (toDeactivate.length) {
        const { error: dErr } = await supabaseAdmin
          .from("benchmark_videos" as any)
          .update({ active: false } as any)
          .in("id", toDeactivate);
        if (dErr) throw new Error(dErr.message);
        deactivated = toDeactivate.length;
      }
    }

    return { inserted, updated, deactivated, errors };
  });

export type BenchmarkVideoExport = {
  youtube_url: string;
  video_id: string;
  title: string | null;
  category: string | null;
  difficulty: string | null;
  language: string | null;
  active: boolean;
  notes: string | null;
};

/** Export the current dataset as JSON (round-trip with upsertBenchmarkVideos). */
export const exportBenchmarkVideos = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ videos: BenchmarkVideoExport[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("benchmark_videos" as any)
      .select("youtube_url, video_id, title, category, difficulty, language, active, notes")
      .order("category", { ascending: true })
      .order("title", { ascending: true });
    if (error) throw new Error(error.message);
    return { videos: (data ?? []) as unknown as BenchmarkVideoExport[] };
  },
);
