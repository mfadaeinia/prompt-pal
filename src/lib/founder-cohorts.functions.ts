import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ACTIVATION_DURATION_SECONDS } from "./founder-metrics.functions";

// ============================================================
// Types
// ============================================================

export type ReleaseCohort = {
  id: string;
  name: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
};

export type CohortScope =
  | { kind: "current" }
  | { kind: "previous" }
  | { kind: "since_last" }
  | { kind: "all" }
  | { kind: "specific"; cohortId: string };

export type TimeRange =
  | { kind: "cohort" } // bounded by cohort start/end
  | { kind: "last_7d" }
  | { kind: "last_30d" }
  | { kind: "custom"; since: string; until?: string };

export type AnalyticsFilter = {
  scope?: CohortScope;
  range?: TimeRange;
  source?: string | null; // acquisition_source, null/"all" means no filter
};

const FilterInput = z.object({
  scope: z
    .union([
      z.object({ kind: z.literal("current") }),
      z.object({ kind: z.literal("previous") }),
      z.object({ kind: z.literal("since_last") }),
      z.object({ kind: z.literal("all") }),
      z.object({ kind: z.literal("specific"), cohortId: z.string().uuid() }),
    ])
    .optional(),
  range: z
    .union([
      z.object({ kind: z.literal("cohort") }),
      z.object({ kind: z.literal("last_7d") }),
      z.object({ kind: z.literal("last_30d") }),
      z.object({
        kind: z.literal("custom"),
        since: z.string(),
        until: z.string().optional(),
      }),
    ])
    .optional(),
  source: z.string().nullable().optional(),
});

// ============================================================
// Read cohorts
// ============================================================

export const listCohorts = createServerFn({ method: "GET" }).handler(
  async (): Promise<ReleaseCohort[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("release_cohorts" as any)
      .select("id,name,description,started_at,ended_at,is_active")
      .order("started_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as any;
  },
);

const StartInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
});

export const startNewCohort = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StartInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    // End the currently active cohort
    const { error: e1 } = await supabaseAdmin
      .from("release_cohorts" as any)
      .update({ is_active: false, ended_at: now })
      .eq("is_active", true);
    if (e1) throw new Error(e1.message);
    const { data: inserted, error: e2 } = await supabaseAdmin
      .from("release_cohorts" as any)
      .insert({
        name: data.name,
        description: data.description ?? null,
        started_at: now,
        is_active: true,
      })
      .select("*")
      .single();
    if (e2) throw new Error(e2.message);
    const { invalidateActiveCohortCache } = await import("@/lib/active-cohort.server");
    invalidateActiveCohortCache();
    return { cohort: inserted as any };
  });

// ============================================================
// Filter resolution
// ============================================================

export type ResolvedFilter = {
  cohort: ReleaseCohort | null; // null = "all time"
  since: string | null;
  until: string | null;
  source: string | null;
  label: string;
};

async function resolveFilter(filter: AnalyticsFilter): Promise<ResolvedFilter> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("release_cohorts" as any)
    .select("id,name,description,started_at,ended_at,is_active")
    .order("started_at", { ascending: false });
  if (error) throw new Error(error.message);
  const cohorts = ((data ?? []) as unknown) as ReleaseCohort[];

  const scope = filter.scope ?? { kind: "current" };
  let cohort: ReleaseCohort | null = null;

  if (scope.kind === "all") {
    cohort = null;
  } else if (scope.kind === "current") {
    cohort = cohorts.find((c) => c.is_active) ?? null;
  } else if (scope.kind === "previous") {
    const active = cohorts.find((c) => c.is_active);
    const idx = active ? cohorts.indexOf(active) : -1;
    cohort = idx >= 0 ? cohorts[idx + 1] ?? null : cohorts[1] ?? null;
  } else if (scope.kind === "since_last") {
    // Same as current — alias to keep UI tidy
    cohort = cohorts.find((c) => c.is_active) ?? null;
  } else if (scope.kind === "specific") {
    cohort = cohorts.find((c) => c.id === scope.cohortId) ?? null;
  }

  // Time range
  let since: string | null = null;
  let until: string | null = null;
  const range = filter.range ?? { kind: "cohort" };
  const now = Date.now();
  if (range.kind === "cohort") {
    since = cohort?.started_at ?? null;
    until = cohort?.ended_at ?? null;
  } else if (range.kind === "last_7d") {
    since = new Date(now - 7 * 86400_000).toISOString();
  } else if (range.kind === "last_30d") {
    since = new Date(now - 30 * 86400_000).toISOString();
  } else if (range.kind === "custom") {
    since = range.since;
    until = range.until ?? null;
  }

  const source = filter.source && filter.source !== "all" ? filter.source : null;

  let label = cohort ? cohort.name : "All time";
  if (range.kind === "last_7d") label += " · Last 7d";
  if (range.kind === "last_30d") label += " · Last 30d";
  if (range.kind === "custom") label += " · custom range";
  if (source) label += ` · ${source}`;

  return { cohort, since, until, source, label };
}

