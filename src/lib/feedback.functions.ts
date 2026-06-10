import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  sessionId: z.string().min(1).max(100).optional().nullable(),
  videoId: z.string().min(1).max(50).optional().nullable(),
  sentiment: z.enum(["positive", "negative"]),
  usefulText: z.string().max(2000).optional().nullable(),
  wouldUseAgain: z.enum(["definitely", "maybe", "probably_not"]).optional().nullable(),
  triggerReason: z.string().max(50).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  pageUrl: z.string().max(500).optional().nullable(),
  totalSentenceClicks: z.number().int().min(0).max(100000).optional().nullable(),
  timeOnPageSeconds: z.number().int().min(0).max(86400).optional().nullable(),
  demoStarted: z.boolean().optional().nullable(),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Write to the new user_feedback table.
    const email = data.email && data.email.length > 0 ? data.email : null;
    const { error } = await supabaseAdmin
      .from("user_feedback" as any)
      .insert({
        session_id: data.sessionId ?? null,
        feedback_type: data.sentiment,
        feedback_text: data.usefulText ?? null,
        would_use_again: data.wouldUseAgain ?? null,
        email,
        page_url: data.pageUrl ?? null,
        total_sentence_clicks: data.totalSentenceClicks ?? 0,
        time_on_page_seconds: data.timeOnPageSeconds ?? 0,
        demo_started: data.demoStarted ?? false,
        trigger_reason: data.triggerReason ?? null,
      } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
