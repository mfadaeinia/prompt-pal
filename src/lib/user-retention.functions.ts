import { createServerFn } from "@tanstack/react-start";

export type UserRetentionRow = {
  user_id: string;
  email: string | null;
  created_at: string;
  last_seen_at: string;
  total_sessions: number;
  videos_loaded: number;
  sentence_clicks: number;
  explanations_viewed: number;
  words_saved: number;
  videos_saved: number;
  activated: boolean;
  reason_not_activated: string | null;
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
    returned_1d: number;
    returned_7d: number;
    returned_30d: number;
  };
  users: UserRetentionRow[];
};

const DAY = 24 * 60 * 60 * 1000;

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
          returned_1d: 0,
          returned_7d: 0,
          returned_30d: 0,
        },
        users: [],
      };
    }

    // 2. Pull raw rows from every source that has user_id (directly or via session_id mapping)
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
        .select("user_id,session_id,video_id,last_seen_at")
        .in("user_id", userIds),
      supabaseAdmin
        .from("library_events" as any)
        .select("user_id,session_id,event_name,created_at")
        .in("user_id", userIds),
      // Fallback: rows missing user_id but session_id is attributable
      supabaseAdmin
        .from("video_sessions" as any)
        .select("session_id,video_id,last_seen_at")
        .is("user_id", null),
      supabaseAdmin
        .from("library_events" as any)
        .select("session_id,event_name,created_at")
        .is("user_id", null)
        .eq("event_name", "sentence_clicked"),
    ]);

    // Build session → user mapping from saved tables (covers historical rows)
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

    const userSessions = new Map<string, Set<string>>();
    const userVideos = new Map<string, Set<string>>();
    const userClicks = new Map<string, number>();
    const userSaved = new Map<string, number>();
    const userSavedVideos = new Map<string, number>();
    const userLastSeen = new Map<string, string>();

    const touch = (uid: string, ts?: string | null) => {
      if (!ts) return;
      const prev = userLastSeen.get(uid);
      if (!prev || ts > prev) userLastSeen.set(uid, ts);
    };
    const addSession = (uid: string, sid: string | null | undefined) => {
      if (!sid) return;
      if (!userSessions.has(uid)) userSessions.set(uid, new Set());
      userSessions.get(uid)!.add(sid);
    };

    for (const r of (se.data ?? []) as any[]) {
      if (!r.user_id) continue;
      addSession(r.user_id, r.session_id);
      userSaved.set(r.user_id, (userSaved.get(r.user_id) ?? 0) + 1);
      touch(r.user_id, r.created_at);
    }
    for (const r of (sv.data ?? []) as any[]) {
      if (!r.user_id) continue;
      addSession(r.user_id, r.session_id);
      userSavedVideos.set(r.user_id, (userSavedVideos.get(r.user_id) ?? 0) + 1);
      touch(r.user_id, r.created_at);
    }
    for (const r of (vsByUser.data ?? []) as any[]) {
      if (!r.user_id || !r.video_id) continue;
      addSession(r.user_id, r.session_id);
      if (!userVideos.has(r.user_id)) userVideos.set(r.user_id, new Set());
      userVideos.get(r.user_id)!.add(r.video_id);
      touch(r.user_id, r.last_seen_at);
    }
    for (const r of (leByUser.data ?? []) as any[]) {
      if (!r.user_id) continue;
      addSession(r.user_id, r.session_id);
      if (r.event_name === "sentence_clicked") {
        userClicks.set(r.user_id, (userClicks.get(r.user_id) ?? 0) + 1);
      }
      touch(r.user_id, r.created_at);
    }

    // Fallback attribution for historical rows missing user_id
    for (const r of (vsAll.data ?? []) as any[]) {
      const uid = sessionToUser.get(r.session_id);
      if (!uid || !r.video_id) continue;
      if (!userVideos.has(uid)) userVideos.set(uid, new Set());
      userVideos.get(uid)!.add(r.video_id);
      touch(uid, r.last_seen_at);
    }
    for (const r of (leAll.data ?? []) as any[]) {
      const uid = sessionToUser.get(r.session_id);
      if (!uid) continue;
      userClicks.set(uid, (userClicks.get(uid) ?? 0) + 1);
      touch(uid, r.created_at);
    }

    const now = Date.now();
    const rows: UserRetentionRow[] = users.map((u) => {
      const videos = userVideos.get(u.id)?.size ?? 0;
      const clicks = userClicks.get(u.id) ?? 0;
      const saved = userSaved.get(u.id) ?? 0;
      const savedVideos = userSavedVideos.get(u.id) ?? 0;
      const sessions = userSessions.get(u.id)?.size ?? 0;
      const lastSeen = userLastSeen.get(u.id) ?? u.created_at;
      const createdMs = new Date(u.created_at).getTime();
      const lastMs = new Date(lastSeen).getTime();
      const gap = lastMs - createdMs;
      return {
        user_id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_seen_at: lastSeen,
        total_sessions: sessions,
        videos_loaded: videos,
        sentence_clicks: clicks,
        words_saved: saved,
        videos_saved: savedVideos,
        activated: videos >= 1 && clicks >= 3,
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
      returned_1d: rows.filter((r) => r.returned_1d).length,
      returned_7d: rows.filter((r) => r.returned_7d).length,
      returned_30d: rows.filter((r) => r.returned_30d).length,
    };

    return { totals, users: rows };
  },
);
