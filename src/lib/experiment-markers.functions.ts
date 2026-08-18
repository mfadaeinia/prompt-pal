import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ExperimentMarker = {
  id: string;
  title: string;
  note: string | null;
  occurred_at: string;
};

export const listExperimentMarkers = createServerFn({ method: "GET" }).handler(
  async (): Promise<ExperimentMarker[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("experiment_markers" as any)
      .select("id,title,note,occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(200);
    return ((data ?? []) as unknown) as ExperimentMarker[];
  },
);

export const addExperimentMarker = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().min(1).max(120),
        note: z.string().max(1000).nullable().optional(),
        occurredAt: z.string().datetime().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ExperimentMarker> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("experiment_markers" as any)
      .insert({
        title: data.title,
        note: data.note ?? null,
        occurred_at: data.occurredAt ?? new Date().toISOString(),
      } as any)
      .select("id,title,note,occurred_at")
      .single();
    if (error) throw new Error(error.message);
    return ((row ?? {}) as unknown) as ExperimentMarker;
  });

export const deleteExperimentMarker = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("experiment_markers" as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
