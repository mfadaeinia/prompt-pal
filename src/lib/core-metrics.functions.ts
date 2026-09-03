/**
 * CORRECTED measurement foundation (Founder Dashboard).
 *
 * All definitions live here, once. Units are explicit in every field name.
 *
 * UNITS
 *   SESSION — one canonical browsing/product session (identity.ts).
 *   VISITOR — one anonymous browser/device (anonymous_user_id).
 *   USER    — one authenticated account (user_id).
 * These are never mixed.
 *
 * CORE ACTIVATED SESSION
 *   A non-internal SESSION that has BOTH `video_watched_30s` AND
 *   `subtitle_explanation_requested` under the SAME canonical session_id.
 *   Saving / accounts / multiple videos are NOT required.
 *
 * RETURNING AUTHENTICATED USER (unit: USER)
 *   A distinct non-internal user_id with MEANINGFUL activity on at least TWO
 *   DISTINCT CALENDAR DAYS (UTC). Account existence never counts.
 *
 * RETURNING ANONYMOUS VISITOR (unit: VISITOR)
 *   Same rule, keyed by anonymous_user_id. A browser/device, not a known human.
 *   No fingerprinting: the same person on 3 browsers = 3 visitors. Accepted.
 *
 * MEANINGFUL ACTIVITY — intentional product use only (never page loads or
 *   analytics init): see MEANINGFUL_EVENTS.
 *
 * TIMEZONE — day boundaries are UTC, matching the dashboard's day keys.
 *
 * INTERNAL TRAFFIC — excluded by default. A row is internal when
 *   metadata.is_internal is true, or its user_id / anonymous_id has EVER
 *   produced an is_internal row (derived allowlist, no schema change, no
 *   emails stored anywhere).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CANONICAL_EQUIVALENTS } from "./analytics-events";
import type { TrafficClass } from "./traffic-class";

/** Unified canonical session_id across video_sessions + library_events. */
export const UNIFIED_SESSION_TRACKING_START_ISO = "2026-08-24T00:00:00.000Z";
/** Persisted watch-funnel events (video_started … another_video_started). */
export const FUNNEL_EVENT_TRACKING_START_ISO = "2026-08-18T00:00:00.000Z";
/** anonymous_user_id written to analytics rows. */
export const ANON_TRACKING_START_ISO = "2026-08-11T00:00:00.000Z";

/** Canonical traffic classification start (Phase 1 analytics repair). Rows
 *  written before this timestamp carry no `traffic_class`. */
export const TRAFFIC_CLASS_TRACKING_START_ISO = "2026-09-03T00:00:00.000Z";

export const MEANINGFUL_EVENTS = [
  "video_started",
  "video_watched_30s",
  "meaningful_watch_30s",
  "subtitle_explanation_requested",
  "explanation_viewed",
  "video_resumed_after_explanation",
  "another_video_started",
  "sentence_clicked",
] as const;

const FUNNEL_EVENTS = [
  "video_selected",
  "video_started",
  "video_watched_30s",
  "meaningful_watch_30s",
  "subtitle_explanation_requested",
  "explanation_viewed",
  "video_resumed_after_explanation",
  "another_video_started",
] as const;

const Input = z.object({
  from: z.string().datetime().nullable().optional(),
  to: z.string().datetime().nullable().optional(),
  device: z.enum(["all", "desktop", "mobile", "tablet"]).default("all"),
  experience: z.enum(["all", "public", "passive_learning_experiment"]).default("all"),
  internal: z.enum(["exclude", "include"]).default("exclude"),
  /**
   * CANONICAL TRAFFIC FILTER. Product metrics default to production users only:
   * demo, founder/admin, development, benchmark, automated-test and bot rows are
   * excluded. `all` is a debugging escape hatch, never the product default.
   */
  traffic: z.enum(["production_only", "all"]).default("production_only"),
});