function applyCohortAndAcq<T>(qb: any, f: ResolvedFilter): any {
  if (f.cohort) qb = qb.eq("release_cohort_id", f.cohort.id);
  if (f.source) qb = qb.eq("acquisition_source", f.source);
  return qb;
}

function applyCreatedRange(qb: any, f: ResolvedFilter, col = "created_at"): any {
  if (f.since) qb = qb.gte(col, f.since);
  if (f.until) qb = qb.lte(col, f.until);
  return qb;
}

// ============================================================
// Filtered funnel & comparison
// ============================================================

export type FunnelStage = {
  label: string;
  value: number;
  /** pct of previous stage (0..100), null for first stage */
  continuePct: number | null;
};

export type FilteredFunnel = {
  label: string;
  cohort: ReleaseCohort | null;
  source: string | null;
  totals: {
    visitors: number;
    videoOpened: number;
    watched30s: number;
    clickedSentence: number;
    savedSomething: number;
    signups: number;
    activated: number;
    returning: number;
  };
  stages: FunnelStage[];
  activation: {
    activated: number;
    eligibleSignups: number;
    rate: number; // 0..1
  };
  /** Breakdown of why non-activated signups failed activation. */
  notActivated: {
    never_opened_video: number;
    never_watched_30s: number;
    never_clicked_sentence: number;
    clicked_but_not_30s: number;
  };
  acquisitionBreakdown: Array<{ source: string; visitors: number; activated: number }>;
};

async function fetchFunnelData(f: ResolvedFilter) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [pv, vs, le, se, sv] = await Promise.all([
    applyCreatedRange(
      applyCohortAndAcq(
        supabaseAdmin
          .from("page_views" as any)
          .select("session_id,acquisition_source,user_id,created_at"),
        f,
      ),
      f,
    ),
    applyCreatedRange(
      applyCohortAndAcq(
        supabaseAdmin
          .from("video_sessions" as any)
          .select("session_id,duration_seconds,user_id,acquisition_source,started_at"),
        f,
      ),
      f,
      "started_at",
    ),
    applyCreatedRange(
      applyCohortAndAcq(
        supabaseAdmin
          .from("library_events" as any)
          .select("session_id,event_name,user_id,created_at"),
        f,
      ),
      f,
    ),
    applyCreatedRange(
      applyCohortAndAcq(
        supabaseAdmin
          .from("saved_expressions" as any)
          .select("session_id,user_id,created_at"),
        f,
      ),
      f,
    ),
    applyCreatedRange(
      applyCohortAndAcq(
        supabaseAdmin
          .from("saved_videos" as any)
          .select("session_id,user_id,created_at"),
        f,
      ),
      f,
    ),
  ]);

  return {
    pageViews: (pv.data ?? []) as any[],
    videoSessions: (vs.data ?? []) as any[],
    libraryEvents: (le.data ?? []) as any[],
    savedExpr: (se.data ?? []) as any[],
    savedVids: (sv.data ?? []) as any[],
  };
}

