import { createServerFn } from "@tanstack/react-start";

export type TranscriptReportRow = {
  id: string;
  created_at: string;
  video_id: string;
  video_url: string | null;
  video_title: string | null;
  transcript_source: string;
  language: string | null;
  sentence_count: number;
  avg_sentence_length: number;
  quality_score: string;
  quality_reasons: string[];
  full_learning_enabled: boolean;
  limited_mode_enabled: boolean;
  explanation_generation_enabled: boolean;
};

export type TranscriptQualityMetrics = {
  totalVideos: number;
  fullLearningPct: number;
  limitedModePct: number;
  mediumPct: number;
  explanationEnabledPct: number;
  sourceBreakdown: {
    cachePct: number;
    youtubePct: number;
    fallbackPct: number;
    manualPct: number;
  };
  avgSentenceCount: number;
  avgSentenceLength: number;
  recent: TranscriptReportRow[];
};

export const getTranscriptQualityMetrics = createServerFn({ method: "GET" }).handler(
  async (): Promise<TranscriptQualityMetrics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("video_transcript_reports" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const rows = ((data ?? []) as unknown) as TranscriptReportRow[];
    const total = rows.length;
    const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);

    const full = rows.filter((r) => r.full_learning_enabled).length;
    const limited = rows.filter((r) => r.limited_mode_enabled).length;
    const medium = rows.filter((r) => r.quality_score === "medium").length;
    const expl = rows.filter((r) => r.explanation_generation_enabled).length;

    const bySource = (s: string) => rows.filter((r) => r.transcript_source === s).length;
    const cache = bySource("cache");
    const youtube = bySource("youtube");
    const fallback = bySource("fallback");
    const manual = bySource("manual");

    const avgSentenceCount = total
      ? Math.round(rows.reduce((n, r) => n + (r.sentence_count ?? 0), 0) / total)
      : 0;
    const avgSentenceLength = total
      ? Math.round(
          (rows.reduce((n, r) => n + Number(r.avg_sentence_length ?? 0), 0) / total) * 10
        ) / 10
      : 0;

    return {
      totalVideos: total,
      fullLearningPct: pct(full),
      limitedModePct: pct(limited),
      mediumPct: pct(medium),
      explanationEnabledPct: pct(expl),
      sourceBreakdown: {
        cachePct: pct(cache),
        youtubePct: pct(youtube),
        fallbackPct: pct(fallback),
        manualPct: pct(manual),
      },
      avgSentenceCount,
      avgSentenceLength,
      recent: rows.slice(0, 50),
    };
  },
);
