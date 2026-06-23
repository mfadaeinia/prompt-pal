import { createServerFn } from "@tanstack/react-start";

export type UserRetentionRow = {
  user_id: string;
  email: string | null;
  created_at: string;
  last_seen_at: string;
  total_sessions: number;
  videos_opened: number;
  videos_watched_30s: number;
  sentence_clicks: number;
  expressions_saved: number;
  videos_saved: number;
  total_watch_seconds: number;
  /** A user is activated if at least one of their sessions is activated. */
  activated: boolean;
  reason_not_activated: string | null;
  returning: boolean;
  returned_1d: boolean;
  returned_7d: boolean;
  returned_30d: boolean;
};

export type UserRetentionCohort = {
  totals: {
    new_users: number;
    activated: number;
    activation_rate: number;
    weekly_active: number;
    returning: number;
    returned_1d: number;
    returned_7d: number;
    returned_30d: number;
  };
  users: UserRetentionRow[];
};

const DAY = 24 * 60 * 60 * 1000;
const ACTIVATION_DURATION_SECONDS = 30;

export const getUserRetentionCohort = createServerFn({ method: "GET" }).handler(
  async (): Promise<UserRetentionCohort> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. List all auth users (paged)
    const users: Array<{ id: string; email: string | null; created_at: string }> = [];
    let page = 1;
    const perPage = 1000;
    for (let i = 0; i < 20; i++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        users.push({ id: u.id, email: u.email ?? null, created_at: u.created_at });
      }
      if (data.users.length < perPage) break;
      page++;
    }

    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) {
      return {
        totals: {
          new_users: 0,
          activated: 0,
          activation_rate: 0,
          weekly_active: 0,
          returning: 0,
          returned_1d: 0,
          returned_7d: 0,
          returned_30d: 0,
        },
        users: [],
      };
    }

    // 2. Pull source rows
    const [se, sv, vsByUser, leByUser, vsAll, leAll] = await Promise.all([
      supabaseAdmin
        .from("saved_expressions" as any)
        .select("user_id,session_id,created_at")
        .in("user_id", userIds),
      supabaseAdmin
        .from("saved_videos" as any)
        .select("user_id,session_id,created_at")
        .in("user_id", userIds),
      supabaseAdmin
        .from("video_sessions" as any)
        .select("user_id,session_id,video_id,duration_seconds,last_seen_at")
        .in("user_id", userIds),
      supabaseAdmin
        .from("library_events" as any)
        .select("user_id,session_id,event_name,created_at")
        .in("user_id", userIds)
        .eq("event_name", "sentence_clicked"),
      // Fallback: rows missing user_id but session_id is attributable
      supabaseAdmin
        .from("video_sessions" as any)
        .select("session_id,video_id,duration_seconds,last_seen_at")
        .is("user_id", null),
      supabaseAdmin
        .from("library_events" as any)
        .select("session_id,event_name,created_at")
        .is("user_id", null)
        .eq("event_name", "sentence_clicked"),
    ]);

    // session_id → user_id mapping for historical fallback
    const sessionToUser = new Map<string, string>();
    const addMap = (rows: any[] | null) => {
      for (const r of rows ?? []) {
        if (r.user_id && r.session_id && !sessionToUser.has(r.session_id)) {
          sessionToUser.set(r.session_id, r.user_id);
        }
      }
    };
    addMap(se.data as any[]);
    addMap(sv.data as any[]);
    addMap(vsByUser.data as any[]);
    addMap(leByUser.data as any[]);

    // Per (user, session) aggregates so we can compute "activated session"
    type SessionStats = {
      maxDuration: number;
      clicks: number;
      videoIds: Set<string>;
    };
    const userSessionStats = new Map<string, Map<string, SessionStats>>();
    const ensure = (uid: string, sid: string): SessionStats => {
      let bySid = userSessionStats.get(uid);
      if (!bySid) {
        bySid = new Map();
        userSessionStats.set(uid, bySid);
      }
      let s = bySid.get(sid);
      if (!s) {
        s = { maxDuration: 0, clicks: 0, videoIds: new Set() };
        bySid.set(sid, s);
      }
      return s;
    };

    const userSaved = new Map<string, number>();
    const userSavedVideos = new Map<string, number>();
    const userLastSeen = new Map<string, string>();
    const touch = (uid: string, ts?: string | null) => {
      if (!ts) return;
      const prev = userLastSeen.get(uid);
      if (!prev || ts > prev) userLastSeen.set(uid, ts);
    };

    for (const r of (se.data ?? []) as any[]) {
      if (!r.user_id) continue;
      userSaved.set(r.user_id, (userSaved.get(r.user_id) ?? 0) + 1);
      touch(r.user_id, r.created_at);
    }
    for (const r of (sv.data ?? []) as any[]) {
      if (!r.user_id) continue;
      userSavedVideos.set(r.user_id, (userSavedVideos.get(r.user_id) ?? 0) + 1);
      touch(r.user_id, r.created_at);
    }

    const addVideoRow = (
      uid: string,
      sid: string | null | undefined,
      videoId: string | null | undefined,
      dur: number | null | undefined,
      lastSeen: string | null | undefined,
    ) => {
      if (!sid) return;
      const s = ensure(uid, sid);
      if (videoId) s.videoIds.add(videoId);
      if (typeof dur === "number" && dur > s.maxDuration) s.maxDuration = dur;
      touch(uid, lastSeen);
    };
    for (const r of (vsByUser.data ?? []) as any[]) {
      if (!r.user_id) continue;
      addVideoRow(r.user_id, r.session_id, r.video_id, r.duration_seconds, r.last_seen_at);
    }
    for (const r of (vsAll.data ?? []) as any[]) {
      const uid = sessionToUser.get(r.session_id);
      if (!uid) continue;
      addVideoRow(uid, r.session_id, r.video_id, r.duration_seconds, r.last_seen_at);
    }

    const addClickRow = (uid: string, sid: string | null | undefined, ts: string | null) => {
      if (!sid) return;
      const s = ensure(uid, sid);
      s.clicks += 1;
      touch(uid, ts);
    };
    for (const r of (leByUser.data ?? []) as any[]) {
      if (!r.user_id) continue;
      addClickRow(r.user_id, r.session_id, r.created_at);
    }
    for (const r of (leAll.data ?? []) as any[]) {
      const uid = sessionToUser.get(r.session_id);
      if (!uid) continue;
      addClickRow(uid, r.session_id, r.created_at);
    }

    const now = Date.now();
    const rows: UserRetentionRow[] = users.map((u) => {
      const bySid = userSessionStats.get(u.id);
      let totalSessions = 0;
      let totalClicks = 0;
      let totalWatch = 0;
      let activatedSessionCount = 0;
      const allVideoIds = new Set<string>();
      // Per video, track the max duration reached across all of this user's sessions.
      // This ensures videos_watched_30s counts UNIQUE videos (same unit as videos_opened),
      // so it can never exceed videos_opened for the same user.
      const videoMaxDuration = new Map<string, number>();
      if (bySid) {
        for (const s of bySid.values()) {
          totalSessions += 1;
          for (const v of s.videoIds) {
            allVideoIds.add(v);
            const prev = videoMaxDuration.get(v) ?? 0;
            if (s.maxDuration > prev) videoMaxDuration.set(v, s.maxDuration);
          }
          totalClicks += s.clicks;
          totalWatch += s.maxDuration;
          if (s.maxDuration >= ACTIVATION_DURATION_SECONDS && s.clicks >= 1) {
            activatedSessionCount += 1;
          }
        }
      }
      let videosWatched30 = 0;
      for (const dur of videoMaxDuration.values()) {
        if (dur >= ACTIVATION_DURATION_SECONDS) videosWatched30 += 1;
      }
      // Defensive clamp: invariant videos_watched_30s ≤ videos_opened.
      const videosOpenedCount = allVideoIds.size;
      if (videosWatched30 > videosOpenedCount) videosWatched30 = videosOpenedCount;
      const saved = userSaved.get(u.id) ?? 0;
      const savedVideos = userSavedVideos.get(u.id) ?? 0;
      const lastSeen = userLastSeen.get(u.id) ?? u.created_at;
      const createdMs = new Date(u.created_at).getTime();
      const lastMs = new Date(lastSeen).getTime();
      const gap = lastMs - createdMs;
      const activated = activatedSessionCount >= 1;

      let reason: string | null = null;
      if (!activated) {
        if (videosOpenedCount === 0) reason = "never opened a video";
        else if (videosWatched30 === 0) reason = "no video watched ≥30s";
        else if (totalClicks === 0) reason = "watched but never clicked a sentence";
        else reason = "watch & clicks in different sessions";
      }

      // "Returning" = signed-in user has a session at least 1 day after signup.
      const returning = gap >= 1 * DAY;

      return {
        user_id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_seen_at: lastSeen,
        total_sessions: totalSessions,
        videos_opened: allVideoIds.size,
        videos_watched_30s: videosWatched30,
        sentence_clicks: totalClicks,
        expressions_saved: saved,
        videos_saved: savedVideos,
        total_watch_seconds: totalWatch,
        activated,
        reason_not_activated: reason,
        returning,
        returned_1d: gap >= 1 * DAY,
        returned_7d: gap >= 7 * DAY,
        returned_30d: gap >= 30 * DAY,
      };
    });

    rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const activated = rows.filter((r) => r.activated).length;
    const totals = {
      new_users: rows.length,
      activated,
      activation_rate: rows.length ? activated / rows.length : 0,
      weekly_active: rows.filter(
        (r) => now - new Date(r.last_seen_at).getTime() <= 7 * DAY,
      ).length,
      returning: rows.filter((r) => r.returning).length,
      returned_1d: rows.filter((r) => r.returned_1d).length,
      returned_7d: rows.filter((r) => r.returned_7d).length,
      returned_30d: rows.filter((r) => r.returned_30d).length,
    };

    return { totals, users: rows };
  },
);
