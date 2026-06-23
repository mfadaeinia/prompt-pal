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
  /**
   * Session-based funnel. Every step is a count of unique session_ids; no rows,
   * no users mixed in. Steps are monotonically clamped so a downstream step
   * can never exceed its upstream step.
   */
  funnel: {
    cohortLabel: string;
    /** Sessions that arrived (have at least one page_views row, or any downstream data). */
    visitors: number;
    /** Sessions that opened a video (have a video_sessions row). */
    videoOpened: number;
    /** Sessions whose max video duration_seconds >= 30. */
    watched30s: number;
    /** Sessions with at least one deliberate sentence_clicked event. */
    clickedSentence: number;
    /** Sessions that saved at least one expression or video. */
    savedSomething: number;
  };
  /**
   * Discovery funnel — designed to answer "why are users watching but not
   * clicking?" Every step is unique session_ids, monotonically clamped.
   */
  discovery: {
    videoOpened: number;
    watched30s: number;
    /** Sessions whose transcript scrolled into the viewport. */
    transcriptSeen: number;
    /** Sessions where the user hovered any sentence (desktop only). */
    hoveredSentence: number;
    clickedSentence: number;
    savedSomething: number;
  };
  /**
   * Primary discoverability metric.
   * firstClickRate = unique sessions with ≥1 sentence click / unique
   *   sessions watched ≥30s.
   */
  firstClick: {
    watched30s: number;
    clickedSessions: number;
    rate: number; // 0..1
    /** Sessions watched ≥30s but never clicked a sentence. */
    watchedNoClick: number;
    watchedNoClickPct: number; // 0..1 share of watched30s
  };
};

export const ACTIVATION_DURATION_SECONDS = 30;

export const getFounderMetrics = createServerFn({ method: "GET" }).handler(
  async (): Promise<FounderMetrics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [pv, vs, fb, ea, sx, svRows, le] = await Promise.all([
      supabaseAdmin.from("page_views" as any).select("session_id"),
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
      supabaseAdmin.from("saved_videos" as any).select("session_id"),
      supabaseAdmin
        .from("library_events" as any)
        .select("session_id,event_name")
        .in("event_name", [
          "sentence_clicked",
          "transcript_seen",
          "sentence_hovered",
        ]),
    ]);

    const pageViewRows = ((pv.data ?? []) as unknown) as Array<{ session_id: string | null }>;
    const sessions = ((vs.data ?? []) as unknown) as Array<{
      session_id: string;
      duration_seconds: number;
    }>;
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
    const savedExpr = ((sx.data ?? []) as unknown) as Array<{ session_id: string | null }>;
    const savedVids = ((svRows.data ?? []) as unknown) as Array<{ session_id: string | null }>;
    const allEventRows = ((le.data ?? []) as unknown) as Array<{
      session_id: string | null;
      event_name: string;
    }>;
    const clickRows = allEventRows.filter((r) => r.event_name === "sentence_clicked");
    const transcriptSeenRows = allEventRows.filter((r) => r.event_name === "transcript_seen");
    const hoveredRows = allEventRows.filter((r) => r.event_name === "sentence_hovered");

    // -------- Per-session video stats --------
    const maxDurationBySession = new Map<string, number>();
    for (const s of sessions) {
      const prev = maxDurationBySession.get(s.session_id) ?? 0;
      const cur = s.duration_seconds ?? 0;
      if (cur > prev) maxDurationBySession.set(s.session_id, cur);
    }

    const durations = sessions.map((s) => s.duration_seconds ?? 0);
    const totalSessions = sessions.length;
    const avgDurationSeconds = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    const longestDurationSeconds = durations.length ? Math.max(...durations) : 0;
    const sessionsOver60s = durations.filter((d) => d > 60).length;
    const sessionsOver5min = durations.filter((d) => d > 300).length;

    // -------- Funnel session sets --------
    const pageViewSessions = new Set(
      pageViewRows.map((r) => r.session_id).filter(Boolean) as string[],
    );
    const videoSessionIds = new Set(sessions.map((s) => s.session_id));
    const watched30Sessions = new Set<string>();
    for (const [sid, maxDur] of maxDurationBySession) {
      if (maxDur >= ACTIVATION_DURATION_SECONDS) watched30Sessions.add(sid);
    }
    const clickedSessions = new Set(
      clickRows.map((r) => r.session_id).filter(Boolean) as string[],
    );
    const savedExprSessions = new Set(
      savedExpr.map((r) => r.session_id).filter(Boolean) as string[],
    );
    const savedVidSessions = new Set(
      savedVids.map((r) => r.session_id).filter(Boolean) as string[],
    );
    const savedSessions = new Set<string>([...savedExprSessions, ...savedVidSessions]);

    // Backfill visitor count: any session that has data downstream but no
    // page_views row still counts as a visitor (pre-page_views history).
    const allKnownSessions = new Set<string>([
      ...pageViewSessions,
      ...videoSessionIds,
      ...clickedSessions,
      ...savedSessions,
    ]);

    const fVisitors = allKnownSessions.size;
    const fVideoOpened = Math.min(videoSessionIds.size, fVisitors);
    const fWatched30 = Math.min(watched30Sessions.size, fVideoOpened);
    const fClicked = Math.min(clickedSessions.size, fWatched30);
    const fSaved = Math.min(savedSessions.size, fClicked);

    // -------- Discovery funnel --------
    const transcriptSeenSessions = new Set(
      transcriptSeenRows.map((r) => r.session_id).filter(Boolean) as string[],
    );
    const hoveredSessions = new Set(
      hoveredRows.map((r) => r.session_id).filter(Boolean) as string[],
    );
    const dTranscriptSeen = Math.min(transcriptSeenSessions.size, fWatched30);
    const dHovered = Math.min(hoveredSessions.size, dTranscriptSeen);
    // Clicked is bound by hovered on desktop, but mobile has no hover — so
    // clamp only against the higher of (transcriptSeen, hovered) to avoid
    // visually hiding mobile clicks.
    const dClicked = Math.min(clickedSessions.size, fWatched30);
    const dSaved = Math.min(savedSessions.size, dClicked);

    // -------- First-click rate --------
    let watchedNoClick = 0;
    for (const sid of watched30Sessions) {
      if (!clickedSessions.has(sid)) watchedNoClick += 1;
    }
    const firstClickRate =
      watched30Sessions.size > 0 ? clickedSessions.size / watched30Sessions.size : 0;
    const watchedNoClickPct =
      watched30Sessions.size > 0 ? watchedNoClick / watched30Sessions.size : 0;

    const positive = feedback.filter((f) => f.feedback_type === "positive").length;
    const negative = feedback.filter((f) => f.feedback_type === "negative").length;
    const wouldUseAgain = {
      definitely: feedback.filter((f) => f.would_use_again === "definitely").length,
      maybe: feedback.filter((f) => f.would_use_again === "maybe").length,
      probably_not: feedback.filter((f) => f.would_use_again === "probably_not").length,
    };

    return {
      visitors: fVisitors,
      demoStarts: totalSessions,
      transcriptClicks: clickRows.length,
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
        cohortLabel: "unique sessions (all-time)",
        visitors: fVisitors,
        videoOpened: fVideoOpened,
        watched30s: fWatched30,
        clickedSentence: fClicked,
        savedSomething: fSaved,
      },
    };
  },
);