function computeFunnelTotals(d: Awaited<ReturnType<typeof fetchFunnelData>>, label: string, f: ResolvedFilter): FilteredFunnel {
  const pvSessions = new Set(d.pageViews.map((r) => r.session_id).filter(Boolean));
  const videoSessionIds = new Set(d.videoSessions.map((r) => r.session_id).filter(Boolean));
  const maxDurBySession = new Map<string, number>();
  for (const r of d.videoSessions) {
    const sid = r.session_id;
    if (!sid) continue;
    const cur = r.duration_seconds ?? 0;
    const prev = maxDurBySession.get(sid) ?? 0;
    if (cur > prev) maxDurBySession.set(sid, cur);
  }
  const watched30 = new Set<string>();
  for (const [sid, dur] of maxDurBySession) {
    if (dur >= ACTIVATION_DURATION_SECONDS) watched30.add(sid);
  }
  const clickRows = d.libraryEvents.filter((r) => r.event_name === "sentence_clicked");
  const clicked = new Set(clickRows.map((r) => r.session_id).filter(Boolean));
  const savedSessions = new Set<string>([
    ...d.savedExpr.map((r) => r.session_id).filter(Boolean),
    ...d.savedVids.map((r) => r.session_id).filter(Boolean),
  ]);

  const allSessions = new Set<string>([
    ...pvSessions,
    ...videoSessionIds,
    ...clicked,
    ...savedSessions,
  ]);
  const visitors = allSessions.size;
  const videoOpened = Math.min(videoSessionIds.size, visitors);
  const watched30Count = Math.min(watched30.size, videoOpened);
  const clickedCount = Math.min(clicked.size, watched30Count);
  const savedCount = Math.min(savedSessions.size, clickedCount);

  // ---- 7-day activation across multiple sessions for authenticated signups ----
  // Collect signups: user_ids first seen in this filter window (any user_id present in events).
  const userFirstSeen = new Map<string, number>(); // user_id -> first ts (ms)
  const userVideoOpened = new Set<string>();
  const userMaxDur = new Map<string, number>(); // user_id -> max duration seen across sessions
  const userClicked = new Set<string>();
  // Map session_id -> user_id for attribution of anon events
  const sessionToUser = new Map<string, string>();
  const bumpFirst = (uid: string, ts: string | null) => {
    if (!uid || !ts) return;
    const t = new Date(ts).getTime();
    const prev = userFirstSeen.get(uid);
    if (prev === undefined || t < prev) userFirstSeen.set(uid, t);
  };
  for (const r of d.pageViews) {
    if (r.user_id) {
      bumpFirst(r.user_id, r.created_at);
      if (r.session_id) sessionToUser.set(r.session_id, r.user_id);
    }
  }
  for (const r of d.videoSessions) {
    if (r.user_id) {
      bumpFirst(r.user_id, r.started_at);
      if (r.session_id) sessionToUser.set(r.session_id, r.user_id);
    }
  }
  for (const r of d.libraryEvents) {
    if (r.user_id) {
      bumpFirst(r.user_id, r.created_at);
      if (r.session_id) sessionToUser.set(r.session_id, r.user_id);
    }
  }
  for (const r of d.savedExpr) {
    if (r.user_id) {
      bumpFirst(r.user_id, r.created_at);
      if (r.session_id) sessionToUser.set(r.session_id, r.user_id);
    }
  }
  for (const r of d.savedVids) {
    if (r.user_id) {
      bumpFirst(r.user_id, r.created_at);
      if (r.session_id) sessionToUser.set(r.session_id, r.user_id);
    }
  }

  const within7d = (uid: string, ts: string | null): boolean => {
    if (!ts) return false;
    const first = userFirstSeen.get(uid);
    if (first === undefined) return false;
    const t = new Date(ts).getTime();
    return t >= first && t - first <= 7 * 86400_000;
  };

  for (const r of d.videoSessions) {
    const uid = r.user_id ?? sessionToUser.get(r.session_id);
    if (!uid) continue;
    const ts = r.started_at;
    if (!within7d(uid, ts)) continue;
    userVideoOpened.add(uid);
    const cur = r.duration_seconds ?? 0;
    const prev = userMaxDur.get(uid) ?? 0;
    if (cur > prev) userMaxDur.set(uid, cur);
  }
  for (const r of d.libraryEvents) {
    if (r.event_name !== "sentence_clicked") continue;
    const uid = r.user_id ?? sessionToUser.get(r.session_id);
    if (!uid) continue;
    if (!within7d(uid, r.created_at)) continue;
    userClicked.add(uid);
  }

  const signupIds = Array.from(userFirstSeen.keys());
  const signups = signupIds.length;
  const userWatched30 = new Set<string>();
  for (const [uid, dur] of userMaxDur) {
    if (dur >= ACTIVATION_DURATION_SECONDS) userWatched30.add(uid);
  }
  let activated = 0;
  let neverOpenedVideo = 0;
  let neverWatched30 = 0;
  let neverClicked = 0;
  let clickedButNot30 = 0;
  for (const uid of signupIds) {
    const opened = userVideoOpened.has(uid);
    const watched = userWatched30.has(uid);
    const clickedU = userClicked.has(uid);
    if (watched && clickedU) {
      activated++;
    } else {
      if (!opened) neverOpenedVideo++;
      else if (!watched && !clickedU) neverWatched30++;
      else if (!clickedU) neverClicked++;
      else clickedButNot30++;
    }
  }

  // Returning: user has activity ≥1 day after their first seen ts
  let returning = 0;
  for (const uid of signupIds) {
    const first = userFirstSeen.get(uid)!;
    let last = first;
    for (const r of d.videoSessions) {
      const u = r.user_id ?? sessionToUser.get(r.session_id);
      if (u === uid && r.started_at) {
        const t = new Date(r.started_at).getTime();
        if (t > last) last = t;
      }
    }
    for (const r of d.libraryEvents) {
      const u = r.user_id ?? sessionToUser.get(r.session_id);
      if (u === uid && r.created_at) {
        const t = new Date(r.created_at).getTime();
        if (t > last) last = t;
      }
    }
    if (last - first >= 86400_000) returning++;
  }

  const stages: FunnelStage[] = [
    { label: "Visitors", value: visitors, continuePct: null },
    {
      label: "Video Opened",
      value: videoOpened,
      continuePct: visitors ? Math.round((videoOpened / visitors) * 100) : null,
    },
    {
      label: "Watched 30s+",
      value: watched30Count,
      continuePct: videoOpened ? Math.round((watched30Count / videoOpened) * 100) : null,
    },
    {
      label: "Clicked Sentence",
      value: clickedCount,
      continuePct: watched30Count ? Math.round((clickedCount / watched30Count) * 100) : null,
    },
    {
      label: "Saved Something",
      value: savedCount,
      continuePct: clickedCount ? Math.round((savedCount / clickedCount) * 100) : null,
    },
    {
      label: "Signups",
      value: signups,
      continuePct: visitors ? Math.round((signups / Math.max(visitors, 1)) * 100) : null,
    },
    {
      label: "Activated (7d)",
      value: activated,
      continuePct: signups ? Math.round((activated / signups) * 100) : null,
    },
    {
      label: "Returning",
      value: returning,
      continuePct: signups ? Math.round((returning / signups) * 100) : null,
    },
  ];

  // Acquisition breakdown (only meaningful if not already filtered to one)
  const acqMap = new Map<string, { visitors: Set<string>; users: Set<string> }>();
  const acqEnsure = (k: string) => {
    let e = acqMap.get(k);
    if (!e) {
      e = { visitors: new Set(), users: new Set() };
      acqMap.set(k, e);
    }
    return e;
  };
  for (const r of d.pageViews) {
    const a = r.acquisition_source || "Unknown";
    const e = acqEnsure(a);
    if (r.session_id) e.visitors.add(r.session_id);
    if (r.user_id) e.users.add(r.user_id);
  }
  for (const r of d.videoSessions) {
    const a = r.acquisition_source || "Unknown";
    const e = acqEnsure(a);
    if (r.session_id) e.visitors.add(r.session_id);
    if (r.user_id) e.users.add(r.user_id);
  }
  const acquisitionBreakdown = Array.from(acqMap.entries())
    .map(([source, v]) => {
      let act = 0;
      for (const uid of v.users) {
        if (userWatched30.has(uid) && userClicked.has(uid)) act++;
      }
      return { source, visitors: v.visitors.size, activated: act };
    })
    .sort((a, b) => b.visitors - a.visitors);

  return {
    label,
    cohort: f.cohort,
    source: f.source,
    totals: {
      visitors,
      videoOpened,
      watched30s: watched30Count,
      clickedSentence: clickedCount,
      savedSomething: savedCount,
      signups,
      activated,
      returning,
    },
    stages,
    activation: {
      activated,
      eligibleSignups: signups,
      rate: signups ? activated / signups : 0,
    },
    notActivated: {
      never_opened_video: neverOpenedVideo,
      never_watched_30s: neverWatched30,
      never_clicked_sentence: neverClicked,
      clicked_but_not_30s: clickedButNot30,
    },
    acquisitionBreakdown,
  };
}

