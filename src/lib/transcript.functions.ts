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
  offset: number; // seconds (startTime)
  duration: number;
  endTime: number; // seconds
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

    // Normalize each raw chunk's text and build a flat character timeline so
    // we can interpolate a precise timestamp for any character position.
    const chunks = raw.map((r) => ({
      text: r.text.replace(/\s+/g, " ").trim(),
      offset: r.offset / 1000, // seconds
      duration: r.duration / 1000, // seconds
    }));

    // Build joined text + per-char timestamp lookup.
    let joined = "";
    const charTime: number[] = []; // charTime[i] = approx time (s) for char i
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      if (i > 0) {
        joined += " ";
        charTime.push(chunks[i - 1].offset + chunks[i - 1].duration);
      }
      const len = c.text.length;
      for (let j = 0; j < len; j++) {
        // Linear interpolation across the chunk's duration.
        charTime.push(c.offset + (len > 0 ? (j / len) * c.duration : 0));
      }
      joined += c.text;
    }

    const decoded = joined
      .replace(/&amp;#39;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");

    const sentences: TranscriptSentence[] = [];
    const sentenceRegex = /[^.!?\n]+[.!?]+|[^.!?\n]+$/g;

    let id = 0;
    let match: RegExpExecArray | null;
    while ((match = sentenceRegex.exec(decoded)) !== null) {
      const text = match[0].trim();
      if (!text) continue;
      const startChar = match.index;
      const startTime = charTime[Math.min(startChar, charTime.length - 1)] ?? 0;
      sentences.push({
        id: id++,
        text,
        offset: startTime,
        duration: 0,
        endTime: 0, // filled below
      });
    }

    // Fill endTime from next sentence's start; final gets a 5s tail.
    for (let i = 0; i < sentences.length; i++) {
      const cur = sentences[i];
      const next = sentences[i + 1];
      cur.endTime = next ? next.offset : cur.offset + 5;
    }

    return { videoId, sentences };
  });
