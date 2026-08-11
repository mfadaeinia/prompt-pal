import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  sessionId: z.string().min(1).max(128),
  anonymousId: z.string().max(128).nullable().optional(),
  path: z.string().max(500).nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  referrer: z.string().max(500).nullable().optional(),
  utmSource: z.string().max(120).nullable().optional(),
  utmMedium: z.string().max(120).nullable().optional(),
  utmCampaign: z.string().max(120).nullable().optional(),
});

function classifyReferrer(ref: string | null | undefined): string | null {
  if (!ref) return "Direct";
  try {
    const host = new URL(ref).hostname.toLowerCase();
    if (!host) return "Direct";
    if (host.includes("instagram")) return "Instagram";
    if (host.includes("facebook")) return "Facebook";
    if (host.includes("reddit")) return "Reddit";
    if (host.includes("google") || host.includes("bing") || host.includes("duckduckgo"))
      return "Google";
    if (host.includes("nativeflow")) return "Direct";
    return host;
  } catch {
    return "Other Web";
  }
}

export const logPageView = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const acquisition =
      data.utmSource && data.utmSource.length > 0
        ? data.utmSource
        : classifyReferrer(data.referrer ?? null);
    const { error } = await supabaseAdmin.from("page_views" as any).insert({
      session_id: data.sessionId,
      anonymous_id: data.anonymousId ?? null,
      path: data.path ?? null,
      user_id: data.userId ?? null,
      acquisition_source: acquisition,
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
