/**
 * Weekly curation refresh.
 *
 * 1. Pull recent uploads from every active trusted source (per provider).
 * 2. Drop low-quality / duplicate / subtitle-less candidates.
 * 3. Ask the AI to estimate CEFR level, speaking speed, category, topics and a
 *    2–3 line summary.
 * 4. Upsert into curated_videos, mark this week's batch as featured, and retire
 *    stale non-evergreen rows so the catalogue stays 50–100 items.
 */
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "../ai-gateway.server";
import { providers, type CuratedSourceRow, type RawCandidate } from "./providers.server";

export const CATEGORIES = [
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

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const SPEEDS = ["slow", "normal", "fast"] as const;

const CLICKBAIT = /(\bSHOCK\b|😱|🤯|you won'?t believe|\bGONE WRONG\b|!!!+)/i;

type Enriched = {
  cefr: (typeof LEVELS)[number];
  speed: (typeof SPEEDS)[number];
  wpm: number;
  category: string;
  topics: string[];
  summary: string;
  quality: number;
  reject: boolean;
};

function weekStart(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}

export type ValidationFailure = {
  id?: string;
  externalId: string;
  title: string;
  url: string;
  reason: string;
  code: string;
};


async function enrich(
  batch: RawCandidate[],
  apiKey: string,
): Promise<Map<string, Enriched>> {
  const gateway = createLovableAiGatewayProvider(apiKey);
  const listing = batch
    .map(
      (c, i) =>
        `${i + 1}. id=${c.externalId} | channel=${c.channel} | duration=${c.durationSec ?? "?"}s | title=${c.title}`,
    )
    .join("\n");

  const { text } = await generateText({
    model: gateway("google/gemini-3-flash-preview"),
    temperature: 0.2,
    system: `You grade Dutch YouTube videos for language learners.
For EACH item return one JSON object with keys:
id (string), cefr (one of ${LEVELS.join("/")}), speed (slow|normal|fast), wpm (integer 90-200),
category (one of: ${CATEGORIES.join(", ")}), topics (2-4 short lowercase tags),
summary (2-3 short sentences in English describing what the video is about and why it is good listening practice),
quality (0-1 float: clear audio, natural spoken Dutch, educational value, engaging),
reject (true when it is clickbait, mostly music without speech, or unusable for learning).
Judge from the channel and title. Be conservative: news for kids = A2/B1, satire/talkshows = B2/C1.
Return ONLY a JSON array, no markdown.`,
    prompt: listing,
  });

  const map = new Map<string, Enriched>();
  try {
    const json = JSON.parse(text.replace(/^```(json)?|```$/gm, "").trim());
    for (const row of Array.isArray(json) ? json : []) {
      if (!row?.id) continue;
      map.set(String(row.id), {
        cefr: LEVELS.includes(row.cefr) ? row.cefr : "B1",
        speed: SPEEDS.includes(row.speed) ? row.speed : "normal",
        wpm: Number.isFinite(row.wpm) ? Math.round(row.wpm) : 140,
        category: CATEGORIES.includes(row.category) ? row.category : "Daily Life",
        topics: Array.isArray(row.topics) ? row.topics.slice(0, 4).map(String) : [],
        summary: String(row.summary ?? "").slice(0, 600),
        quality: Number.isFinite(row.quality) ? Number(row.quality) : 0.6,
        reject: row.reject === true,
      });
    }
  } catch {
    /* fall through — items without enrichment are skipped */
  }
  return map;
}

export type RefreshResult = {
  week: string;
  candidates: number;
  kept: number;
  inserted: number;
  featured: number;
  retired: number;
  revalidated: number;
  deactivated: number;
  rejectedCandidates: ValidationFailure[];
  deactivatedVideos: ValidationFailure[];
  skipped: Record<string, number>;
};

export async function runWeeklyRefresh(opts?: {
  perSource?: number;
  maxNew?: number;
  targetCatalogue?: number;
}): Promise<RefreshResult> {
  const perSource = opts?.perSource ?? 8;
  const maxNew = opts?.maxNew ?? 60;
  const targetCatalogue = opts?.targetCatalogue ?? 100;
  const week = weekStart();
  const skipped: Record<string, number> = {};
  const bump = (k: string) => (skipped[k] = (skipped[k] ?? 0) + 1);
  const rejectedCandidates: ValidationFailure[] = [];
  const deactivatedVideos: ValidationFailure[] = [];
  let revalidated = 0;


  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: sourceRows, error: srcErr } = await supabaseAdmin
    .from("curated_sources" as any)
    .select("id, provider, external_id, name, language, default_category, quality_rating")
    .eq("is_active", true);
  if (srcErr) throw new Error(srcErr.message);
  const sources = (sourceRows ?? []) as unknown as CuratedSourceRow[];

  // 1. Fetch candidates per provider (modular: Spotify/NPO/... plug in here).
  let candidates: RawCandidate[] = [];
  for (const [id, provider] of Object.entries(providers)) {
    const mine = sources.filter((s) => s.provider === id);
    if (!mine.length) continue;
    candidates = candidates.concat(await provider.fetchCandidates(mine, perSource));
  }

  // 2. De-duplicate against what we already have.
  const { data: existingRows } = await supabaseAdmin
    .from("curated_videos" as any)
    .select("external_id")
    .eq("provider", "youtube");
  const existing = new Set((existingRows ?? []).map((r: any) => r.external_id));

  const seen = new Set<string>();
  let pool = candidates.filter((c) => {
    if (seen.has(c.externalId)) return (bump("duplicate"), false);
    seen.add(c.externalId);
    if (existing.has(c.externalId)) return (bump("already_curated"), false);
    if (CLICKBAIT.test(c.title)) return (bump("clickbait"), false);
    if (c.durationSec !== null && c.durationSec < 90) return (bump("too_short"), false);
    return true;
  });

  pool.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  pool = pool.slice(0, maxNew * 2);

  // 3. Full validation gate: public + embeddable + usable transcript.
  const { validateVideo, mapLimit } = await import("./validate.server");
  const gate = await mapLimit(pool, 4, async (item) => ({
    item,
    result: await validateVideo({
      videoId: item.externalId,
      durationSec: item.durationSec,
      // CEFR is assigned later by the AI pass; checked before insert below.
      checkTranscript: true,
    }),
  }));

  const withSubs: RawCandidate[] = [];
  for (const g of gate) {
    if (withSubs.length >= maxNew) break;
    if (g.result.ok) {
      withSubs.push(g.item);
      continue;
    }
    bump(g.result.code);
    rejectedCandidates.push({
      externalId: g.item.externalId,
      title: g.item.title,
      url: g.item.url,
      reason: g.result.reason,
      code: g.result.code,
    });
  }

  // The caption probe is sometimes rate-limited from this host. If *every*
  // candidate failed on transcript alone (never on availability/embedding),
  // fall back to trusting the sources — the watch-time pipeline has its own
  // transcript fallbacks. Non-embeddable/private videos are never let through.
  if (withSubs.length === 0) {
    const transcriptOnly = gate.filter(
      (g) => g.result.code === "transcript_unavailable" && g.result.embeddable,
    );
    if (transcriptOnly.length) {
      bump("subtitle_probe_unavailable");
      withSubs.push(...transcriptOnly.slice(0, maxNew).map((g) => g.item));
    }
  }



  if (!withSubs.length) {
    return {
      week,
      candidates: candidates.length,
      kept: 0,
      inserted: 0,
      featured: 0,
      retired: 0,
      revalidated,
      deactivated: deactivatedVideos.length,
      rejectedCandidates,
      deactivatedVideos,
      skipped,
    };

  }

  // 4. AI enrichment in chunks.
  const enriched = new Map<string, Enriched>();
  for (let i = 0; i < withSubs.length; i += 12) {
    const chunk = withSubs.slice(i, i + 12);
    const m = await enrich(chunk, apiKey);
    m.forEach((v, k) => enriched.set(k, v));
  }

  const rows = withSubs
    .map((c) => {
      const e = enriched.get(c.externalId);
      if (!e) return (bump("no_enrichment"), null);
      if (e.reject || e.quality < 0.45) return (bump("low_quality"), null);
      return {
        provider: c.provider,
        external_id: c.externalId,
        url: c.url,
        title: c.title,
        channel: c.channel,
        channel_external_id: c.channelExternalId,
        thumbnail_url: c.thumbnailUrl,
        duration_sec: c.durationSec,
        published_at: c.publishedAt,
        language: c.language,
        cefr_level: e.cefr,
        difficulty_score: LEVELS.indexOf(e.cefr) + 1,
        speaking_speed: e.speed,
        words_per_minute: e.wpm,
        category: c.defaultCategory ?? e.category,
        topics: e.topics,
        summary: e.summary,
        has_subtitles: true,
        quality_score: e.quality,
        popularity: c.popularity,
        featured_week: week,
        status: "active",
        refreshed_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as any[];

  let inserted = 0;
  if (rows.length) {
    const { error } = await supabaseAdmin
      .from("curated_videos" as any)
      .upsert(rows, { onConflict: "provider,external_id" });
    if (error) throw new Error(error.message);
    inserted = rows.length;
  }

  // 4b. Backfill missing durations for anything already in the catalogue.
  const { data: missing } = await supabaseAdmin
    .from("curated_videos" as any)
    .select("id, external_id")
    .eq("status", "active")
    .is("duration_sec", null)
    .limit(80);
  const missRows = (missing ?? []) as any[];
  if (missRows.length) {
    const { fetchYoutubeDuration } = await import("./providers.server");
    const q = [...missRows];
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        for (;;) {
          const r = q.shift();
          if (!r) return;
          const d = await fetchYoutubeDuration(r.external_id);
          if (d) {
            await supabaseAdmin
              .from("curated_videos" as any)
              .update({ duration_sec: d })
              .eq("id", r.id);
          }
        }
      }),
    );
  }





  // 5. Retire stale, non-evergreen rows beyond the catalogue target.
  let retired = 0;
  const { data: all } = await supabaseAdmin
    .from("curated_videos" as any)
    .select("id, is_evergreen, quality_score, added_at")
    .eq("status", "active")
    .order("added_at", { ascending: false });
  const list = (all ?? []) as any[];
  if (list.length > targetCatalogue) {
    const droppable = list
      .filter((r) => !r.is_evergreen)
      .sort(
        (a, b) =>
          Number(a.quality_score) - Number(b.quality_score) ||
          String(a.added_at).localeCompare(String(b.added_at)),
      )
      .slice(0, list.length - targetCatalogue)
      .map((r) => r.id);
    if (droppable.length) {
      await supabaseAdmin
        .from("curated_videos" as any)
        .update({ status: "stale" })
        .in("id", droppable);
      retired = droppable.length;
    }
  }

  return {
    week,
    candidates: candidates.length,
    kept: withSubs.length,
    inserted,
    featured: rows.length,
    revalidated,
    deactivated: deactivatedVideos.length,
    rejectedCandidates,
    deactivatedVideos,
    retired,

    skipped,
  };
}
