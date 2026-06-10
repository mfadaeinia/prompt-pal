import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  sessionId: z.string().min(1).max(100).optional().nullable(),
  videoId: z.string().min(1).max(50).optional().nullable(),
  sentiment: z.enum(["positive", "negative"]),
  usefulText: z.string().max(2000).optional().nullable(),
  wouldUseAgain: z.enum(["definitely", "maybe", "probably_not"]).optional().nullable(),
  triggerReason: z.string().max(50).optional().nullable(),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("feedback_responses" as any)
      .insert({
        session_id: data.sessionId ?? null,
        video_id: data.videoId ?? null,
        sentiment: data.sentiment,
        useful_text: data.usefulText ?? null,
        would_use_again: data.wouldUseAgain ?? null,
        trigger_reason: data.triggerReason ?? null,
      } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
