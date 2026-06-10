import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// To view signups: Supabase → Table Editor → early_access_signups
// Or query: SELECT * FROM early_access_signups ORDER BY created_at DESC;

const Input = z.object({
  email: z.string().trim().email().max(255),
  pageUrl: z.string().max(500).optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  sessionId: z.string().max(100).optional().nullable(),
  targetLanguage: z.string().max(50).optional().nullable(),
  currentDutchLevel: z.string().max(50).optional().nullable(),
});

export const submitEarlyAccess = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("early_access_signups" as any)
      .insert({
        email: data.email.toLowerCase(),
        page_url: data.pageUrl ?? null,
        source: data.source ?? null,
        session_id: data.sessionId ?? null,
        target_language: data.targetLanguage ?? null,
        current_dutch_level: data.currentDutchLevel ?? null,
      } as any);

    if (error) {
      // 23505 = unique violation → email already signed up; treat as success
      if ((error as any).code === "23505") {
        return { ok: true, duplicate: true };
      }
      throw new Error(error.message);
    }
    return { ok: true, duplicate: false };
  });
