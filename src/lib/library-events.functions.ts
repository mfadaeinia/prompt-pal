import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LogInput = z.object({
  eventName: z.enum([
    "expression_saved",
    "library_opened",
    "watch_again_clicked",
    "saved_item_revisited",
    "sentence_clicked",
    "explanation_viewed",
    // Discovery instrumentation — answer "why are users watching but not clicking?"
    "transcript_visible",
    "transcript_seen",
    "sentence_hovered",
    "first_sentence_click",
    "hint_shown",
    "hint_dismissed",
    "hint_clicked",
  ]),
  sessionId: z.string().min(1).max(128),
  videoId: z.string().max(64).nullable().optional(),
  expressionId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
});


export const logLibraryEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LogInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("library_events" as any).insert({
      event_name: data.eventName,
      session_id: data.sessionId,
      video_id: data.videoId ?? null,
      expression_id: data.expressionId ?? null,
      user_id: data.userId ?? null,
      metadata: data.metadata ?? null,
    });
    if (error) {
      // Don't fail UI flows for analytics — log and return ok
      console.error("library_event_insert_failed", {
        event: data.eventName,
        session: data.sessionId,
        video: data.videoId,
        message: error.message,
      });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  });


export type LibraryMetrics = {
  totalSaves: number;
  uniqueSavers: number;
  libraryOpens: number;
  watchAgainClicks: number;
  savedItemRevisits: number;
  sentenceClicks: number;
  uniqueSentenceClickSessions: number;
  recentEvents: Array<{
    event_name: string;
    session_id: string | null;
    created_at: string;
  }>;
};

export const getLibraryMetrics = createServerFn({ method: "GET" }).handler(
  async (): Promise<LibraryMetrics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [saves, events, recent] = await Promise.all([
      supabaseAdmin.from("saved_expressions" as any).select("session_id"),
      supabaseAdmin.from("library_events" as any).select("event_name,session_id"),
      supabaseAdmin
        .from("library_events" as any)
        .select("event_name,session_id,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const saveRows = ((saves.data ?? []) as unknown) as Array<{ session_id: string }>;
    const evRows = ((events.data ?? []) as unknown) as Array<{
      event_name: string;
      session_id: string | null;
    }>;

    const totalSaves = saveRows.length;
    const uniqueSavers = new Set(saveRows.map((r) => r.session_id).filter(Boolean)).size;
    const libraryOpens = evRows.filter((e) => e.event_name === "library_opened").length;
    const watchAgainClicks = evRows.filter((e) => e.event_name === "watch_again_clicked").length;
    const savedItemRevisits = evRows.filter((e) => e.event_name === "saved_item_revisited").length;
    const clickRows = evRows.filter((e) => e.event_name === "sentence_clicked");
    const sentenceClicks = clickRows.length;
    const uniqueSentenceClickSessions = new Set(
      clickRows.map((r) => r.session_id).filter(Boolean) as string[],
    ).size;

    return {
      totalSaves,
      uniqueSavers,
      libraryOpens,
      watchAgainClicks,
      savedItemRevisits,
      sentenceClicks,
      uniqueSentenceClickSessions,
      recentEvents: (recent.data ?? []) as any,
    };
  },
);

export type SentenceClickDebug = {
  clicksToday: number;
  clicksLast7d: number;
  uniqueSessionsLast7d: number;
  topVideos: Array<{ video_id: string | null; clicks: number; sessions: number }>;
  recent: Array<{
    created_at: string;
    session_id: string | null;
    video_id: string | null;
    user_id: string | null;
  }>;
};

export const getSentenceClickDebug = createServerFn({ method: "GET" }).handler(
  async (): Promise<SentenceClickDebug> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("library_events" as any)
      .select("created_at,session_id,video_id,user_id,event_name")
      .eq("event_name", "sentence_clicked")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("sentence_click_debug_query_failed", error.message);
    }
    const rows = ((data ?? []) as unknown) as Array<{
      created_at: string;
      session_id: string | null;
      video_id: string | null;
      user_id: string | null;
    }>;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    const clicksToday = rows.filter((r) => new Date(r.created_at).getTime() >= todayMs).length;
    const clicksLast7d = rows.length;
    const uniqueSessionsLast7d = new Set(
      rows.map((r) => r.session_id).filter(Boolean) as string[],
    ).size;

    const byVideo = new Map<string, { clicks: number; sessions: Set<string> }>();
    for (const r of rows) {
      const key = r.video_id ?? "(unknown)";
      const entry = byVideo.get(key) ?? { clicks: 0, sessions: new Set<string>() };
      entry.clicks += 1;
      if (r.session_id) entry.sessions.add(r.session_id);
      byVideo.set(key, entry);
    }
    const topVideos = Array.from(byVideo.entries())
      .map(([video_id, v]) => ({
        video_id: video_id === "(unknown)" ? null : video_id,
        clicks: v.clicks,
        sessions: v.sessions.size,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    return {
      clicksToday,
      clicksLast7d,
      uniqueSessionsLast7d,
      topVideos,
      recent: rows.slice(0, 25).map((r) => ({
        created_at: r.created_at,
        session_id: r.session_id,
        video_id: r.video_id,
        user_id: r.user_id,
      })),
    };
  },
);
