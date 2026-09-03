import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { bucketSource, matchesSource, type SourceBucket } from "./source-bucket";

export type FounderMetrics = {
  windowLabel: string;
  range: { from: string | null; to: string | null; source: SourceBucket };
  visitors: number;
  demoStarts: number;
  transcriptClicks: number;
  feedbackCount: number;
  waitlistCount: number;
  /** Reconciliation: raw page_views rows in window (matches analytics). */
  rawPageViewRows: number;
  /** Bucket breakdown for current window (informational). */
  sourceBreakdown: Array<{ bucket: string; sessions: number }>;
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
    videoOpened: number;
    watched30s: number;
    clickedSentence: number;
    savedSomething: number;
  };
  discovery: {
    videoOpened: number;
    watched30s: number;
    transcriptSeen: number;
    hoveredSentence: number;
    clickedSentence: number;
    savedSomething: number;
  };
  firstClick: {
    watched30s: number;
    clickedSessions: number;
    rate: number;
    watchedNoClick: number;
    watchedNoClickPct: number;
  };
  /** Activation (session): sessions that BOTH watched ≥30s AND clicked a sentence (same session). */
  activationSession: {
    eligible: number; // sessions with any activity in window
    activated: number;
    rate: number;
  };
  /**
   * PRIMARY product funnel (sessions): watch → need help → request explanation
   * → get unstuck → continue → next video. Rows only exist from
   * FUNNEL_TRACKING_START_ISO onward.
   */
  primary: {
    trackingStartedAt: string;
    coversTrackedPeriod: boolean;
    visitors: number;
    videoOpened: number;
    watched30s: number;
    explanationRequested: number;
    continuedAfterExplanation: number;
    anotherVideoStarted: number;
  };
  /** Anonymous VISITOR level metrics (anonymous_id). Limited before ANON_TRACKING_START_ISO. */
  anonymous: {
    trackingStartedAt: string;
    unique: number;
    newVisitors: number;
    returningVisitors: number;
    returnedAnotherDay: number;
    d1: { returned: number; eligible: number };
    d7: { returned: number; eligible: number };
  };
  /** One row per calendar day (UTC date key) for the trend chart. */
  daily: Array<{
    date: string;
    visitors: number;
    videoStarts: number;
    watched30s: number;
    explanations: number;
    anotherVideo: number;
  }>;
};

export const ACTIVATION_DURATION_SECONDS = 30;

/** First day the primary funnel events were persisted to the database. */
export const FUNNEL_TRACKING_START_ISO = "2026-08-18T00:00:00.000Z";
/** First day anonymous_id was written to analytics rows. */
export const ANON_TRACKING_START_ISO = "2026-08-11T00:00:00.000Z";

const PRIMARY_EVENTS = [
  "video_started",
  "video_watched_30s",
  "subtitle_explanation_requested",
  "video_resumed_after_explanation",
  "another_video_started",
] as const;

const FilterInput = z.object({
  from: z.string().datetime().nullable().optional(),
  to: z.string().datetime().nullable().optional(),
  source: z
    .enum(["all", "instagram", "facebook", "reddit", "google", "direct", "unknown"])
    .default("all"),
  device: z.enum(["all", "desktop", "mobile", "tablet"]).default("all"),
  experience: z.enum(["all", "public", "passive_learning_experiment"]).default("all"),
  /** exclude = drop rows explicitly flagged internal (founder/debug/test traffic). */
  internal: z.enum(["exclude", "include"]).default("exclude"),
});

type SourceRow = { acquisition_source?: string | null; utm_source?: string | null };

function applyDateRange<T extends { gte: any; lte: any }>(
  q: T,
  from: string | null | undefined,
  to: string | null | undefined,
  col = "created_at",
): T {
  let out: any = q;
  if (from) out = out.gte(col, from);
  if (to) out = out.lte(col, to);
  return out;
}

function windowLabelFor(from: string | null | undefined, to: string | null | undefined): string {
  if (!from && !to) return "all time";
  if (from && to) return `${from.slice(0, 10)} → ${to.slice(0, 10)}`;
  if (from) return `since ${from.slice(0, 10)}`;
  return `until ${to!.slice(0, 10)}`;
}