export type CoreMetrics = {
  tracking: {
    unifiedSessionStart: string;
    funnelEventStart: string;
    anonStart: string;
    /** Canonical traffic classification start. */
    trafficClassStart: string;
    /** false → selected period predates unified session tracking. */
    periodCoversUnifiedTracking: boolean;
    periodCoversFunnelTracking: boolean;
  };
  filters: { device: string; experience: string; internal: string; traffic: string };
  /**
   * Documented denominator for every conversion rate the dashboard renders.
   * Units are explicit; VISITOR / SESSION / USER are never mixed silently.
   */
  denominators: Record<string, string>;
  /** How many rows in the window carry each traffic_class (post date-window,
   *  pre traffic filter). `unclassified` = historical rows written before
   *  traffic classification existed. */
  trafficBreakdown: Record<string, number>;
  /** ACQUISITION */
  acquisition: {
    visitors: number; // VISITOR
    sessions: number; // SESSION
  };
  /** Canonical video selection step (SESSION). */
  selection: { videoSelected: number };
  /** CORE ACTIVATION — all SESSION unit, each step scoped to the previous. */
  activation: {
    videoStarted: number;
    watched30s: number;
    explanationRequested: number;
    coreActivated: number;
    continuedAfterExplanation: number;
    anotherVideoStarted: number;
  };
  retention: {
    authenticated: {
      active: number; // USER with meaningful activity in period
      returning: number; // …and ≥2 distinct UTC days (all-time days)
      d1: { returned: number; eligible: number };
      d7: { returned: number; eligible: number };
    };
    anonymous: {
      active: number; // VISITOR
      returning: number;
      d1: { returned: number; eligible: number };
      d7: { returned: number; eligible: number };
    };
  };
  /** DIAGNOSTIC / LEGACY (kept, never in the primary funnel). */
  diagnostic: {
    transcriptSeenSessions: number;
    highlightedExpressionSessions: number;
    sentenceClickedSessions: number;
    savedSomethingSessions: number;
  };
  internalExcluded: { users: number; visitors: number; rows: number };
};

type Row = {
  session_id: string | null;
  anonymous_id: string | null;
  user_id: string | null;
  event_name: string;
  metadata: Record<string, any> | null;
  created_at: string;
};

const DAY = 86_400_000;
const dayKey = (iso: string) => iso.slice(0, 10); // UTC calendar day

