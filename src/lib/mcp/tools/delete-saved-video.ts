import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "delete_saved_video",
  title: "Remove a saved video",
  description: "Remove a video from the signed-in user's NativeFlow library by its saved row id.",
  inputSchema: {
    id: z.string().min(1).describe("The id returned by list_saved_videos."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { error } = await supabaseForUser(ctx).from("saved_videos").delete().eq("id", id);
    if (error) return fail(error.message);
    return ok({ deleted: id }, { deleted: id });
  },
});
