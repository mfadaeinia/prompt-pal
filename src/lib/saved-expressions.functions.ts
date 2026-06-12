import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SaveInput = z.object({
  sessionId: z.string().min(1).max(128),
  sentenceText: z.string().min(1).max(2000),
  translation: z.string().max(2000).nullable().optional(),
  meaning: z.string().max(2000).nullable().optional(),
  expressionNotes: z.string().max(2000).nullable().optional(),
  videoTitle: z.string().max(500).nullable().optional(),
  videoUrl: z.string().max(1000).nullable().optional(),
  videoId: z.string().max(64).nullable().optional(),
  timestampSeconds: z.number().int().min(0).max(86400).default(0),
  targetLanguage: z.string().max(40).nullable().optional(),
});

export const saveExpression = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("saved_expressions")
      .insert({
        session_id: data.sessionId,
        sentence_text: data.sentenceText,
        translation: data.translation ?? null,
        meaning: data.meaning ?? null,
        expression_notes: data.expressionNotes ?? null,
        video_title: data.videoTitle ?? null,
        video_url: data.videoUrl ?? null,
        video_id: data.videoId ?? null,
        timestamp_seconds: data.timestampSeconds,
        target_language: data.targetLanguage ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

const ListInput = z.object({
  sessionId: z.string().min(1).max(128),
});

export const listSavedExpressions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("saved_expressions")
      .select("*")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

const DeleteInput = z.object({
  sessionId: z.string().min(1).max(128),
  id: z.string().uuid(),
});

export const deleteSavedExpression = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DeleteInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("saved_expressions")
      .delete()
      .eq("id", data.id)
      .eq("session_id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