export const getCoreMetrics = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d ?? {}))
  .handler(async ({ data }): Promise<CoreMetrics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { from, to } = data;

    // Full meaningful history is needed for calendar-day retention; the window
    // only selects the cohort.
    const [histRes, windowRes, savedExprRes, savedVidRes] = await Promise.all([
      supabaseAdmin
        .from("library_events" as any)
        .select("session_id,anonymous_id,user_id,event_name,metadata,created_at")
        .in("event_name", MEANINGFUL_EVENTS as unknown as string[])
        .order("created_at", { ascending: true })
        .limit(50000),
      (() => {
        let q: any = supabaseAdmin
          .from("library_events" as any)
          .select("session_id,anonymous_id,user_id,event_name,metadata,created_at")
          .in("event_name", [
            ...FUNNEL_EVENTS,
            "sentence_clicked",
            "transcript_seen",
            "highlighted_expression_clicked",
            "expression_saved",
          ]);
        if (from) q = q.gte("created_at", from);
        if (to) q = q.lte("created_at", to);
        return q.limit(50000);
      })(),
      (() => {
        let q: any = supabaseAdmin.from("saved_expressions" as any).select("session_id,created_at");
        if (from) q = q.gte("created_at", from);
        if (to) q = q.lte("created_at", to);
        return q;
      })(),
      (() => {
        let q: any = supabaseAdmin.from("saved_videos" as any).select("session_id,created_at");
        if (from) q = q.gte("created_at", from);
        if (to) q = q.lte("created_at", to);
        return q;
      })(),
    ]);

    const hist = ((histRes.data ?? []) as unknown) as Row[];
    const win = ((windowRes.data ?? []) as unknown) as Row[];

    // ---- derived internal allowlist (no schema change, no emails) ----------
    const internalUsers = new Set<string>();
    const internalVisitors = new Set<string>();
    for (const r of hist) {
      if (r.metadata?.is_internal === true) {
        if (r.user_id) internalUsers.add(r.user_id);
        if (r.anonymous_id) internalVisitors.add(r.anonymous_id);
      }
    }
    const isInternalRow = (r: Row) =>
      r.metadata?.is_internal === true ||
      (!!r.user_id && internalUsers.has(r.user_id)) ||
      (!!r.anonymous_id && internalVisitors.has(r.anonymous_id));

    const trafficOf = (r: Row): TrafficClass | "unclassified" =>
      (r.metadata?.traffic_class as TrafficClass | undefined) ?? "unclassified";

    /**
     * HISTORICAL ROWS: rows written before TRAFFIC_CLASS_TRACKING_START_ISO have
     * no `traffic_class`. They are NEVER deleted or rewritten. Under
     * `production_only` they are admitted only when the legacy internal
     * heuristic says they are not internal, and they are counted separately as
     * `trafficBreakdown.unclassified` so any number that leans on them is
     * visible as such.
     */
    const passesTraffic = (r: Row) => {
      if (data.traffic === "all") return true;
      const tc = trafficOf(r);
      if (tc === "unclassified") return !isInternalRow(r);
      return tc === "production_user";
    };

    const passes = (r: Row) => {
      if (!passesTraffic(r)) return false;
      if (data.internal === "exclude" && isInternalRow(r)) return false;
      const md = r.metadata ?? {};
      if (data.device !== "all" && md.device_type && md.device_type !== data.device) return false;
      if (data.experience !== "all" && md.experience_type && md.experience_type !== data.experience)
        return false;
      return true;
    };

    let internalRows = 0;
    for (const r of hist) if (isInternalRow(r)) internalRows += 1;

    const trafficBreakdown: Record<string, number> = {};
    for (const r of win) {
      const tc = trafficOf(r);
      trafficBreakdown[tc] = (trafficBreakdown[tc] ?? 0) + 1;
    }

    const windowRows = win.filter(passes);
    const histRows = hist.filter(passes);

    // ---- SESSION-level activation funnel ----------------------------------
    const sessionsWith = (event: string) =>
      new Set(
        windowRows
          .filter((r) => r.event_name === event)
          .map((r) => r.session_id)
          .filter(Boolean) as string[],
      );
    const inter = (a: Set<string>, b: Set<string>) => {
      const out = new Set<string>();
      for (const v of a) if (b.has(v)) out.add(v);
      return out;
    };
    /** Canonical step: canonical event name OR its documented legacy
     *  equivalent (historical rows), unioned. */
    const sessionsWithCanonical = (step: string) => {
      const names = CANONICAL_EQUIVALENTS[step] ?? [step];
      const out = new Set<string>();
      for (const n of names) for (const sid of sessionsWith(n)) out.add(sid);
      return out;
    };

    const selected = sessionsWithCanonical("video_selected");
    const started = sessionsWith("video_started");
    // TRUE SET INTERSECTION everywhere — no Math.min clamping, ever.
    const watched30 = inter(sessionsWithCanonical("meaningful_watch_30s"), started);
    const asked = inter(sessionsWithCanonical("explanation_viewed"), started);
    const coreActivated = inter(watched30, asked);
    const continued = inter(sessionsWith("video_resumed_after_explanation"), asked);
    const another = inter(sessionsWith("another_video_started"), started);

    const allSessions = new Set(
      windowRows.map((r) => r.session_id).filter(Boolean) as string[],
    );
    const allVisitors = new Set(
      windowRows.map((r) => r.anonymous_id).filter(Boolean) as string[],
    );

    // ---- retention (calendar days, UTC) -----------------------------------
    const daysBy = (key: "user_id" | "anonymous_id") => {
      const days = new Map<string, Set<string>>();
      for (const r of histRows) {
        const id = r[key];
        if (!id) continue;
        if (!days.has(id)) days.set(id, new Set());
        days.get(id)!.add(dayKey(r.created_at));
      }
      return days;
    };
    const activeIn = (key: "user_id" | "anonymous_id") =>
      new Set(
        windowRows
          .filter((r) => (MEANINGFUL_EVENTS as readonly string[]).includes(r.event_name))
          .map((r) => r[key])
          .filter(Boolean) as string[],
      );

    const nowMs = Date.now();
    const cohort = (key: "user_id" | "anonymous_id") => {
      const days = daysBy(key);
      const active = activeIn(key);
      let returning = 0;
      let d1r = 0;
      let d1e = 0;
      let d7r = 0;
      let d7e = 0;
      for (const id of active) {
        const set = Array.from(days.get(id) ?? []).sort();
        if (set.length > 1) returning += 1;
        const firstMs = new Date(`${set[0] ?? ""}T00:00:00.000Z`).getTime();
        if (!Number.isFinite(firstMs)) continue;
        const offsets = set.map(
          (d) => Math.round((new Date(`${d}T00:00:00.000Z`).getTime() - firstMs) / DAY),
        );
        if (nowMs - firstMs >= DAY) {
          d1e += 1;
          if (offsets.some((o) => o === 1)) d1r += 1;
        }
        if (nowMs - firstMs >= 7 * DAY) {
          d7e += 1;
          if (offsets.some((o) => o >= 2 && o <= 7)) d7r += 1;
        }
      }
      return {
        active: active.size,
        returning,
        d1: { returned: d1r, eligible: d1e },
        d7: { returned: d7r, eligible: d7e },
      };
    };

    // ---- diagnostic / legacy ----------------------------------------------
    const savedSessions = new Set<string>([
      ...(((savedExprRes.data ?? []) as any[]).map((r) => r.session_id).filter(Boolean) as string[]),
      ...(((savedVidRes.data ?? []) as any[]).map((r) => r.session_id).filter(Boolean) as string[]),
    ]);

    const fromMs = from ? new Date(from).getTime() : 0;
    return {
      tracking: {
        unifiedSessionStart: UNIFIED_SESSION_TRACKING_START_ISO,
        funnelEventStart: FUNNEL_EVENT_TRACKING_START_ISO,
        anonStart: ANON_TRACKING_START_ISO,
        trafficClassStart: TRAFFIC_CLASS_TRACKING_START_ISO,
        periodCoversUnifiedTracking:
          fromMs >= new Date(UNIFIED_SESSION_TRACKING_START_ISO).getTime(),
        periodCoversFunnelTracking:
          fromMs >= new Date(FUNNEL_EVENT_TRACKING_START_ISO).getTime(),
      },
      filters: {
        device: data.device,
        experience: data.experience,
        internal: data.internal,
        traffic: data.traffic,
      },
      denominators: {
        watched30s: "sessions with video_started (SESSION)",
        explanationRequested: "sessions with video_started (SESSION)",
        coreActivated: "sessions with video_started (SESSION)",
        continuedAfterExplanation: "sessions with video_started (SESSION)",
        anotherVideoStarted: "sessions with video_started (SESSION)",
        videoStarted: "sessions with video_selected, when present (SESSION)",
        activationRate: "core-activated sessions / sessions with video_started (SESSION)",
        retentionD1: "eligible = visitors/users whose first meaningful day is ≥1 day old",
        retentionD7: "eligible = visitors/users whose first meaningful day is ≥7 days old",
      },
      trafficBreakdown,
      acquisition: { visitors: allVisitors.size, sessions: allSessions.size },
      selection: { videoSelected: selected.size },
      activation: {
        videoStarted: started.size,
        watched30s: watched30.size,
        explanationRequested: asked.size,
        coreActivated: coreActivated.size,
        continuedAfterExplanation: continued.size,
        anotherVideoStarted: another.size,
      },
      retention: { authenticated: cohort("user_id"), anonymous: cohort("anonymous_id") },
      diagnostic: {
        transcriptSeenSessions: sessionsWith("transcript_seen").size,
        highlightedExpressionSessions: sessionsWith("highlighted_expression_clicked").size,
        sentenceClickedSessions: sessionsWith("sentence_clicked").size,
        savedSomethingSessions: savedSessions.size,
      },
      internalExcluded: {
        users: internalUsers.size,
        visitors: internalVisitors.size,
        rows: internalRows,
      },
    };
  });
