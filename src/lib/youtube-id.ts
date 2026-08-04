/**
 * Canonical YouTube video-id extraction.
 *
 * Single source of truth — previously reimplemented in transcript.functions.ts,
 * transcript-trace.functions.ts, transcript-stream.ts and index.tsx with
 * slightly different regexes. Pure and client-safe.
 */
const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function extractVideoId(input: string): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (VIDEO_ID_RE.test(raw)) return raw;

  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const segments = u.pathname.split("/").filter(Boolean);
  const valid = (s: string | null | undefined): string | null =>
    s && VIDEO_ID_RE.test(s) ? s : null;

  if (host === "youtu.be") return valid(segments[0] ?? null);

  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    if (segments[0] === "watch") {
      const v = valid(u.searchParams.get("v"));
      if (v) return v;
    }
    if (segments[0] && ["shorts", "embed", "live", "v"].includes(segments[0])) {
      return valid(segments[1] ?? null);
    }
    return valid(u.searchParams.get("v"));
  }

  return null;
}
