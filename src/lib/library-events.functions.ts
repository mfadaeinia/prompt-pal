import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LogInput = z.object({
  eventName: z.enum([
    "expression_saved",
    "library_opened",
    "watch_again_clicked",
    "saved_item_revisited",
    "sentence_clicked",
  ]),
  sessionId: z.string().min(1).max(128),
  videoId: z.string().max(64).nullable().optional(),
  expressionId: z.string().uuid().nullable().optional(),
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
      metadata: data.metadata ?? null,
    });
    if (error) {
      // Don't fail UI flows for analytics — log and return ok
      console.error("library_event_insert_failed", error.message);
    }
    return { ok: true };
  });

export type LibraryMetrics = {
  totalSaves: number;
  uniqueSavers: number;
  libraryOpens: number;
  watchAgainClicks: number;
  savedItemRevisits: number;
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
      supabaseAdmin.from("library_events" as any).select("event_name"),
      supabaseAdmin
        .from("library_events" as any)
        .select("event_name,session_id,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const saveRows = ((saves.data ?? []) as unknown) as Array<{ session_id: string }>;
    const evRows = ((events.data ?? []) as unknown) as Array<{ event_name: string }>;

    const totalSaves = saveRows.length;
    const uniqueSavers = new Set(saveRows.map((r) => r.session_id).filter(Boolean)).size;
    const libraryOpens = evRows.filter((e) => e.event_name === "library_opened").length;
    const watchAgainClicks = evRows.filter((e) => e.event_name === "watch_again_clicked").length;
    const savedItemRevisits = evRows.filter((e) => e.event_name === "saved_item_revisited").length;

    return {
      totalSaves,
      uniqueSavers,
      libraryOpens,
      watchAgainClicks,
      savedItemRevisits,
      recentEvents: (recent.data ?? []) as any,
    };
  },
);