export const getFilteredFunnel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => FilterInput.parse(d))
  .handler(async ({ data }) => {
    const f = await resolveFilter(data as AnalyticsFilter);
    const raw = await fetchFunnelData(f);
    return computeFunnelTotals(raw, f.label, f);
  });

// ============================================================
// Compare current vs previous cohort
// ============================================================

export type FunnelComparison = {
  current: FilteredFunnel;
  previous: FilteredFunnel | null;
  trends: Record<
    string,
    { current: number; previous: number; deltaAbs: number; deltaPct: number | null }
  >;
};

function computeTrends(curr: FilteredFunnel, prev: FilteredFunnel | null): FunnelComparison["trends"] {
  const trend = (c: number, p: number) => ({
    current: c,
    previous: p,
    deltaAbs: c - p,
    deltaPct: p === 0 ? null : Math.round(((c - p) / p) * 1000) / 10,
  });
  const t = curr.totals;
  const p = prev?.totals ?? {
    visitors: 0,
    videoOpened: 0,
    watched30s: 0,
    clickedSentence: 0,
    savedSomething: 0,
    signups: 0,
    activated: 0,
    returning: 0,
  };
  // Rates
  const ratePct = (num: number, den: number) => (den ? Math.round((num / den) * 1000) / 10 : 0);
  return {
    visitors: trend(t.visitors, p.visitors),
    videoOpened: trend(t.videoOpened, p.videoOpened),
    watched30s: trend(t.watched30s, p.watched30s),
    clickedSentence: trend(t.clickedSentence, p.clickedSentence),
    savedSomething: trend(t.savedSomething, p.savedSomething),
    signups: trend(t.signups, p.signups),
    activated: trend(t.activated, p.activated),
    returning: trend(t.returning, p.returning),
    activationRate: trend(
      ratePct(t.activated, t.signups),
      ratePct(p.activated, p.signups),
    ),
    sentenceClickRate: trend(
      ratePct(t.clickedSentence, t.watched30s),
      ratePct(p.clickedSentence, p.watched30s),
    ),
    saveRate: trend(
      ratePct(t.savedSomething, t.clickedSentence),
      ratePct(p.savedSomething, p.clickedSentence),
    ),
  };
}

