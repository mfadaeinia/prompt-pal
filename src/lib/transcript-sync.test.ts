import { describe, expect, it } from "vitest";
import {
  buildSentencesFromChunksExport,
  TRANSCRIPT_PIPELINE_VERSION,
  type RawChunk,
} from "./transcript.functions";

describe("transcript/video sync timing", () => {
  it("invalidates pre-v4 cached transcripts after the initial-silence timing fix", () => {
    expect(TRANSCRIPT_PIPELINE_VERSION).toBeGreaterThanOrEqual(4);
  });

  it("preserves initial music/silence before the first spoken word", () => {
    const chunks: RawChunk[] = [
      { text: "A", offset: 13.24, duration: 0.08 },
      { text: "few", offset: 13.34, duration: 0.16 },
      { text: "years", offset: 13.56, duration: 0.22 },
      { text: "ago,", offset: 13.82, duration: 0.18 },
      { text: "I", offset: 14.18, duration: 0.08 },
      { text: "broke", offset: 14.3, duration: 0.2 },
      { text: "into", offset: 14.55, duration: 0.18 },
      { text: "my", offset: 14.78, duration: 0.12 },
      { text: "own", offset: 14.94, duration: 0.16 },
      { text: "house.", offset: 15.15, duration: 0.32 },
    ];

    const sentences = buildSentencesFromChunksExport(chunks);
    expect(sentences[0].offset).toBeCloseTo(13.24, 2);
    expect(sentences[0].offset).toBeGreaterThan(10);
  });
});
describe("entity decoding does not shift timestamps", () => {
  it("keeps a sentence after an HTML entity aligned with its cue start", () => {
    const chunks: RawChunk[] = [
      { text: "Het&#39;s goed.", offset: 0, duration: 2 },
      { text: "Dat is heel mooi.", offset: 2, duration: 2 },
      { text: "Nu gaan we verder kijken.", offset: 4, duration: 3 },
    ];
    const sentences = buildSentencesFromChunksExport(chunks);
    // The second and third sentences must start at their own cue, not later.
    const second = sentences.find((s) => s.text.startsWith("Dat"));
    const third = sentences.find((s) => s.text.startsWith("Nu"));
    expect(second?.offset).toBeCloseTo(2, 1);
    expect(third?.offset).toBeCloseTo(4, 1);
  });
});
