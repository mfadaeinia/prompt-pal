import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_saved_videos",
  title: "List saved videos",
  description: "List the YouTube videos the signed-in user saved to their NativeFlow library, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("How many to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("saved_videos")
      .select("id, video_id, video_title, video_url, thumbnail_url, target_language, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return fail(error.message);
    return ok(data ?? [], { videos: data ?? [] });
  },
});
