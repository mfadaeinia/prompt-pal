import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type TruthLabel = "accurate" | "mostly_accurate" | "incorrect" | "not_reviewed";

export type ReviewQueueItem = {
  id: string;
  run_id: string;
  created_at: string;
  category: string;
  video_id: string;
  video_url: string;
  video_title: string | null;
  transcript_source: string | null;
  transcript_preview: string | null;
  quality_rating: "high" | "medium" | "low";
  sentence_count: number;
  transcript_word_count: number;
  reviewed_by_founder: boolean;
  reviewed_at: string | null;
  transcript_truth_label: TruthLabel;
  sampling_bucket: "high" | "medium" | "low" | null;
};

export type ReviewDetail = ReviewQueueItem & {
  transcript_text: string | null;
  avg_sentence_length: number;
  longest_sentence_words: number;
  coverage_percent: number;
  translation_success: boolean;
  failure_code: string | null;
  quality_reason: string | null;
  review_notes: string | null;
};

export type SourceAccuracyRow = {
  source: string;
  reviewed: number;
  accurate: number;
  mostly_accurate: number;
  incorrect: number;
  accuracy_pct: number;
};

export type AccuracyMetrics = {
  totalReviewed: number;
  accurateCount: number;
  mostlyAccurateCount: number;
  incorrectCount: number;
  accuracyPct: number;
  bySource: SourceAccuracyRow[];
  latestRun: {
    runId: string | null;
    generationSuccessPct: number;
    qualityScorePct: number;
    accuracyPct: number;
    reviewedInRun: number;
  };
  insights: string[];
};

const QueueInput = z.object({
  score: z.enum(["high", "medium", "low", "all"]).default("all"),
  source: z.string().default("all"),
  reviewed: z.enum(["all", "unreviewed", "reviewed"]).default("unreviewed"),
  limit: z.number().int().min(1).max(200).default(50),
});

export const getTranscriptReviewQueue = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => QueueInput.parse(d ?? {}))
  .handler(async ({ data }): Promise<ReviewQueueItem[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("benchmark_video_results" as any)
      .select(
        "id, run_id, created_at, category, transcript_source, transcript_preview, quality_rating, sentence_count, transcript_word_count, reviewed_by_founder, reviewed_at, transcript_truth_label, sampling_bucket, benchmark_video_id",
      )
      .order("sampling_bucket", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.score !== "all") q = q.eq("quality_rating", data.score);
    if (data.source !== "all") q = q.eq("transcript_source", data.source);
    if (data.reviewed === "unreviewed") q = q.eq("reviewed_by_founder", false);
    if (data.reviewed === "reviewed") q = q.eq("reviewed_by_founder", true);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as any[];
    const videoIds = Array.from(new Set(list.map((r) => r.benchmark_video_id)));
    let titleMap = new Map<string, { url: string; title: string | null; video_id: string }>();
    if (videoIds.length) {
      const { data: vids } = await supabaseAdmin
        .from("benchmark_videos" as any)
        .select("id, youtube_url, video_id, title")
        .in("id", videoIds);
      for (const v of (vids ?? []) as any[]) {
        titleMap.set(v.id, { url: v.youtube_url, title: v.title, video_id: v.video_id });
      }
    }

    return list.map((r) => {
      const v = titleMap.get(r.benchmark_video_id);
      return {
        id: r.id,
        run_id: r.run_id,
        created_at: r.created_at,
        category: r.category,
        video_id: v?.video_id ?? "",
        video_url: v?.url ?? "",
        video_title: v?.title ?? null,
        transcript_source: r.transcript_source,
        transcript_preview: r.transcript_preview,
        quality_rating: r.quality_rating,
        sentence_count: r.sentence_count,
        transcript_word_count: r.transcript_word_count,
        reviewed_by_founder: r.reviewed_by_founder,
        reviewed_at: r.reviewed_at,
        transcript_truth_label: r.transcript_truth_label as TruthLabel,
        sampling_bucket: r.sampling_bucket,
      };
    });
  });

