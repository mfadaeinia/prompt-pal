import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RecordInput = z.object({
  testerId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  eventName: z.enum([
    "page_view",
    "video_loaded",
    "transcript_loaded",
    "sentence_clicked",
    "expression_saved",
    "feedback_submitted",
  ]),
  sessionId: z.string().max(128).nullable().optional(),
  videoId: z.string().max(64).nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
});

export const recordTesterEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RecordInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tester_events" as any).insert({
      tester_id: data.testerId,
      event_name: data.eventName,
      session_id: data.sessionId ?? null,
      video_id: data.videoId ?? null,
      metadata: data.metadata ?? null,
    });
    if (error) {
      console.error("tester_event_insert_failed", error.message);
    }
    return { ok: true };
  });

export type TesterRow = {
  tester_id: string;
  first_seen_at: string;
  last_seen_at: string;
  total_sessions: number;
  videos_loaded: number;
  sentence_clicks: number;
  expressions_saved: number;
  feedback_submitted_count: number;
  returned_7d: boolean;
  activated: boolean;
};

export type TesterCohortMetrics = {
  invited: number;
  testers: TesterRow[];
  totals: {
    activated: number;
    loadedVideo: number;
    clickedThreeSentences: number;
    returned7d: number;
  };
};

const DAY = 24 * 60 * 60 * 1000;

export const getTesterCohort = createServerFn({ method: "GET" }).handler(
  async (): Promise<TesterCohortMetrics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("tester_events" as any)
      .select("tester_id,event_name,session_id,created_at")
      .order("created_at", { ascending: true })
      .limit(50000);
    if (error) throw new Error(error.message);

    const rows = ((data ?? []) as unknown) as Array<{
      tester_id: string;
      event_name: string;
      session_id: string | null;
      created_at: string;
    }>;

    const byTester = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byTester.get(r.tester_id) ?? [];
      list.push(r);
      byTester.set(r.tester_id, list);
    }

    const testers: TesterRow[] = [];
    for (const [testerId, events] of byTester) {
      const firstSeen = events[0]!.created_at;
      const lastSeen = events[events.length - 1]!.created_at;
      const firstSeenMs = new Date(firstSeen).getTime();
      const sessions = new Set<string>();
      let videosLoaded = 0;
      let sentenceClicks = 0;
      let expressionsSaved = 0;
      let feedback = 0;
      let returned7d = false;

      for (const e of events) {
        if (e.session_id) sessions.add(e.session_id);
        if (e.event_name === "video_loaded") videosLoaded++;
        else if (e.event_name === "sentence_clicked") sentenceClicks++;
        else if (e.event_name === "expression_saved") expressionsSaved++;
        else if (e.event_name === "feedback_submitted") feedback++;

        if (e.event_name === "video_loaded" || e.event_name === "sentence_clicked") {
          const dt = new Date(e.created_at).getTime() - firstSeenMs;
          if (dt >= 6 * DAY && dt <= 10 * DAY) returned7d = true;
        }
      }

      const activated = videosLoaded >= 1 && sentenceClicks >= 3;
      testers.push({
        tester_id: testerId,
        first_seen_at: firstSeen,
        last_seen_at: lastSeen,
        total_sessions: sessions.size,
        videos_loaded: videosLoaded,
        sentence_clicks: sentenceClicks,
        expressions_saved: expressionsSaved,
        feedback_submitted_count: feedback,
        returned_7d: returned7d,
        activated,
      });
    }

    testers.sort((a, b) => (a.first_seen_at < b.first_seen_at ? -1 : 1));

    const totals = {
      activated: testers.filter((t) => t.activated).length,
      loadedVideo: testers.filter((t) => t.videos_loaded >= 1).length,
      clickedThreeSentences: testers.filter((t) => t.sentence_clicks >= 3).length,
      returned7d: testers.filter((t) => t.returned_7d).length,
    };

    return {
      invited: 10, // 10-person validation test cohort
      testers,
      totals,
    };
  },
);