export const getFunnelComparison = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => FilterInput.parse(d))
  .handler(async ({ data }) => {
    const filter = data as AnalyticsFilter;
    const fCurr = await resolveFilter({ ...filter, scope: filter.scope ?? { kind: "current" } });
    const fPrev = await resolveFilter({ ...filter, scope: { kind: "previous" } });
    const [rawC, rawP] = await Promise.all([
      fetchFunnelData(fCurr),
      fPrev.cohort ? fetchFunnelData(fPrev) : Promise.resolve(null),
    ]);
    const current = computeFunnelTotals(rawC, fCurr.label, fCurr);
    const previous = rawP ? computeFunnelTotals(rawP, fPrev.label, fPrev) : null;
    return {
      current,
      previous,
      trends: computeTrends(current, previous),
    } satisfies FunnelComparison;
  });

// ============================================================
// Acquisition sources list (for filter dropdown)
// ============================================================

export const listAcquisitionSources = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("page_views" as any)
    .select("acquisition_source")
    .not("acquisition_source", "is", null)
    .limit(5000);
  if (error) return [] as string[];
  const set = new Set<string>();
  for (const r of (data ?? []) as any[]) {
    if (r.acquisition_source) set.add(r.acquisition_source);
  }
  return Array.from(set).sort();
});
