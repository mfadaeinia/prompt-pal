import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------------- Types ----------------

export type FailureCode =
  | "T01" // No transcript found
  | "T02" // Transcript empty
  | "T03" // Transcript too short
  | "S01" // Too few sentences generated
  | "S02" // Giant merged sentence (>100 words in any one)
  | "S03" // Missing sentence boundaries (avg too high w/ very few sentences)
  | "L01" // Translation failed
  | "U01"; // UI / processing failure

export const FAILURE_LABELS: Record<FailureCode, string> = {
  T01: "T01 — No transcript found",
  T02: "T02 — Transcript empty",
  T03: "T03 — Transcript too short",
  S01: "S01 — Too few sentences",
  S02: "S02 — Giant merged sentence",
  S03: "S03 — Missing sentence boundaries",
  L01: "L01 — Translation failed",
  U01: "U01 — Processing failure",
};

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
        .select("*")
        .eq("run_id", run.id);
      if (r.error) throw new Error(r.error.message);
      results = (r.data ?? []) as unknown as BenchmarkResultRow[];
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

// ---------------- Runner ----------------

const RunInput = z.object({
  mode: z.enum(["quick", "full"]),
  releaseVersion: z.string().max(80).optional(),
});

function wc(s: string) {
  const t = (s || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

export const runBenchmark = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RunInput.parse(d))
  .handler(async ({ data }): Promise<{ runId: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchTranscript } = await import("@/lib/transcript.functions");
    const { explainSentence } = await import("@/lib/explain.functions");

    // 1. Pick the dataset
    const limit = data.mode === "quick" ? 10 : 200;
    const { data: videos, error: vErr } = await supabaseAdmin
      .from("benchmark_videos" as any)
      .select("*")
      .eq("active", true)
      .order("category", { ascending: true })
      .limit(limit);
    if (vErr) throw new Error(vErr.message);
    const list = ((videos ?? []) as unknown) as BenchmarkVideoRow[];
    if (!list.length) throw new Error("No active benchmark videos. Seed the dataset first.");

    // 2. Create run row
    const startedAt = new Date().toISOString();
    const { data: runRow, error: rErr } = await supabaseAdmin
      .from("benchmark_runs" as any)
      .insert({
        mode: data.mode,
        status: "running",
        release_version: data.releaseVersion ?? null,
        total_videos: list.length,
        started_at: startedAt,
      } as any)
      .select("*")
      .single();
    if (rErr) throw new Error(rErr.message);
    const runId = (runRow as any).id as string;

    // 3. Process videos sequentially to avoid rate-limit storms
    let transcriptOk = 0;
    let sentenceOk = 0;
    let translationOk = 0;
    let pipelineOk = 0;

    for (const v of list) {
      const t0 = Date.now();
      let transcript_found = false;
      let transcript_source: string | null = null;
      let transcript_word_count = 0;
      let sentence_count = 0;
      let avg_sentence_length = 0;
      let longest_sentence_words = 0;
      let coverage_percent = 0;
      let translation_success = false;
      let failure_code: FailureCode | null = null;
      let error_message: string | null = null;

      try {
        const tr = await fetchTranscript({ data: { url: v.youtube_url } });
        transcript_found = true;
        transcript_source = tr.source;
        const sentences = tr.sentences ?? [];
        sentence_count = sentences.length;

        const wordsPerSentence = sentences.map((s) => wc(s.text));
        const totalSentenceWords = wordsPerSentence.reduce((a, b) => a + b, 0);
        longest_sentence_words = wordsPerSentence.reduce((m, n) => Math.max(m, n), 0);
        avg_sentence_length = sentence_count
          ? Number((totalSentenceWords / sentence_count).toFixed(2))
          : 0;
        transcript_word_count = totalSentenceWords;
        coverage_percent =
          totalSentenceWords > 0 ? 100 : 0; // sentences already are the transcript output

        // Failure code assignment (transcript-side)
        if (transcript_word_count === 0) {
          failure_code = "T02";
        } else if (transcript_word_count < 50) {
          failure_code = "T03";
        } else if (sentence_count < 5) {
          failure_code = "S01";
        } else if (longest_sentence_words > 100) {
          failure_code = "S02";
        } else if (avg_sentence_length > 50 && sentence_count < 10) {
          failure_code = "S03";
        }

        const sentenceBuiltOk = !failure_code && sentence_count >= 5;

        // Translation check on the first reasonable sentence
        if (sentenceBuiltOk) {
          const sample = sentences.find((s) => wc(s.text) >= 4) ?? sentences[0];
          try {
            const ex = await explainSentence({
              data: { sentence: sample.text.slice(0, 800), targetLanguage: "English" },
            });
            const err = (ex as { error?: string }).error;
            translation_success = !err && (ex.explanation?.length ?? 0) > 10;
            if (!translation_success && !failure_code) failure_code = "L01";
          } catch (e) {
            translation_success = false;
            if (!failure_code) failure_code = "L01";
            error_message = e instanceof Error ? e.message : String(e);
          }
        }
      } catch (e) {
        error_message = e instanceof Error ? e.message : String(e);
        // Classify retrieval errors
        const msg = (error_message ?? "").toLowerCase();
        if (msg.includes("subtitles") || msg.includes("no transcript") || msg.includes("not find")) {
          failure_code = "T01";
        } else if (!failure_code) {
          failure_code = "U01";
        }
      }

      const { rating, reason } = classifyQuality({
        sentenceCount: sentence_count,
        avgSentenceLength: avg_sentence_length,
        coveragePercent: coverage_percent,
        transcriptFound: transcript_found,
      });

      const sentenceBuilt =
        transcript_found && sentence_count >= 5 && !["S01", "S02", "S03"].includes(failure_code ?? "");
      const pipelineFull =
        sentenceBuilt && translation_success && rating === "high";

      if (transcript_found) transcriptOk += 1;
      if (sentenceBuilt) sentenceOk += 1;
      if (translation_success) translationOk += 1;
      if (pipelineFull) pipelineOk += 1;

      const processing_time_ms = Date.now() - t0;

      const { error: insErr } = await supabaseAdmin
        .from("benchmark_video_results" as any)
        .insert({
          run_id: runId,
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
        } as any);
      if (insErr) console.warn("[benchmark] result insert error", insErr.message);
    }

    const total = list.length;
    const pct = (n: number) => Number(((n / total) * 100).toFixed(2));
    const finishedAt = new Date().toISOString();
    const { error: upErr } = await supabaseAdmin
      .from("benchmark_runs" as any)
      .update({
        status: "completed",
        finished_at: finishedAt,
        transcript_success_count: transcriptOk,
        sentence_success_count: sentenceOk,
        translation_success_count: translationOk,
        pipeline_success_count: pipelineOk,
        transcript_success_rate: pct(transcriptOk),
        sentence_success_rate: pct(sentenceOk),
        translation_success_rate: pct(translationOk),
        pipeline_success_rate: pct(pipelineOk),
      } as any)
      .eq("id", runId);
    if (upErr) console.warn("[benchmark] run update error", upErr.message);

    return { runId };
  });
