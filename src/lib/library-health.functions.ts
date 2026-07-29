import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type LibraryHealthItem = {
  id: string;
  title: string;
  channel: string;
  url: string;
  cefrLevel: string | null;
  reason: string;
  code: string;
  validatedAt: string | null;
};

export type LibraryHealth = {
  active: number;
  needsReplacement: number;
  neverValidated: number;
  lastValidatedAt: string | null;
  byReason: Array<{ code: string; reason: string; count: number }>;
  items: LibraryHealthItem[];
};

function requireFounder(token: string) {
  const expected = process.env.FOUNDER_PASSWORD;
  if (!expected || token !== expected) {
    throw new Response("Unauthorized", { status: 401 });
  }
}

export const getLibraryHealth = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(200) }).parse(d))
  .handler(async ({ data }): Promise<LibraryHealth> => {
    requireFounder(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count: activeCount } = await supabaseAdmin
      .from("curated_videos" as any)
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("is_embeddable", true);

    const { count: neverValidated } = await supabaseAdmin
      .from("curated_videos" as any)
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("validated_at", null);

    const { data: rows, error } = await supabaseAdmin
      .from("curated_videos" as any)
      .select(
        "id, title, channel, url, cefr_level, validation_status, validation_reason, validated_at, status, is_embeddable",
      )
      .or("status.neq.active,is_embeddable.eq.false")
      .neq("validation_status", "ok")
      .order("validated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const items: LibraryHealthItem[] = ((rows ?? []) as any[])
      .filter((r) => r.status !== "stale")
      .map((r) => ({
        id: r.id,
        title: r.title,
        channel: r.channel,
        url: r.url,
        cefrLevel: r.cefr_level ?? null,
        reason: r.validation_reason ?? "Unknown",
        code: r.validation_status ?? "unknown",
        validatedAt: r.validated_at ?? null,
      }));

    const byReasonMap = new Map<string, { code: string; reason: string; count: number }>();
    for (const it of items) {
      const cur = byReasonMap.get(it.code) ?? { code: it.code, reason: it.reason, count: 0 };
      cur.count += 1;
      byReasonMap.set(it.code, cur);
    }

    return {
      active: activeCount ?? 0,
      needsReplacement: items.length,
      neverValidated: neverValidated ?? 0,
      lastValidatedAt: items[0]?.validatedAt ?? null,
      byReason: [...byReasonMap.values()].sort((a, b) => b.count - a.count),
      items,
    };
  });

export const revalidateLibrary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    requireFounder(data.token);
    const { revalidateCatalogue } = await import("./curation/refresh.server");
    const res = await revalidateCatalogue();
    return { revalidated: res.revalidated, deactivated: res.deactivated };
  });
