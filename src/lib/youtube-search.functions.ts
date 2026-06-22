import { createServerFn } from "@tanstack/react-start";

export type YouTubeSearchResult = {
  videoId: string;
  url: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSec: number | null;
  /** Known spoken language (ISO-639-1) — set on curated examples so the
   *  transcript fetcher requests the right caption track instead of letting
   *  YouTube serve an auto-translated one. */
  language?: string;
};

const PIPED_INSTANCES = [
  "https://api.piped.private.coffee",
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.reallyaweso.me",
];

function extractVideoId(u: string): string | null {
  const m = u.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

export const searchYouTube = createServerFn({ method: "POST" })
  .inputValidator((data: { q: string }) => ({ q: String(data?.q ?? "").trim().slice(0, 200) }))
  .handler(async ({ data }): Promise<{ results: YouTubeSearchResult[] }> => {
    const q = data.q;
    if (!q) return { results: [] };

    for (const base of PIPED_INSTANCES) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const r = await fetch(
          `${base}/search?q=${encodeURIComponent(q)}&filter=videos`,
          { signal: ctrl.signal, headers: { accept: "application/json" } },
        );
        clearTimeout(t);
        if (!r.ok) continue;
        const json = (await r.json()) as { items?: any[] };
        const items = Array.isArray(json.items) ? json.items : [];
        const results: YouTubeSearchResult[] = [];
        for (const it of items) {
          if (it?.type && it.type !== "stream") continue;
          const rel = typeof it?.url === "string" ? it.url : "";
          const vid = extractVideoId(rel);
          if (!vid) continue;
          results.push({
            videoId: vid,
            url: `https://www.youtube.com/watch?v=${vid}`,
            title: String(it?.title ?? "").slice(0, 200),
            channel: String(it?.uploaderName ?? "").slice(0, 120),
            thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
            durationSec:
              typeof it?.duration === "number" && it.duration > 0 ? it.duration : null,
          });
          if (results.length >= 12) break;
        }
        if (results.length > 0) return { results };
      } catch {
        // try next instance
      }
    }
    return { results: [] };
  });
