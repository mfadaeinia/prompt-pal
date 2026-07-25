import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export type DutchMediaItem = {
  id: string;
  title: string;
  source_url: string;
  video_id: string;
  thumbnail_url: string;
  source: string;
  category: "top_story" | "trending" | "culture" | "expat";
  duration_sec: number | null;
  difficulty: string | null;
  short_english_summary: string | null;
  why_it_matters: string | null;
  language: string;
  featured_date: string;
  sort_order: number;
};

export type TodayFeed = {
  featuredDate: string | null;
  topStory: DutchMediaItem | null;
  trending: DutchMediaItem[];
  culture: DutchMediaItem[];
  expat: DutchMediaItem[];
};

export const getTodayFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<TodayFeed> => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    // Latest featured_date <= today with any items
    const { data: latest } = await supabase
      .from("dutch_media_items")
      .select("featured_date")
      .lte("featured_date", new Date().toISOString().slice(0, 10))
      .eq("status", "published")
      .order("featured_date", { ascending: false })
      .limit(1);

    const featuredDate = latest?.[0]?.featured_date ?? null;
    if (!featuredDate) {
      return { featuredDate: null, topStory: null, trending: [], culture: [], expat: [] };
    }

    const { data } = await supabase
      .from("dutch_media_items")
      .select(
        "id,title,source_url,video_id,thumbnail_url,source,category,duration_sec,difficulty,short_english_summary,why_it_matters,language,featured_date,sort_order",
      )
      .eq("status", "published")
      .eq("featured_date", featuredDate)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });

    const items = (data ?? []) as DutchMediaItem[];
    const byCat = (c: DutchMediaItem["category"]) => items.filter((i) => i.category === c);
    return {
      featuredDate,
      topStory: byCat("top_story")[0] ?? null,
      trending: byCat("trending"),
      culture: byCat("culture"),
      expat: byCat("expat"),
    };
  },
);
