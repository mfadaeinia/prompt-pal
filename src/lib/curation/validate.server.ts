/**
 * Pre-publish validation + weekly revalidation for curated library videos.
 *
 * A video may only reach learners when it is public, embeddable, has a usable
 * transcript and a valid CEFR level. Anything else is either never inserted or
 * (for existing rows) flipped to `inactive` with a human-readable reason.
 */

export const VALIDATION_CODES = [
  "ok",
  "private",
  "removed",
  "embedding_disabled",
  "transcript_unavailable",
  "transcript_low_quality",
  "missing_cefr",
  "check_failed",
] as const;

export type ValidationCode = (typeof VALIDATION_CODES)[number];

export const VALIDATION_LABELS: Record<ValidationCode, string> = {
  ok: "OK",
  private: "Private",
  removed: "Removed or unavailable",
  embedding_disabled: "Embedding disabled",
  transcript_unavailable: "Transcript unavailable",
  transcript_low_quality: "Transcript quality too low",
  missing_cefr: "No valid CEFR level",
  check_failed: "Validation check failed",
};

export type ValidationResult = {
  ok: boolean;
  code: ValidationCode;
  reason: string;
  embeddable: boolean;
  transcriptWords: number;
  transcriptSegments: number;
};

const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** Minimum transcript quality thresholds for a video to be learnable. */
export const MIN_TRANSCRIPT_SEGMENTS = 12;
export const MIN_TRANSCRIPT_WORDS = 120;
/** Captions must roughly cover the spoken part of the video. */
export const MIN_WORDS_PER_MINUTE = 40;

async function timedFetch(url: string, ms: number, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

type Availability = {
  status: "public" | "private" | "removed" | "unknown";
  embeddable: boolean | null;
};

/**
 * Public + embeddable probe based on oEmbed and the watch-page player config.
 * Both probes can be rate-limited from a server host; anything inconclusive is
 * reported as `unknown` / `null` so we never deactivate a healthy video by
 * accident. Only explicit negatives (private, removed, playableInEmbed:false)
 * cause a video to be pulled from the Library.
 */
export async function checkYoutubeAvailability(videoId: string): Promise<Availability> {
  let status: Availability["status"] = "unknown";
  try {
    const r = await timedFetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`,
      )}`,
      6000,
    );
    if (r.ok) status = "public";
    else if (r.status === 401 || r.status === 403) status = "private";
    else if (r.status === 404 || r.status === 400) status = "removed";
  } catch {
    /* fall through to watch page */
  }

  let embeddable: boolean | null = null;
  try {
    const r = await timedFetch(`https://www.youtube.com/watch?v=${videoId}`, 8000, {
      headers: { "user-agent": "Mozilla/5.0", "accept-language": "en" },
    });
    if (r.ok) {
      const html = await r.text();
      if (/"playableInEmbed":\s*false/.test(html)) embeddable = false;
      else if (/"playableInEmbed":\s*true/.test(html)) embeddable = true;
      if (/"status":"(LOGIN_REQUIRED|UNPLAYABLE)"/.test(html) && status === "unknown") {
        status = "private";
      }
      if (/"status":"ERROR"/.test(html) && status === "unknown") status = "removed";
      if (status === "unknown" && /"videoId":"/.test(html)) status = "public";
    }
  } catch {
    /* keep whatever we learned */
  }

  return { status, embeddable };
}

export type TranscriptProbe = {
  available: boolean;
  segments: number;
  words: number;
};

export async function probeTranscript(videoId: string): Promise<TranscriptProbe> {
  try {
    const { YoutubeTranscript } = await import("youtube-transcript");
    const r = await YoutubeTranscript.fetchTranscript(videoId);
    if (!Array.isArray(r) || r.length === 0) return { available: false, segments: 0, words: 0 };
    const words = r.reduce(
      (n, s: any) => n + String(s?.text ?? "").trim().split(/\s+/).filter(Boolean).length,
      0,
    );
    return { available: true, segments: r.length, words };
  } catch {
    return { available: false, segments: 0, words: 0 };
  }
}

function fail(code: ValidationCode, embeddable: boolean, probe?: TranscriptProbe): ValidationResult {
  return {
    ok: false,
    code,
    reason: VALIDATION_LABELS[code],
    embeddable,
    transcriptWords: probe?.words ?? 0,
    transcriptSegments: probe?.segments ?? 0,
  };
}

/**
 * Full gate. `cefrLevel` is optional for pure availability revalidation of rows
 * that already carry a level.
 */
export async function validateVideo(input: {
  videoId: string;
  durationSec?: number | null;
  cefrLevel?: string | null;
  /** Set false to skip the (slow) transcript probe during revalidation. */
  checkTranscript?: boolean;
  /** Treat an inconclusive transcript probe as a pass (probe is rate-limited). */
  lenientTranscript?: boolean;
}): Promise<ValidationResult> {
  const { videoId, durationSec, cefrLevel, checkTranscript = true } = input;

  const avail = await checkYoutubeAvailability(videoId);
  if (avail.status === "private") return fail("private", false);
  if (avail.status === "removed") return fail("removed", false);
  if (avail.embeddable === false) return fail("embedding_disabled", false);

  if (cefrLevel !== undefined && (!cefrLevel || !CEFR.includes(String(cefrLevel).toUpperCase()))) {
    return fail("missing_cefr", true);
  }

  let probe: TranscriptProbe = { available: true, segments: 0, words: 0 };
  if (checkTranscript) {
    probe = await probeTranscript(videoId);
    if (!probe.available) {
      if (!input.lenientTranscript) return fail("transcript_unavailable", true, probe);
    } else {
      const minutes = durationSec && durationSec > 0 ? durationSec / 60 : null;
      const wpm = minutes ? probe.words / minutes : null;
      const tooThin =
        probe.segments < MIN_TRANSCRIPT_SEGMENTS ||
        probe.words < MIN_TRANSCRIPT_WORDS ||
        (wpm !== null && wpm < MIN_WORDS_PER_MINUTE);
      if (tooThin) return fail("transcript_low_quality", true, probe);
    }
  }

  return {
    ok: true,
    code: "ok",
    reason: VALIDATION_LABELS.ok,
    embeddable: true,
    transcriptWords: probe.words,
    transcriptSegments: probe.segments,
  };
}

/** Bounded-concurrency helper used by the refresh job. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const idx = i++;
        if (idx >= items.length) return;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}
