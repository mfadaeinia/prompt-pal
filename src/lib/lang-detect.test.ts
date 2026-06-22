import { describe, it, expect } from "vitest";
import { detectLanguage, sameBaseLanguage } from "./lang-detect.server";

// These tests pin the invariant that the language detector identifies the
// SPOKEN/SOURCE language of a transcript text. The pipeline must never
// substitute the learner's target/translation language for the detected
// source language — these tests guard that boundary at the detector level.

describe("detectLanguage — source language identification", () => {
  it("identifies English text as 'en'", () => {
    const text =
      "The quick brown fox jumps over the lazy dog. This is a normal English sentence " +
      "with common stopwords like the, and, is, of, to, that, with, from, this.";
    const r = detectLanguage(text);
    expect(r.language).toBe("en");
    expect(r.confidence).toBeGreaterThan(0.2);
  });

  it("identifies Dutch text as 'nl'", () => {
    const text =
      "Het is een hele mooie dag vandaag en we gaan naar de markt. " +
      "Ik heb niet veel tijd maar dat is geen probleem, want we hebben wel een plan.";
    const r = detectLanguage(text);
    expect(r.language).toBe("nl");
  });

  it("identifies German text as 'de'", () => {
    const text =
      "Der Mann hat das Buch auf den Tisch gelegt und ist dann nach Hause gegangen. " +
      "Es ist nicht einfach, aber wir werden es schaffen, auch wenn es lange dauert.";
    const r = detectLanguage(text);
    expect(r.language).toBe("de");
  });

  it("identifies French text as 'fr'", () => {
    const text =
      "Le chat est sur la table et il mange une pomme avec ses amis dans le jardin. " +
      "Nous avons décidé que ce serait une bonne idée pour tout le monde.";
    const r = detectLanguage(text);
    expect(r.language).toBe("fr");
  });

  it("returns null when the text is too short / ambiguous", () => {
    const r = detectLanguage("hi");
    expect(r.language).toBeNull();
  });
});

describe("sameBaseLanguage", () => {
  it("matches base codes regardless of region", () => {
    expect(sameBaseLanguage("en", "en-US")).toBe(true);
    expect(sameBaseLanguage("nl-NL", "nl")).toBe(true);
    expect(sameBaseLanguage("en_GB", "en-US")).toBe(true);
  });
  it("rejects different base languages", () => {
    expect(sameBaseLanguage("en", "nl")).toBe(false);
    expect(sameBaseLanguage("ar", "en")).toBe(false);
    expect(sameBaseLanguage("fa", "nl")).toBe(false);
  });
  it("handles missing inputs", () => {
    expect(sameBaseLanguage(null, "en")).toBe(false);
    expect(sameBaseLanguage("en", undefined)).toBe(false);
  });
});

// Pipeline contract tests: the detected SOURCE language is independent from
// the user's TARGET (translation) language. These cases mirror the bug
// reports we're fixing (EN→EN producing AR transcript / NL translation,
// EN→NL producing NL transcript). The transcript text in each case must
// detect as the SOURCE, regardless of the chosen target.
describe("source vs target language separation", () => {
  const ENGLISH_SAMPLE =
    "She said that the meeting would start at nine and that everyone should bring " +
    "their notes from the previous discussion with the new clients.";
  const DUTCH_SAMPLE =
    "Hij vertelde dat de vergadering om negen uur zou beginnen en dat iedereen " +
    "de aantekeningen van het vorige gesprek met de nieuwe klanten moest meenemen.";

  it.each([
    { sourceText: ENGLISH_SAMPLE, source: "en", target: "English" },
    { sourceText: ENGLISH_SAMPLE, source: "en", target: "Dutch" },
    { sourceText: ENGLISH_SAMPLE, source: "en", target: "Persian" },
    { sourceText: DUTCH_SAMPLE, source: "nl", target: "English" },
  ])(
    "transcript text detected as '$source' regardless of target '$target'",
    ({ sourceText, source }) => {
      const r = detectLanguage(sourceText);
      expect(r.language).toBe(source);
    },
  );
});
