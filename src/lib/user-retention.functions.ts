import { createServerFn } from "@tanstack/react-start";

export type UserRetentionRow = {
  user_id: string;
  email: string | null;
  created_at: string;
  last_seen_at: string;
  total_sessions: number;
  videos_loaded: number;
  sentence_clicks: number;
  words_saved: number;
  activated: boolean;
  returned_1d: boolean;
  returned_7d: boolean;
  returned_30d: boolean;
};

export type UserRetentionCohort = {
  totals: {
    new_users: number;
    activated: number;
    activation_rate: number; // 0..1
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
        users.push({
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
        });
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

    // 2. Get session_id → user_id mapping via saved tables (only sources
    // that link sessions to authenticated users).
    const [se, sv] = await Promise.all([
      supabaseAdmin
        .from("saved_expressions" as any)
        .select("user_id,session_id,created_at")
        .in("user_id", userIds),
      supabaseAdmin
        .from("saved_videos" as any)
        .select("user_id,session_id,created_at")
        .in("user_id", userIds),
    ]);

    const userSessions = new Map<string, Set<string>>();
    const userLastSeen = new Map<string, string>();
    const userSaved = new Map<string, number>();

    const bump = (uid: string, sid: string | null, ts: string) => {
      if (!userSessions.has(uid)) userSessions.set(uid, new Set());
      if (sid) userSessions.get(uid)!.add(sid);
      const prev = userLastSeen.get(uid);
      if (!prev || ts > prev) userLastSeen.set(uid, ts);
    };

    for (const r of ((se.data ?? []) as any[])) {
      if (!r.user_id) continue;
      bump(r.user_id, r.session_id, r.created_at);
      userSaved.set(r.user_id, (userSaved.get(r.user_id) ?? 0) + 1);
    }
    for (const r of ((sv.data ?? []) as any[])) {
      if (!r.user_id) continue;
      bump(r.user_id, r.session_id, r.created_at);
    }

    // 3. Look up session-level activity for these sessions
    const allSids = new Set<string>();
    for (const s of userSessions.values()) for (const sid of s) allSids.add(sid);
    const sidArr = Array.from(allSids);

    const sessionToUser = new Map<string, string>();
    for (const [uid, sids] of userSessions) for (const sid of sids) sessionToUser.set(sid, uid);

    let vsRows: Array<{ session_id: string; video_id: string; last_seen_at: string }> = [];
    let leRows: Array<{ session_id: string; created_at: string }> = [];

    if (sidArr.length > 0) {
      // Chunk in case of many sessions
      const chunk = <T,>(arr: T[], n: number) => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
        return out;
      };
      for (const part of chunk(sidArr, 500)) {
        const [vs, le] = await Promise.all([
          supabaseAdmin
            .from("video_sessions" as any)
            .select("session_id,video_id,last_seen_at")
            .in("session_id", part),
          supabaseAdmin
            .from("library_events" as any)
            .select("session_id,created_at")
            .eq("event_name", "sentence_clicked")
            .in("session_id", part),
        ]);
        vsRows = vsRows.concat(((vs.data ?? []) as any[]));
        leRows = leRows.concat(((le.data ?? []) as any[]));
      }
    }

    const userVideos = new Map<string, Set<string>>();
    const userClicks = new Map<string, number>();

    for (const r of vsRows) {
      const uid = sessionToUser.get(r.session_id);
      if (!uid) continue;
      if (!userVideos.has(uid)) userVideos.set(uid, new Set());
      userVideos.get(uid)!.add(r.video_id);
      if (r.last_seen_at) {
        const prev = userLastSeen.get(uid);
        if (!prev || r.last_seen_at > prev) userLastSeen.set(uid, r.last_seen_at);
      }
    }
    for (const r of leRows) {
      const uid = sessionToUser.get(r.session_id);
      if (!uid) continue;
      userClicks.set(uid, (userClicks.get(uid) ?? 0) + 1);
      if (r.created_at) {
        const prev = userLastSeen.get(uid);
        if (!prev || r.created_at > prev) userLastSeen.set(uid, r.created_at);
      }
    }

    // 4. Build rows
    const now = Date.now();
    const rows: UserRetentionRow[] = users.map((u) => {
      const videos = userVideos.get(u.id)?.size ?? 0;
      const clicks = userClicks.get(u.id) ?? 0;
      const saved = userSaved.get(u.id) ?? 0;
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
