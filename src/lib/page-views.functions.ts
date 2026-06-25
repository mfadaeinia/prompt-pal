import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  sessionId: z.string().min(1).max(128),
  path: z.string().max(500).nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  acquisitionSource: z.string().max(64).nullable().optional(),
  utmSource: z.string().max(120).nullable().optional(),
  utmMedium: z.string().max(120).nullable().optional(),
  utmCampaign: z.string().max(120).nullable().optional(),
});

export const logPageView = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getActiveCohortId } = await import("@/lib/active-cohort.server");
    const cohortId = await getActiveCohortId();
    const { error } = await supabaseAdmin.from("page_views" as any).insert({
      session_id: data.sessionId,
      path: data.path ?? null,
      user_id: data.userId ?? null,
      release_cohort_id: cohortId,
      acquisition_source: data.acquisitionSource ?? null,
      utm_source: data.utmSource ?? null,
      utm_medium: data.utmMedium ?? null,
      utm_campaign: data.utmCampaign ?? null,
    });
    if (error) {
      console.error("page_view_insert_failed", error.message);
      return { ok: false };
    }
    return { ok: true };
  });
