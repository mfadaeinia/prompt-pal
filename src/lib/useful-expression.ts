/** Adapter between the explanation payload and the ranking pipeline.
 *
 *  Stage 1 candidates come from the machine-readable `Candidates:` block of the
 *  explanation. When that block is missing (older cache entries, model drift)
 *  we reconstruct weak candidates from the legacy "Key Expressions" /
 *  "Vocabulary" lines and mark them `inferred`, which caps several signals so
 *  they cannot pass the quality gate on their own.
 *
 *  Nothing here decides what is highlighted — that is `expression-ranking.ts`.
 */

import {
  type CefrLevel,
  type ExpressionCandidate,
  type LearnerHistory,
  type ScoredCandidate,
  parseCandidatesBlock,
  rankCandidates,
} from "@/lib/expression-ranking";

export type UsefulExpression = {
  head: string;
  meaning: string;
  tag: string | null;
};

/** Legacy `<phrase> = <meaning> [Tag] · …` list. */
function parseLegacyItems(raw: string): ExpressionCandidate[] {
  if (!raw || raw === "—") return [];
  return raw
    .split(/\s*·\s*/)
    .map((item): ExpressionCandidate | null => {
      const tagMatch = item.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
      const tag = tagMatch ? tagMatch[2]!.trim() : null;
      const core = (tagMatch ? tagMatch[1]! : item).trim();
      const idx = core.indexOf("=");
      if (idx < 0) return null;
      const head = core.slice(0, idx).trim();
      const meaning = core.slice(idx + 1).trim();
      if (!head || !meaning) return null;
      const words = head.split(/\s+/).length;
      return {
        head,
        literal: "",
        meaning,
        type: words >= 2 ? "chunk" : "vocab",
        cefr: "B1",
        reuse: 1,
        opaque: 1,
        context: 1,
        tag,
        inferred: true,
      };
    })
    .filter((x): x is ExpressionCandidate => x !== null);
}

export type CandidateSource = {
  /** Raw explanation text, when available — preferred source. */
  raw?: string | null;
  keyExpressions?: string;
  vocabulary?: string;
};

/** Stage 1 output for one sentence, deduplicated by phrase. */
export function extractCandidates(src: CandidateSource): ExpressionCandidate[] {
  const fromBlock = parseCandidatesBlock(src.raw);
  const items = fromBlock.length
    ? fromBlock
    : [
        ...parseLegacyItems(src.keyExpressions ?? ""),
        ...parseLegacyItems(src.vocabulary ?? ""),
      ];
  const seen = new Set<string>();
  return items.filter((c) => {
    const k = c.head.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export type PickOptions = {
  level: CefrLevel;
  sentence?: string;
  history?: LearnerHistory;
};

/**
 * At most ONE recommendation per sentence, or `null` when nothing in the
 * sentence is genuinely worth the learner's attention. `null` is expected and
 * desirable — the UI stays quiet.
 */
export function pickUsefulExpression(
  src: CandidateSource,
  opts: PickOptions,
): ScoredCandidate | null {
  const ranked = rankCandidates(extractCandidates(src), {
    level: opts.level,
    sentence: opts.sentence,
    history: opts.history,
  });
  return ranked[0] ?? null;
}

/** All candidates that pass the quality gate, strongest first. */
export function rankUsefulExpressions(
  src: CandidateSource,
  opts: PickOptions,
): ScoredCandidate[] {
  return rankCandidates(extractCandidates(src), {
    level: opts.level,
    sentence: opts.sentence,
    history: opts.history,
  });
}
