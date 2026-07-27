import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_saved_expressions",
  title: "List saved expressions",
  description:
    "List the sentences and expressions the signed-in user saved while watching videos in NativeFlow, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("How many to return (default 20)."),
    search: z.string().optional().describe("Optional text filter on the saved sentence."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, search }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let query = supabaseForUser(ctx)
      .from("saved_expressions")
      .select(
        "id, sentence_text, translation, meaning, expression_notes, target_language, timestamp_seconds, video_title, video_url, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (search?.trim()) query = query.ilike("sentence_text", `%${search.trim()}%`);

    const { data, error } = await query;
    if (error) return fail(error.message);
    return ok(data ?? [], { expressions: data ?? [] });
  },
});
