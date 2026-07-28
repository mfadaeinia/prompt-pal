/**
 * Modular content-provider layer for the Curated Library.
 *
 * Every source of learning material (YouTube today; Spotify, NPO, NOS,
 * Netflix, Videoland later) implements `ContentProvider`. The refresh engine
 * and the UI only ever see `RawCandidate` / `curated_videos` rows, so adding a
 * provider never requires UI changes.
 */

export type RawCandidate = {
  provider: string;
  externalId: string;
  url: string;
  title: string;
  channel: string;
  channelExternalId: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  publishedAt: string | null;
  language: string;
  defaultCategory: string | null;
  popularity: number;
};

export type CuratedSourceRow = {
  id: string;
  provider: string;
  external_id: string;
  name: string;
  language: string;
  default_category: string | null;
  quality_rating: number;
};

export interface ContentProvider {
  /** Stable id, matches curated_videos.provider */
  id: string;
  fetchCandidates(sources: CuratedSourceRow[], perSource: number): Promise<RawCandidate[]>;
}

function textBetween(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function fetchDuration(videoId: string): Promise<number | null> {
  const bases = ["https://api.piped.private.coffee", "https://pipedapi.kavin.rocks"];
  for (const base of bases) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(`${base}/streams/${videoId}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) continue;
      const j: any = await r.json();
      if (typeof j?.duration === "number" && j.duration > 0) return j.duration;
    } catch {
      /* next mirror */
    }
  }
  return null;
}

export const youtubeProvider: ContentProvider = {
  id: "youtube",
  async fetchCandidates(sources, perSource) {
    const out: RawCandidate[] = [];
    await Promise.all(
      sources.map(async (src) => {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 8000);
          const res = await fetch(
            `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(src.external_id)}`,
            { signal: ctrl.signal },
          );
          clearTimeout(t);
          if (!res.ok) return;
          const xml = await res.text();
          const entries = xml.split("<entry>").slice(1, perSource + 1);
          for (const e of entries) {
            const videoId = textBetween(e, "yt:videoId");
            const title = textBetween(e, "title");
            if (!videoId || !title) continue;
            const published = textBetween(e, "published");
            const views = e.match(/statistics views="(\d+)"/);
            out.push({
              provider: "youtube",
              externalId: videoId,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              title: decode(title).slice(0, 300),
              channel: src.name,
              channelExternalId: src.external_id,
              thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              durationSec: null,
              publishedAt: published ?? null,
              language: src.language,
              defaultCategory: src.default_category,
              popularity: views ? Number(views[1]) : 0,
            });
          }
        } catch {
          /* skip source */
        }
      }),
    );

    // Best-effort duration enrichment (bounded concurrency).
    const queue = [...out];
    const workers = Array.from({ length: 6 }, async () => {
      for (;;) {
        const item = queue.shift();
        if (!item) return;
        item.durationSec = await fetchDuration(item.externalId);
      }
    });
    await Promise.all(workers);

    return out;
  },
};

export const providers: Record<string, ContentProvider> = {
  youtube: youtubeProvider,
};
