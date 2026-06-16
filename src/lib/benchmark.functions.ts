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
  | "T01" // No transcript after successful processing (captions not available)
  | "T02" // Empty transcript
  | "T03" // Transcript too short
  | "T04" // Provider blocked / rate-limited (transient — not a real failure)
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
  T01: "T01 — No captions available",
  T02: "T02 — Empty transcript",
  T03: "T03 — Transcript too short",
  T04: "T04 — Provider rate-limited (transient)",
  S01: "S01 — Too few sentences",
  S02: "S02 — Giant merged sentence",
  S03: "S03 — Missing sentence boundaries",
  L01: "L01 — Translation failed",
  P01: "P01 — Pipeline exception",
};

export const ALL_FAILURE_CODES: FailureCode[] = [
  "V01", "V02", "V03", "V04", "T01", "T02", "T03", "T04", "S01", "S02", "S03", "L01", "P01",
];

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

const StartInput = z.object({
  mode: z.enum(["quick", "full"]),
  releaseVersion: z.string().max(80).optional(),
});

const ProcessInput = z.object({
  runId: z.string().uuid(),
  videoId: z.string().uuid(),
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

    // Pipeline trace fields
    let video_url_status: string = "unknown";
    let http_status_code: number | null = null;
    let download_status: string = "skipped";
    let download_size_mb: number | null = null;
    let cache_hit = false;
    let transcript_generated = false;

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
        const tr = await fetchTranscript({ data: { url: v.youtube_url } });
        log({ step: "transcript_fetch", ok: true, detail: `source=${tr.source}`, ms: Date.now() - tFetch });

        transcript_found = true;
        transcript_generated = true;
        transcript_source = tr.source;
        download_status = tr.source === "cache" ? "cache" : "Success";
        const sentences = tr.sentences ?? [];
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

        if (transcript_word_count === 0) failure_code = "T02";
        else if (transcript_word_count < 50) failure_code = "T03";
        else if (sentence_count < 5) failure_code = "S01";
        else if (longest_sentence_words > 100) failure_code = "S02";
        else if (avg_sentence_length > 50 && sentence_count < 10) failure_code = "S03";

        const sentenceBuiltOk = !failure_code && sentence_count >= 5;
        log({ step: "sentence_build", ok: sentenceBuiltOk, detail: `count=${sentence_count} avgLen=${avg_sentence_length}` });

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
        error_message = msg;
        const low = msg.toLowerCase();
        // URL probe said OK but transcript can't be retrieved → granular T01
        if (low.includes("subtitles") || low.includes("no transcript") || low.includes("not find") || low.includes("disabled")) {
          failure_code = "T01";
        } else if (low.includes("timeout") || low.includes("network")) {
          failure_code = "V02";
        } else {
          failure_code = "P01";
        }
        download_status = "Failed";
        log({ step: "transcript_fetch", ok: false, detail: msg });
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
        video_url_status,
        http_status_code,
        download_status,
        download_size_mb,
        cache_hit,
        transcript_generated,
        transcript_length_chars,
        translation_generated,
        pipeline_logs: logs as any,
      } as any);
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
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
      if (sentenceBuilt && r.translation_success && r.quality_rating === "high") pipelineOk += 1;
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

    return { ok: true };
  });
