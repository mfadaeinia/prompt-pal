import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  sessionId: z.string().min(1).max(100).optional().nullable(),
  videoId: z.string().min(1).max(50).optional().nullable(),
  // Legacy
  sentiment: z.enum(["positive", "negative"]).optional().nullable(),
  usefulText: z.string().max(2000).optional().nullable(),
  wouldUseAgain: z.enum(["definitely", "maybe", "probably_not"]).optional().nullable(),
  // New comprehension signal
  comprehensionHelpful: z.enum(["yes", "sort_of", "no"]).optional().nullable(),
  vsCurrentWorkflow: z.enum(["faster", "same", "slower"]).optional().nullable(),
  failureReason: z.string().max(60).optional().nullable(),
  // Context
  triggerReason: z.string().max(50).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  pageUrl: z.string().max(500).optional().nullable(),
  totalSentenceClicks: z.number().int().min(0).max(100000).optional().nullable(),
  uniqueSegmentsClicked: z.number().int().min(0).max(100000).optional().nullable(),
  explanationsOpened: z.number().int().min(0).max(100000).optional().nullable(),
  timeOnPageSeconds: z.number().int().min(0).max(86400).optional().nullable(),
  secondsWatched: z.number().int().min(0).max(86400).optional().nullable(),
  isOwnVideo: z.boolean().optional().nullable(),
  targetLanguage: z.string().max(50).optional().nullable(),
  demoStarted: z.boolean().optional().nullable(),
  feedbackText: z.string().max(2000).optional().nullable(),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email && data.email.length > 0 ? data.email : null;

    // Derive sentiment from comprehension answer for backwards compatibility.
    const derivedSentiment =
      data.sentiment ??
      (data.comprehensionHelpful === "yes"
        ? "positive"
        : data.comprehensionHelpful === "no"
          ? "negative"
          : data.comprehensionHelpful === "sort_of"
            ? "positive"
            : "positive");

    const { error } = await supabaseAdmin
      .from("user_feedback" as any)
      .insert({
        session_id: data.sessionId ?? null,
        feedback_type: derivedSentiment,
        feedback_text: data.feedbackText ?? data.usefulText ?? null,
        would_use_again: data.wouldUseAgain ?? null,
        email,
        page_url: data.pageUrl ?? null,
        total_sentence_clicks: data.totalSentenceClicks ?? 0,
        time_on_page_seconds: data.timeOnPageSeconds ?? 0,
        demo_started: data.demoStarted ?? false,
        trigger_reason: data.triggerReason ?? null,
        comprehension_helpful: data.comprehensionHelpful ?? null,
        vs_current_workflow: data.vsCurrentWorkflow ?? null,
        failure_reason: data.failureReason ?? null,
        explanations_opened: data.explanationsOpened ?? 0,
        unique_segments_clicked: data.uniqueSegmentsClicked ?? 0,
        is_own_video: data.isOwnVideo ?? false,
        target_language: data.targetLanguage ?? null,
        seconds_watched: data.secondsWatched ?? 0,
      } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