const DetailInput = z.object({ resultId: z.string().uuid() });

export const getTranscriptReviewDetail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DetailInput.parse(d))
  .handler(async ({ data }): Promise<ReviewDetail> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin
      .from("benchmark_video_results" as any)
      .select("*")
      .eq("id", data.resultId)
      .single();
    if (error) throw new Error(error.message);
    const row = r as any;
    const { data: v } = await supabaseAdmin
      .from("benchmark_videos" as any)
      .select("youtube_url, video_id, title")
      .eq("id", row.benchmark_video_id)
      .single();
    const vid = (v ?? {}) as any;
    return {
      id: row.id,
      run_id: row.run_id,
      created_at: row.created_at,
      category: row.category,
      video_id: vid.video_id ?? "",
      video_url: vid.youtube_url ?? "",
      video_title: vid.title ?? null,
      transcript_source: row.transcript_source,
      transcript_preview: row.transcript_preview,
      quality_rating: row.quality_rating,
      sentence_count: row.sentence_count,
      transcript_word_count: row.transcript_word_count,
      reviewed_by_founder: row.reviewed_by_founder,
      reviewed_at: row.reviewed_at,
      transcript_truth_label: row.transcript_truth_label,
      sampling_bucket: row.sampling_bucket,
      transcript_text: row.transcript_text,
      avg_sentence_length: Number(row.avg_sentence_length ?? 0),
      longest_sentence_words: row.longest_sentence_words ?? 0,
      coverage_percent: Number(row.coverage_percent ?? 0),
      translation_success: row.translation_success,
      failure_code: row.failure_code,
      quality_reason: row.quality_reason,
      review_notes: row.review_notes,
    };
  });

const LabelInput = z.object({
  resultId: z.string().uuid(),
  label: z.enum(["accurate", "mostly_accurate", "incorrect", "not_reviewed"]),
  notes: z.string().max(2000).optional(),
});

