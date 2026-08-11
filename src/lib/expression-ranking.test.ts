import { describe, expect, it } from "vitest";
import {
  RANKING_CONFIG,
  type ExpressionCandidate,
  createDensityTracker,
  dedupKey,
  parseCandidatesBlock,
  rankCandidates,
  scoreCandidate,
} from "./expression-ranking";

function cand(p: Partial<ExpressionCandidate>): ExpressionCandidate {
  return {
    head: "x",
    literal: "",
    meaning: "y",
    type: "vocab",
    cefr: "B1",
    reuse: 1,
    opaque: 1,
    context: 1,
    ...p,
  };
}

describe("quality gate", () => {
  it("rejects a far-below-level greeting for a B1 learner", () => {
    const c = cand({
      head: "goedemorgen",
      meaning: "good morning",
      type: "vocab",
      cefr: "A1",
      reuse: 2,
      opaque: 0,
      context: 0,
    });
    const s = scoreCandidate(c, { level: "B1" });
    expect(s.score).toBeLessThan(RANKING_CONFIG.minScore);
    expect(rankCandidates([c], { level: "B1" })).toHaveLength(0);
  });

  it("accepts a non-obvious idiom slightly above level", () => {
    const s = scoreCandidate(
      cand({
        head: "er geen gat in zien",
        literal: "see no hole in it",
        meaning: "to see no way out",
        type: "idiom",
        cefr: "B2",
        reuse: 2,
        opaque: 3,
        context: 2,
      }),
      { level: "B1" },
    );
    expect(s.score).toBeGreaterThanOrEqual(RANKING_CONFIG.minScore);
  });

  it("rejects a topic-locked compound noun even when contextually key", () => {
    const s = scoreCandidate(
      cand({
        head: "zonsverduistering",
        meaning: "solar eclipse",
        type: "vocab",
        cefr: "C1",
        reuse: 0,
        opaque: 0,
        context: 3,
      }),
      { level: "B2" },
    );
    expect(s.score).toBeLessThan(RANKING_CONFIG.minScore);
  });

  it("accepts a reusable chunk for both A2 and B2 learners", () => {
    const c = cand({
      head: "zin hebben in",
      literal: "have sense in",
      meaning: "to feel like (doing something)",
      type: "chunk",
      cefr: "B1",
      reuse: 3,
      opaque: 2,
      context: 2,
    });
    expect(scoreCandidate(c, { level: "A2" }).score).toBeGreaterThanOrEqual(
      RANKING_CONFIG.minScore,
    );
    expect(scoreCandidate(c, { level: "B2" }).score).toBeGreaterThanOrEqual(
      RANKING_CONFIG.minScore,
    );
  });

  it("rejects a transparent intensifier far below level", () => {
    const s = scoreCandidate(
      cand({
        head: "heel goed",
        literal: "very good",
        meaning: "very good",
        type: "collocation",
        cefr: "A2",
        reuse: 3,
        opaque: 0,
        context: 1,
      }),
      { level: "B2" },
    );
    expect(s.score).toBeLessThan(RANKING_CONFIG.minScore);
  });

  it("never returns a best-of-bad-options fallback", () => {
    const weak = [
      cand({ head: "hallo", cefr: "A1", opaque: 0, reuse: 3, context: 0 }),
      cand({ head: "ja", cefr: "A1", opaque: 0, reuse: 3, context: 0 }),
    ];
    expect(rankCandidates(weak, { level: "B1" })).toEqual([]);
  });

  it("legacy inferred candidates cannot pass the gate alone", () => {
    const s = scoreCandidate(
      cand({ head: "op tijd komen", type: "chunk", inferred: true, reuse: 3, opaque: 3, context: 3 }),
      { level: "B1" },
    );
    expect(s.trace.signals.B).toBeLessThanOrEqual(RANKING_CONFIG.inferredCap);
  });
});

describe("density + dedup", () => {
  const strong = () =>
    scoreCandidate(
      cand({
        head: "er rekening mee houden",
        meaning: "to take into account",
        type: "collocation",
        cefr: "B2",
        reuse: 3,
        opaque: 2,
        context: 2,
      }),
      { level: "B2" },
    );

  it("respects the per-minute budget", () => {
    const t = createDensityTracker(() => 60); // budget = 2
    expect(t.consider({ ...strong(), head: "aan de slag gaan" }, 0)).toBe(true);
    expect(t.consider({ ...strong(), head: "op tijd komen" }, 40)).toBe(true);
    expect(t.consider({ ...strong(), head: "uit het oog verliezen" }, 80)).toBe(false);
  });

  it("enforces minimum spacing", () => {
    const t = createDensityTracker(() => 600);
    expect(t.consider({ ...strong(), head: "aan de slag gaan" }, 10)).toBe(true);
    expect(t.consider({ ...strong(), head: "op tijd komen" }, 15)).toBe(false);
  });

  it("dedupes inflected variants", () => {
    const t = createDensityTracker(() => 600);
    expect(t.consider({ ...strong(), head: "zin hebben in" }, 0)).toBe(true);
    expect(t.consider({ ...strong(), head: "zin had in" }, 100)).toBe(false);
    expect(dedupKey("de zin hebben in")).toBe(dedupKey("zin hebben in"));
  });
});

describe("stage 1 parsing", () => {
  it("parses the candidates block", () => {
    const out = parseCandidatesBlock(
      `Meaning: whatever\nCandidates:\nzin hebben in | have sense in | to feel like | chunk | B1 | 3 | 2 | 2\n—`,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ head: "zin hebben in", type: "chunk", cefr: "B1", reuse: 3 });
  });

  it("returns nothing when the block is absent", () => {
    expect(parseCandidatesBlock("Meaning: hi")).toEqual([]);
  });
});
