import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const LIBRARY_CATEGORIES = [
  "News",
  "Daily Life",
  "Travel",
  "Comedy",
  "Interviews",
  "Technology",
  "Science",
  "History",
  "Cooking",
  "Podcasts",
  "Business",
  "Culture",
  "Kids",
  "Movies & TV",
  "Learning Dutch",
  "Music",
] as const;

export type CuratedVideo = {
  id: string;
  provider: string;
  external_id: string;
  url: string;
  title: string;
  channel: string;
  thumbnail_url: string | null;
  duration_sec: number | null;
  published_at: string | null;
  language: string;
  cefr_level: CefrLevel | null;
  speaking_speed: "slow" | "normal" | "fast" | null;
  words_per_minute: number | null;
  category: string | null;
  topics: string[];
  summary: string | null;
  quality_score: number;
  popularity: number;
  featured_week: string | null;
  added_at: string;
};

const SELECT =
  "id, provider, external_id, url, title, channel, thumbnail_url, duration_sec, published_at, language, cefr_level, speaking_speed, words_per_minute, category, topics, summary, quality_score, popularity, featured_week, added_at";

export const listCuratedVideos = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ limit: z.number().min(1).max(300).optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data }): Promise<{ items: CuratedVideo[] }> => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: rows, error } = await supabase
      .from("curated_videos" as any)
      .select(SELECT)
      .eq("status", "active")
      .order("published_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as unknown as CuratedVideo[] };
  });

/* ------------------------------- interactions ------------------------------ */

const KINDS = ["bookmark", "watched", "like", "dislike"] as const;
export type InteractionKind = (typeof KINDS)[number];

export const listMyInteractions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("video_interactions" as any)
      .select("curated_video_id, kind");
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as unknown as Array<{ curated_video_id: string; kind: InteractionKind }> };
  });

export const toggleInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ videoId: z.string().uuid(), kind: z.enum(KINDS), on: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.on) {
      const { error } = await supabase
        .from("video_interactions" as any)
        .delete()
        .eq("user_id", userId)
        .eq("curated_video_id", data.videoId)
        .eq("kind", data.kind);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    // like/dislike are mutually exclusive
    if (data.kind === "like" || data.kind === "dislike") {
      await supabase
        .from("video_interactions" as any)
        .delete()
        .eq("user_id", userId)
        .eq("curated_video_id", data.videoId)
        .eq("kind", data.kind === "like" ? "dislike" : "like");
    }
    const { error } = await supabase.from("video_interactions" as any).upsert(
      { user_id: userId, curated_video_id: data.videoId, kind: data.kind },
      { onConflict: "user_id,curated_video_id,kind" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------- preferences ------------------------------- */

export const getLearningPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_learning_prefs" as any)
      .select("target_level, preferred_categories")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      targetLevel: ((data as any)?.target_level ?? null) as CefrLevel | null,
      preferredCategories: ((data as any)?.preferred_categories ?? []) as string[],
    };
  });

export const setLearningPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ targetLevel: z.enum(CEFR_LEVELS).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_learning_prefs" as any).upsert(
      { user_id: context.userId, target_level: data.targetLevel },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