export const setTranscriptTruthLabel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LabelInput.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const reviewed = data.label !== "not_reviewed";
    const { error } = await supabaseAdmin
      .from("benchmark_video_results" as any)
      .update({
        transcript_truth_label: data.label,
        reviewed_by_founder: reviewed,
        reviewed_at: reviewed ? new Date().toISOString() : null,
        review_notes: data.notes ?? null,
      } as any)
      .eq("id", data.resultId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getTranscriptAccuracyMetrics = createServerFn({ method: "GET" }).handler(
  async (): Promise<AccuracyMetrics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("benchmark_video_results" as any)
      .select(
        "run_id, transcript_source, transcript_truth_label, reviewed_by_founder, quality_rating, transcript_found, category",
      )
      .eq("reviewed_by_founder", true);
    if (error) throw new Error(error.message);
    const reviewed = (rows ?? []) as any[];

    const totalReviewed = reviewed.length;
    const accurateCount = reviewed.filter((r) => r.transcript_truth_label === "accurate").length;
    const mostlyAccurateCount = reviewed.filter((r) => r.transcript_truth_label === "mostly_accurate").length;
    const incorrectCount = reviewed.filter((r) => r.transcript_truth_label === "incorrect").length;
    const accuracyPct = totalReviewed
      ? Math.round((accurateCount / totalReviewed) * 1000) / 10
      : 0;

    const sources = Array.from(new Set(reviewed.map((r) => r.transcript_source ?? "unknown")));
    const bySource: SourceAccuracyRow[] = sources
      .map((s) => {
        const rs = reviewed.filter((r) => (r.transcript_source ?? "unknown") === s);
        const acc = rs.filter((r) => r.transcript_truth_label === "accurate").length;
        const mostly = rs.filter((r) => r.transcript_truth_label === "mostly_accurate").length;
        const inc = rs.filter((r) => r.transcript_truth_label === "incorrect").length;
        return {
          source: s,
          reviewed: rs.length,
          accurate: acc,
          mostly_accurate: mostly,
          incorrect: inc,
          accuracy_pct: rs.length ? Math.round((acc / rs.length) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.reviewed - a.reviewed);

    // Latest run comparison
    const { data: runRow } = await supabaseAdmin
      .from("benchmark_runs" as any)
      .select("id, transcript_success_rate, pipeline_success_rate")
      .eq("status", "completed")
      .order("run_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const latestRunId = (runRow as any)?.id ?? null;
    const generationSuccessPct = Number((runRow as any)?.transcript_success_rate ?? 0);
    let qualityScorePct = 0;
    let accuracyInRunPct = 0;
    let reviewedInRun = 0;
    if (latestRunId) {
      const { data: runResults } = await supabaseAdmin
        .from("benchmark_video_results" as any)
        .select("quality_rating, transcript_truth_label, reviewed_by_founder, transcript_found")
        .eq("run_id", latestRunId);
      const list = (runResults ?? []) as any[];
      const found = list.filter((r) => r.transcript_found);
      const highQ = found.filter((r) => r.quality_rating === "high").length;
      qualityScorePct = found.length
        ? Math.round((highQ / found.length) * 1000) / 10
        : 0;
      const runReviewed = list.filter((r) => r.reviewed_by_founder);
      reviewedInRun = runReviewed.length;
      const runAcc = runReviewed.filter((r) => r.transcript_truth_label === "accurate").length;
      accuracyInRunPct = runReviewed.length
        ? Math.round((runAcc / runReviewed.length) * 1000) / 10
        : 0;
    }

    // Rule-based insights
    const insights: string[] = [];
    if (totalReviewed >= 5) {
      const worst = [...bySource].filter((s) => s.reviewed >= 3).sort((a, b) => a.accuracy_pct - b.accuracy_pct)[0];
      const best = [...bySource].filter((s) => s.reviewed >= 3).sort((a, b) => b.accuracy_pct - a.accuracy_pct)[0];
      if (best) insights.push(`${best.source} transcripts are ${best.accuracy_pct}% accurate (${best.reviewed} reviewed).`);
      if (worst && worst.source !== best?.source)
        insights.push(`Lowest accuracy comes from ${worst.source} (${worst.accuracy_pct}%).`);
      if (incorrectCount > 0)
        insights.push(`${incorrectCount} of ${totalReviewed} reviewed transcripts were marked incorrect.`);
      if (generationSuccessPct - accuracyPct > 10)
        insights.push(
          `Generation success (${generationSuccessPct}%) is higher than accuracy (${accuracyPct}%) — transcripts exist but don't always match the audio.`,
        );
      // Per-category insight
      const cats = Array.from(new Set(reviewed.map((r) => r.category)));
      const catStats = cats
        .map((c) => {
          const rs = reviewed.filter((r) => r.category === c);
          const acc = rs.filter((r) => r.transcript_truth_label === "accurate").length;
          return { c, n: rs.length, pct: rs.length ? (acc / rs.length) * 100 : 0 };
        })
        .filter((x) => x.n >= 3)
        .sort((a, b) => a.pct - b.pct);
      if (catStats.length && catStats[0].pct < 70)
        insights.push(`${catStats[0].c} videos show lower accuracy (${catStats[0].pct.toFixed(0)}%).`);
    } else {
      insights.push(`Only ${totalReviewed} transcript${totalReviewed === 1 ? "" : "s"} reviewed — review more to unlock insights.`);
    }

    return {
      totalReviewed,
      accurateCount,
      mostlyAccurateCount,
      incorrectCount,
      accuracyPct,
      bySource,
      latestRun: {
        runId: latestRunId,
        generationSuccessPct,
        qualityScorePct,
        accuracyPct: accuracyInRunPct,
        reviewedInRun,
      },
      insights,
    };
  },
);
