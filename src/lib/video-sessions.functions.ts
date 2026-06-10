import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// To view engagement: Supabase → Table Editor → video_sessions
// Or query: SELECT video_id, session_id, duration_seconds, started_at, last_seen_at, ended
//   FROM video_sessions ORDER BY started_at DESC;

const Input = z.object({
  sessionId: z.string().min(1).max(100),
  videoId: z.string().min(1).max(100),
  durationSeconds: z.number().int().min(0).max(60 * 60 * 24),
  videoUrl: z.string().max(500).optional().nullable(),
  targetLanguage: z.string().max(50).optional().nullable(),
  pageUrl: z.string().max(500).optional().nullable(),
  ended: z.boolean().optional(),
});

export const recordVideoSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("video_sessions" as any)
      .upsert(
        {
          session_id: data.sessionId,
          video_id: data.videoId,
          video_url: data.videoUrl ?? null,
          target_language: data.targetLanguage ?? null,
          page_url: data.pageUrl ?? null,
          duration_seconds: data.durationSeconds,
          last_seen_at: new Date().toISOString(),
          ended: data.ended ?? false,
        } as any,
        { onConflict: "session_id,video_id" } as any,
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
