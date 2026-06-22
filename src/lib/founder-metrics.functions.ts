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
    recent: Array<{
      created_at: string;
      feedback_type: string;
      feedback_text: string | null;
      would_use_again: string | null;
    }>;
  };
  waitlist: {
    total: number;
    mostRecentAt: string | null;
    mostRecentEmail: string | null;
  };
  funnel: {
    cohortLabel: string;
    visitors: number;
    startedLearning: number;
    clickedSentence: number;
    savedWord: number;
  };
};

export const getFounderMetrics = createServerFn({ method: "GET" }).handler(
  async (): Promise<FounderMetrics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [vs, fb, ea, sx, le] = await Promise.all([
      supabaseAdmin.from("video_sessions" as any).select("session_id,duration_seconds"),
      supabaseAdmin
        .from("user_feedback" as any)
        .select("created_at,feedback_type,would_use_again,total_sentence_clicks,demo_started,session_id,feedback_text")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("early_access_signups" as any)
        .select("email,created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("saved_expressions" as any).select("session_id"),
      supabaseAdmin
        .from("library_events" as any)
        .select("session_id,event_name")
        .eq("event_name", "sentence_clicked"),
    ]);

    const sessions = ((vs.data ?? []) as unknown) as Array<{ session_id: string; duration_seconds: number }>;
    const feedback = ((fb.data ?? []) as unknown) as Array<{
      created_at: string;
      feedback_type: string;
      would_use_again: string | null;
      total_sentence_clicks: number | null;
      demo_started: boolean | null;
      session_id: string | null;
      feedback_text: string | null;
    }>;
    const signups = ((ea.data ?? []) as unknown) as Array<{ email: string; created_at: string }>;
    const savedRows = ((sx.data ?? []) as unknown) as Array<{ session_id: string | null }>;

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

    // Funnel: unique sessions per stage, monotonically clamped so a
    // later stage can never exceed an earlier one.
    const startedSessions = uniqueVideoSessionIds;
    const clickedSessions = new Set(
      feedback
        .filter((f) => (f.total_sentence_clicks ?? 0) > 0)
        .map((f) => f.session_id)
        .filter(Boolean) as string[],
    );
    const savedSessions = new Set(
      savedRows.map((r) => r.session_id).filter(Boolean) as string[],
    );

    const fVisitors = visitors;
    const fStarted = Math.min(startedSessions.size, fVisitors);
    const fClicked = Math.min(clickedSessions.size, fStarted);
    const fSaved = Math.min(savedSessions.size, fClicked);

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
      feedback: {
        positive,
        negative,
        wouldUseAgain,
        recent: feedback.slice(0, 8).map((f) => ({
          created_at: f.created_at,
          feedback_type: f.feedback_type,
          feedback_text: f.feedback_text,
          would_use_again: f.would_use_again,
        })),
      },
      waitlist: {
        total: signups.length,
        mostRecentAt: signups[0]?.created_at ?? null,
        mostRecentEmail: signups[0]?.email ?? null,
      },
      funnel: {
        cohortLabel: "unique sessions",
        visitors: fVisitors,
        startedLearning: fStarted,
        clickedSentence: fClicked,
        savedWord: fSaved,
      },
    };
  },
);
