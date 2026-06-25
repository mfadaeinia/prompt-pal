import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  sessionId: z.string().min(1).max(128),
  path: z.string().max(500).nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
});

export const logPageView = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("page_views" as any).insert({
      session_id: data.sessionId,
      path: data.path ?? null,
      user_id: data.userId ?? null,
    });
    if (error) {
      console.error("page_view_insert_failed", error.message);
      return { ok: false };
    }
    return { ok: true };
  });
