import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return match ? match[1] : null;
}

export default defineTool({
  name: "save_video",
  title: "Save a video",
  description:
    "Save a YouTube video to the signed-in user's NativeFlow library so they can study it with sentence-level explanations.",
  inputSchema: {
    video: z.string().min(1).describe("A YouTube URL or an 11-character video id."),
    title: z.string().optional().describe("Optional title to store with the video."),
    target_language: z.string().optional().describe("Language being learned, e.g. 'nl'."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ video, title, target_language }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const videoId = extractVideoId(video);
    if (!videoId) return fail("Could not read a YouTube video id from that input.");

    const { data, error } = await supabaseForUser(ctx)
      .from("saved_videos")
      .insert({
        user_id: ctx.getUserId()!,
        video_id: videoId,
        video_url: `https://www.youtube.com/watch?v=${videoId}`,
        video_title: title ?? null,
        target_language: target_language ?? null,
        thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      })
      .select("id, video_id, video_title, video_url")
      .single();

    if (error) return fail(error.message);
    return ok(data, { video: data });
  },
});
