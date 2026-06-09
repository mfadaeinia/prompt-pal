import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { YoutubeTranscript } from "youtube-transcript";

const Input = z.object({ url: z.string().min(1).max(500) });

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export type TranscriptSentence = {
  id: number;
  text: string;
  offset: number; // seconds
  duration: number;
};

export const fetchTranscript = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const videoId = extractVideoId(data.url);
    if (!videoId) throw new Error("Could not parse a YouTube video ID from that URL.");

    let raw;
    try {
      raw = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (e) {
      throw new Error(
        "Couldn't fetch a transcript for this video. It may be unavailable or have captions disabled."
      );
    }

    // Group raw caption chunks into sentence-like units.
    const joinedText = raw.map((r) => r.text.replace(/\s+/g, " ")).join(" ");
    const decoded = joinedText
      .replace(/&amp;#39;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");

    const sentences: TranscriptSentence[] = [];
    const sentenceRegex = /[^.!?\n]+[.!?]+|[^.!?\n]+$/g;
    const matches = decoded.match(sentenceRegex) ?? [decoded];

    // Map each sentence back to an approximate offset by walking through raw chunks.
    let chunkIdx = 0;
    let consumed = 0;
    let id = 0;
    for (const sRaw of matches) {
      const s = sRaw.trim();
      if (!s) continue;
      const offset = raw[Math.min(chunkIdx, raw.length - 1)]?.offset ?? 0;
      const duration = raw[Math.min(chunkIdx, raw.length - 1)]?.duration ?? 0;
      sentences.push({ id: id++, text: s, offset: offset / 1000, duration: duration / 1000 });
      // advance chunkIdx roughly proportional to characters consumed
      consumed += s.length + 1;
      while (
        chunkIdx < raw.length - 1 &&
        consumed >
          raw.slice(0, chunkIdx + 1).reduce((acc, r) => acc + r.text.length + 1, 0)
      ) {
        chunkIdx++;
      }
    }

    return { videoId, sentences };
  });
