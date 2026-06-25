import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

const Input = z.object({
  sessionId: z.string().min(1).max(100),
  videoId: z.string().min(1).max(100),
  durationSeconds: z.number().int().min(0).max(60 * 60 * 24),
  videoUrl: z.string().max(500).optional().nullable(),
  targetLanguage: z.string().max(50).optional().nullable(),
  pageUrl: z.string().max(500).optional().nullable(),
  ended: z.boolean().optional(),
  userId: z.string().uuid().optional().nullable(),
  acquisitionSource: z.string().max(64).optional().nullable(),
  utmSource: z.string().max(120).optional().nullable(),
  utmMedium: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(120).optional().nullable(),
});

function getClientIp(): string | null {
  try {
    const cf = getRequestHeader("cf-connecting-ip");
    if (cf) return cf;
    const xff = getRequestHeader("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
    const real = getRequestHeader("x-real-ip");
    if (real) return real;
    return getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {
    return null;
  }
}

export const recordVideoSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getActiveCohortId } = await import("@/lib/active-cohort.server");
    const cohortId = await getActiveCohortId();
    const ip = getClientIp();
    const userAgent = (() => { try { return getRequestHeader("user-agent") ?? null; } catch { return null; } })();
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
          ip_address: ip,
          user_agent: userAgent,
          user_id: data.userId ?? null,
          release_cohort_id: cohortId,
          acquisition_source: data.acquisitionSource ?? null,
          utm_source: data.utmSource ?? null,
          utm_medium: data.utmMedium ?? null,
          utm_campaign: data.utmCampaign ?? null,
        } as any,
        { onConflict: "session_id,video_id" } as any,
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });


