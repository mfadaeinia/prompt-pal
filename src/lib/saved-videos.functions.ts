import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SaveInput = z.object({
  videoId: z.string().min(1).max(64),
  videoUrl: z.string().min(1).max(1000),
  videoTitle: z.string().max(500).nullable().optional(),
  thumbnailUrl: z.string().max(1000).nullable().optional(),
  targetLanguage: z.string().max(40).nullable().optional(),
  sessionId: z.string().max(128).nullable().optional(),
});

export const saveVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("saved_videos")
      .upsert(
        {
          user_id: userId,
          video_id: data.videoId,
          video_url: data.videoUrl,
          video_title: data.videoTitle ?? null,
          thumbnail_url:
            data.thumbnailUrl ?? `https://i.ytimg.com/vi/${data.videoId}/hqdefault.jpg`,
          target_language: data.targetLanguage ?? null,
          session_id: data.sessionId ?? null,
        },
        { onConflict: "user_id,video_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const listSavedVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("saved_videos")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

const DeleteInput = z.object({ id: z.string().uuid() });

export const deleteSavedVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeleteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("saved_videos")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