export const getFounderMetrics = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => FilterInput.parse(d ?? {}))
  .handler(async ({ data }): Promise<FounderMetrics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { from, to, source } = data;

    // Pull rows with source columns; date-filter at DB level.
    const [pv, vs, fb, ea, sx, svRows, le, pe, anonHistory] = await Promise.all([
      applyDateRange(
        supabaseAdmin
          .from("page_views" as any)
          .select("session_id,anonymous_id,acquisition_source,utm_source,created_at"),
        from,
        to,
      ),
      applyDateRange(
        supabaseAdmin
          .from("video_sessions" as any)
          .select(
            "session_id,duration_seconds,acquisition_source,utm_source,created_at",
          ),
        from,
        to,
      ),
      applyDateRange(
        supabaseAdmin
          .from("user_feedback" as any)
          .select(
            "created_at,feedback_type,would_use_again,total_sentence_clicks,demo_started,session_id,feedback_text",
          )
          .order("created_at", { ascending: false }),
        from,
        to,
      ),
      applyDateRange(
        supabaseAdmin
          .from("early_access_signups" as any)
          .select("email,created_at")
          .order("created_at", { ascending: false }),
        from,
        to,
      ),
      applyDateRange(
        supabaseAdmin
          .from("saved_expressions" as any)
          .select("session_id,acquisition_source,utm_source,created_at"),
        from,
        to,
      ),
      applyDateRange(
        supabaseAdmin
          .from("saved_videos" as any)
          .select("session_id,acquisition_source,utm_source,created_at"),
        from,
        to,
      ),
      applyDateRange(
        supabaseAdmin
          .from("library_events" as any)
          .select("session_id,event_name,acquisition_source,utm_source,created_at")
          .in("event_name", [
            "sentence_clicked",
            "transcript_seen",
            "sentence_hovered",
          ]),
        from,
        to,
      ),
      // Primary funnel events (persisted since FUNNEL_TRACKING_START_ISO).
      applyDateRange(
        supabaseAdmin
          .from("library_events" as any)
          .select(
            "session_id,anonymous_id,event_name,metadata,acquisition_source,utm_source,created_at",
          )
          .in("event_name", PRIMARY_EVENTS as unknown as string[]),
        from,
        to,
      ),
      // Anonymous visitor history (needed for return-visit / D1 / D7). Small
      // table slice: only rows that actually carry an anonymous_id.
      supabaseAdmin
        .from("page_views" as any)
        .select("anonymous_id,created_at")
        .not("anonymous_id", "is", null)
        .order("created_at", { ascending: true })
        .limit(20000),
    ]);

    type Row<T> = T & SourceRow;
    const filter = <T extends SourceRow>(rows: T[]): T[] =>
      source === "all" ? rows : rows.filter((r) => matchesSource(r, source));

    const pageViewRows = filter(((pv.data ?? []) as unknown) as Row<{
      session_id: string | null;
    }>[]);
    const sessions = filter(((vs.data ?? []) as unknown) as Row<{
      session_id: string;
      duration_seconds: number;
    }>[]);
    const feedback = ((fb.data ?? []) as unknown) as Array<{
      created_at: string;
      feedback_type: string;
      would_use_again: string | null;
      total_sentence_clicks: number | null;
      demo_started: boolean | null;
      session_id: string | null;
      feedback_text: string | null;
    }>;
    const signups = ((ea.data ?? []) as unknown) as Array<{
      email: string;
      created_at: string;
    }>;
    const savedExpr = filter(((sx.data ?? []) as unknown) as Row<{
      session_id: string | null;
    }>[]);
    const savedVids = filter(((svRows.data ?? []) as unknown) as Row<{
      session_id: string | null;
    }>[]);
    const allEventRows = filter(((le.data ?? []) as unknown) as Row<{
      session_id: string | null;
      event_name: string;
    }>[]);

    const clickRows = allEventRows.filter((r) => r.event_name === "sentence_clicked");
    const transcriptSeenRows = allEventRows.filter((r) => r.event_name === "transcript_seen");
    const hoveredRows = allEventRows.filter((r) => r.event_name === "sentence_hovered");

    // Per-session video stats
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

    // Funnel session sets
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
    const savedSessions = new Set<string>([
      ...(savedExpr.map((r) => r.session_id).filter(Boolean) as string[]),
      ...(savedVids.map((r) => r.session_id).filter(Boolean) as string[]),
    ]);

    const allKnownSessions = new Set<string>([
      ...pageViewSessions,
      ...videoSessionIds,
      ...clickedSessions,
      ...savedSessions,
    ]);

    // TRUE SET INTERSECTION at every step — clamping with Math.min() used to
    // manufacture a monotonic funnel and hid real ordering problems.
    const intersect = (a: Set<string>, b: Set<string>) => {
      const out = new Set<string>();
      for (const v of a) if (b.has(v)) out.add(v);
      return out;
    };
    const fVisitors = allKnownSessions.size;
    const openedSet = intersect(videoSessionIds, allKnownSessions);
    const watched30Set = intersect(watched30Sessions, openedSet);
    const clickedSet = intersect(clickedSessions, watched30Set);
    const savedSet = intersect(savedSessions, clickedSet);
    const fVideoOpened = openedSet.size;
    const fWatched30 = watched30Set.size;
    let activatedSessions = 0;
    for (const sid of watched30Sessions) if (clickedSessions.has(sid)) activatedSessions += 1;
    const fClicked = clickedSet.size;
    const fSaved = savedSet.size;

    // Discovery
    const transcriptSeenSessions = new Set(
      transcriptSeenRows.map((r) => r.session_id).filter(Boolean) as string[],
    );
    const hoveredSessions = new Set(
      hoveredRows.map((r) => r.session_id).filter(Boolean) as string[],
    );
    const transcriptSeenSet = intersect(transcriptSeenSessions, watched30Set);
    const hoveredSet = intersect(hoveredSessions, transcriptSeenSet);
    const dClickedSet = intersect(clickedSessions, watched30Set);
    const dSavedSet = intersect(savedSessions, dClickedSet);
    const dTranscriptSeen = transcriptSeenSet.size;
    const dHovered = hoveredSet.size;
    const dClicked = dClickedSet.size;
    const dSaved = dSavedSet.size;

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

    // Source breakdown (informational; computed against UNFILTERED rows for the window)
    const allPv = ((pv.data ?? []) as unknown) as Row<{ session_id: string | null }>[];
    const breakdown = new Map<string, Set<string>>();
    for (const r of allPv) {
      if (!r.session_id) continue;
      const b = bucketSource(r);
      if (!breakdown.has(b)) breakdown.set(b, new Set());
      breakdown.get(b)!.add(r.session_id);
    }
    const sourceBreakdown = Array.from(breakdown.entries())
      .map(([bucket, set]) => ({ bucket, sessions: set.size }))
      .sort((a, b) => b.sessions - a.sessions);

    // ---- PRIMARY FUNNEL (session level, from persisted watch events) -------
    type PrimaryRow = Row<{
      session_id: string | null;
      anonymous_id: string | null;
      event_name: string;
      metadata: Record<string, any> | null;
      created_at: string;
    }>;
    const primaryRowsAll = ((pe.data ?? []) as unknown) as PrimaryRow[];
    const primaryRows = filter(primaryRowsAll).filter((r) => {
      const md = r.metadata ?? {};
      if (data.internal === "exclude" && md.is_internal === true) return false;
      if (data.device !== "all" && md.device_type && md.device_type !== data.device) return false;
      if (
        data.experience !== "all" &&
        md.experience_type &&
        md.experience_type !== data.experience
      )
        return false;
      return true;
    });
    const sessionsWith = (event: string) =>
      new Set(
        primaryRows
          .filter((r) => r.event_name === event)
          .map((r) => r.session_id)
          .filter(Boolean) as string[],
      );
    const pStarted = sessionsWith("video_started");
    const pWatched30 = sessionsWith("video_watched_30s");
    const pAsked = sessionsWith("subtitle_explanation_requested");
    const pContinued = sessionsWith("video_resumed_after_explanation");
    const pAnother = sessionsWith("another_video_started");
    // Each step is scoped to the sessions that reached the previous step, so
    // denominators are honest.
    const inter = (a: Set<string>, b: Set<string>) => {
      const out = new Set<string>();
      for (const v of a) if (b.has(v)) out.add(v);
      return out;
    };
    const s2 = inter(pWatched30, pStarted);
    const s3 = inter(pAsked, s2);
    const s4 = inter(pContinued, s3);
    const s5 = inter(pAnother, s3);
    const trackingCoversWindow = !from || new Date(from).getTime() >= new Date(FUNNEL_TRACKING_START_ISO).getTime();

    // ---- ANONYMOUS VISITORS ------------------------------------------------
    const anonRowsWindow = filter(
      ((pv.data ?? []) as unknown) as Row<{ anonymous_id: string | null; created_at: string }>[],
    );
    const anonInWindow = new Set(
      anonRowsWindow.map((r) => r.anonymous_id).filter(Boolean) as string[],
    );
    const anonHist = ((anonHistory.data ?? []) as unknown) as Array<{
      anonymous_id: string;
      created_at: string;
    }>;
    const dayKey = (iso: string) => iso.slice(0, 10);
    const daysByAnon = new Map<string, Set<string>>();
    const firstSeenByAnon = new Map<string, number>();
    for (const r of anonHist) {
      if (!r.anonymous_id) continue;
      if (!daysByAnon.has(r.anonymous_id)) daysByAnon.set(r.anonymous_id, new Set());
      daysByAnon.get(r.anonymous_id)!.add(dayKey(r.created_at));
      const t = new Date(r.created_at).getTime();
      const prev = firstSeenByAnon.get(r.anonymous_id);
      if (prev === undefined || t < prev) firstSeenByAnon.set(r.anonymous_id, t);
    }
    const windowStartMs = from ? new Date(from).getTime() : 0;
    let anonNew = 0;
    let anonReturning = 0;
    let returnedAnotherDay = 0;
    let d1Returned = 0;
    let d1Eligible = 0;
    let d7Returned = 0;
    let d7Eligible = 0;
    const DAY = 86400_000;
    const nowMs = Date.now();
    for (const id of anonInWindow) {
      const first = firstSeenByAnon.get(id) ?? windowStartMs;
      if (first >= windowStartMs) anonNew += 1;
      else anonReturning += 1;
      const days = daysByAnon.get(id) ?? new Set<string>();
      if (days.size > 1) returnedAnotherDay += 1;
      const firstDay = dayKey(new Date(first).toISOString());
      const hasLater = (minDays: number, maxDays: number) => {
        for (const d of days) {
          const diff = Math.round((new Date(d + "T00:00:00.000Z").getTime() - new Date(firstDay + "T00:00:00.000Z").getTime()) / DAY);
          if (diff >= minDays && diff <= maxDays) return true;
        }
        return false;
      };
      // Only count visitors who have had the chance to come back.
      if (nowMs - first >= DAY) {
        d1Eligible += 1;
        if (hasLater(1, 1)) d1Returned += 1;
      }
      if (nowMs - first >= 7 * DAY) {
        d7Eligible += 1;
        if (hasLater(2, 7)) d7Returned += 1;
      }
    }

    // ---- DAILY SERIES ------------------------------------------------------
    const dailyMap = new Map<
      string,
      { visitors: Set<string>; videoStarts: Set<string>; watched30s: Set<string>; explanations: number; anotherVideo: number }
    >();
    const ensureDay = (d: string) => {
      let row = dailyMap.get(d);
      if (!row) {
        row = {
          visitors: new Set(),
          videoStarts: new Set(),
          watched30s: new Set(),
          explanations: 0,
          anotherVideo: 0,
        };
        dailyMap.set(d, row);
      }
      return row;
    };
    for (const r of filter(
      ((pv.data ?? []) as unknown) as Row<{ session_id: string | null; created_at: string }>[],
    )) {
      if (!r.session_id) continue;
      ensureDay(dayKey(r.created_at)).visitors.add(r.session_id);
    }
    for (const r of primaryRows) {
      const d = ensureDay(dayKey(r.created_at));
      if (r.event_name === "video_started" && r.session_id) d.videoStarts.add(r.session_id);
      if (r.event_name === "video_watched_30s" && r.session_id) d.watched30s.add(r.session_id);
      if (r.event_name === "subtitle_explanation_requested") d.explanations += 1;
      if (r.event_name === "another_video_started") d.anotherVideo += 1;
    }
    const daily = Array.from(dailyMap.entries())
      .map(([date, v]) => ({
        date,
        visitors: v.visitors.size,
        videoStarts: v.videoStarts.size,
        watched30s: v.watched30s.size,
        explanations: v.explanations,
        anotherVideo: v.anotherVideo,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));


    return {
      windowLabel: windowLabelFor(from, to),
      range: { from: from ?? null, to: to ?? null, source },
      visitors: fVisitors,
      demoStarts: totalSessions,
      transcriptClicks: clickRows.length,
      feedbackCount: feedback.length,
      waitlistCount: signups.length,
      rawPageViewRows: allPv.length,
      sourceBreakdown,
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
        cohortLabel: `unique sessions (${windowLabelFor(from, to)})`,
        visitors: fVisitors,
        videoOpened: fVideoOpened,
        watched30s: fWatched30,
        clickedSentence: fClicked,
        savedSomething: fSaved,
      },
      discovery: {
        videoOpened: fVideoOpened,
        watched30s: fWatched30,
        transcriptSeen: dTranscriptSeen,
        hoveredSentence: dHovered,
        clickedSentence: dClicked,
        savedSomething: dSaved,
      },
      firstClick: {
        watched30s: watched30Sessions.size,
        clickedSessions: clickedSessions.size,
        rate: firstClickRate,
        watchedNoClick,
        watchedNoClickPct,
      },
      activationSession: {
        eligible: fVisitors,
        activated: activatedSessions,
        rate: fVisitors > 0 ? activatedSessions / fVisitors : 0,
      },
      primary: {
        trackingStartedAt: FUNNEL_TRACKING_START_ISO,
        coversTrackedPeriod: trackingCoversWindow,
        visitors: fVisitors,
        videoOpened: pStarted.size,
        watched30s: s2.size,
        explanationRequested: s3.size,
        continuedAfterExplanation: s4.size,
        anotherVideoStarted: s5.size,
      },
      anonymous: {
        trackingStartedAt: ANON_TRACKING_START_ISO,
        unique: anonInWindow.size,
        newVisitors: anonNew,
        returningVisitors: anonReturning,
        returnedAnotherDay,
        d1: { returned: d1Returned, eligible: d1Eligible },
        d7: { returned: d7Returned, eligible: d7Eligible },
      },
      daily,
    };
  });
