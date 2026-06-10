import { createServerFn } from "@tanstack/react-start";

export type FounderMetrics = {
  visitors: number;
  demoStarts: number;
  transcriptClicks: number;
  feedbackCount: number;
  waitlistCount: number;
  video: {
    avgDurationSeconds: number;
    longestDurationSeconds: number;
    sessionsOver60s: number;
    sessionsOver5min: number;
    totalSessions: number;
  };
  feedback: {
    positive: number;
    negative: number;
    wouldUseAgain: { definitely: number; maybe: number; probably_not: number };
  };
  waitlist: {
    total: number;
    mostRecentAt: string | null;
    mostRecentEmail: string | null;
  };
};

export const getFounderMetrics = createServerFn({ method: "GET" }).handler(
  async (): Promise<FounderMetrics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [vs, fb, ea] = await Promise.all([
      supabaseAdmin.from("video_sessions" as any).select("session_id,duration_seconds"),
      supabaseAdmin
        .from("user_feedback" as any)
        .select("feedback_type,would_use_again,total_sentence_clicks,demo_started,session_id"),
      supabaseAdmin
        .from("early_access_signups" as any)
        .select("email,created_at")
        .order("created_at", { ascending: false }),
    ]);

    const sessions = ((vs.data ?? []) as unknown) as Array<{ session_id: string; duration_seconds: number }>;
    const feedback = ((fb.data ?? []) as unknown) as Array<{
      feedback_type: string;
      would_use_again: string | null;
      total_sentence_clicks: number | null;
      demo_started: boolean | null;
      session_id: string | null;
    }>;
    const signups = ((ea.data ?? []) as unknown) as Array<{ email: string; created_at: string }>;

    const durations = sessions.map((s) => s.duration_seconds ?? 0);
    const totalSessions = sessions.length;
    const avgDurationSeconds = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    const longestDurationSeconds = durations.length ? Math.max(...durations) : 0;
    const sessionsOver60s = durations.filter((d) => d > 60).length;
    const sessionsOver5min = durations.filter((d) => d > 300).length;

    const uniqueVideoSessionIds = new Set(sessions.map((s) => s.session_id));
    const uniqueFeedbackSessionIds = new Set(
      feedback.map((f) => f.session_id).filter(Boolean) as string[],
    );
    const visitors = new Set<string>([...uniqueVideoSessionIds, ...uniqueFeedbackSessionIds]).size;
    const demoStarts = totalSessions;
    const transcriptClicks = feedback.reduce((sum, f) => sum + (f.total_sentence_clicks ?? 0), 0);

    const positive = feedback.filter((f) => f.feedback_type === "positive").length;
    const negative = feedback.filter((f) => f.feedback_type === "negative").length;
    const wouldUseAgain = {
      definitely: feedback.filter((f) => f.would_use_again === "definitely").length,
      maybe: feedback.filter((f) => f.would_use_again === "maybe").length,
      probably_not: feedback.filter((f) => f.would_use_again === "probably_not").length,
    };

    return {
      visitors,
      demoStarts,
      transcriptClicks,
      feedbackCount: feedback.length,
      waitlistCount: signups.length,
      video: {
        avgDurationSeconds,
        longestDurationSeconds,
        sessionsOver60s,
        sessionsOver5min,
        totalSessions,
      },
      feedback: { positive, negative, wouldUseAgain },
      waitlist: {
        total: signups.length,
        mostRecentAt: signups[0]?.created_at ?? null,
        mostRecentEmail: signups[0]?.email ?? null,
      },
    };
  },
);
