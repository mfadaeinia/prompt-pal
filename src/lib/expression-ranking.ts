/**
 * Stage 2–5 of the useful-expression pipeline: feature evaluation, ranking,
 * quality gate, density + deduplication.
 *
 * Everything here is PURE and deterministic. The LLM only produces candidate
 * *descriptors* (Stage 1, see `explain.functions.ts`); it never decides what is
 * highlighted. That decision lives in this file so it is inspectable, tunable
 * and unit-testable.
 */

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type CandidateType =
  | "idiom"
  | "collocation"
  | "phrasal"
  | "separable"
  | "chunk"
  | "fixed"
  | "vocab"
  | "grammar";

export type ExpressionCandidate = {
  /** The phrase exactly as spoken in the source sentence. */
  head: string;
  /** Word-for-word gloss, used to measure transparency. May be empty. */
  literal: string;
  /** Natural meaning in the learner's help language. */
  meaning: string;
  type: CandidateType;
  /** Level at which a learner typically MEETS this phrase. */
  cefr: CefrLevel;
  /** 0–3 self-reported signals from Stage 1. */
  reuse: number;
  opaque: number;
  context: number;
  /** Legacy tag, kept for display only. NEVER used for scoring. */
  tag?: string | null;
  /** True when reconstructed from the legacy Key Expressions / Vocabulary lines. */
  inferred?: boolean;
};

export type SignalKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

export type ScoreTrace = {
  signals: Record<SignalKey, number>;
  weighted: number;
  reasons: string[];
};

export type ScoredCandidate = ExpressionCandidate & {
  score: number;
  trace: ScoreTrace;
};

/** Reserved personalization inputs (Stage 8). Not used at weight 0. */
export type LearnerHistory = {
  seen?: Set<string>;
  clicked?: Set<string>;
  saved?: Set<string>;
  known?: Set<string>;
};

export type RankingContext = {
  level: CefrLevel;
  /** Sentence the candidate was found in — used for weak positional signals. */
  sentence?: string;
  history?: LearnerHistory;
};

export const RANKING_CONFIG = {
  weights: {
    A: 0.25, // communicative usefulness
    B: 0.2, // natural / native-like value
    C: 0.15, // idiomatic / non-obvious value
    D: 0.15, // reusability
    E: 0.15, // CEFR learner-level fit
    F: 0.1, // contextual importance
    G: 0, // reserved: novelty (personalization)
    H: 0, // reserved: mastery (personalization)
  } as Record<SignalKey, number>,
  /** Stage 4 quality gate. Nothing below this is ever highlighted. */
  minScore: 7.0,
  maxPerSentence: 1,
  /** Stage 5 density guardrail — a maximum, never a quota. */
  densityPerMinute: 1.5,
  /** Minimum spacing between two accepted highlights. */
  minGapSeconds: 20,
  /** A much stronger candidate may override the spacing rule. */
  overrideMargin: 1.0,
  /** Near-duplicate threshold (token Jaccard) for dedup. */
  dedupJaccard: 0.65,
  /** Cap on inferred (legacy-parsed) candidates so they cannot pass the gate. */
  inferredCap: 6,
};

const LEVEL_INDEX: Record<CefrLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

const TYPE_BASE_A: Record<CandidateType, number> = {
  chunk: 8,
  fixed: 8,
  collocation: 8,
  phrasal: 8,
  separable: 8,
  idiom: 7,
  grammar: 5,
  vocab: 4,
};

/** Pleasantries: frequent, but of near-zero teaching value on their own. */
const PLEASANTRIES = new Set([
  "goedemorgen",
  "goedemiddag",
  "goedenavond",
  "goededag",
  "hallo",
  "hoi",
  "dag",
  "doei",
  "tot ziens",
  "dank je",
  "dank u",
  "bedankt",
  "alsjeblieft",
  "alstublieft",
  "graag gedaan",
  "sorry",
  "pardon",
  "ja",
  "nee",
  "oke",
  "ok",
]);

/** Function-word skeletons typical of natural Dutch chunks. */
const CHUNK_SKELETON = new Set([
  "er",
  "wel",
  "even",
  "toch",
  "maar",
  "eens",
  "hoor",
  "nou",
  "al",
  "juist",
  "mee",
  "erop",
  "eraan",
  "ermee",
  "aan",
  "op",
  "in",
  "van",
  "voor",
  "over",
  "met",
  "bij",
  "om",
]);

const SLOT_MARKERS = new Set(["iets", "iemand", "ergens", "iemands", "wat"]);

/** Coarse topical/domain markers: useful for the current video only. */
const DOMAIN_HINTS = [
  "verduistering",
  "kabinet",
  "verkiezing",
  "rechtbank",
  "aandeel",
  "vaccin",
  "virus",
  "kampioenschap",
  "competitie",
  "begroting",
  "coalitie",
  "minister",
  "gemeente",
  "procent",
];

const ARTICLES = new Set(["de", "het", "een", "'t", "de'"]);

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return normalizeText(s).split(" ").filter(Boolean);
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}

/** Share of `phrase` tokens that also occur in `text`. */
export function overlapScore(phrase: string, text: string): number {
  const hay = normalizeText(text);
  const ts = tokens(phrase).filter((t) => t.length >= 2);
  if (ts.length === 0) return 0;
  let hits = 0;
  for (const t of ts) if (hay.includes(t)) hits++;
  return hits / ts.length;
}

const clamp = (n: number) => Math.max(0, Math.min(10, n));
const step = (v: number, table: number[]) =>
  table[Math.max(0, Math.min(table.length - 1, Math.round(v)))] ?? table[0]!;

function hasProperNounOrNumber(head: string): boolean {
  const raw = head.trim().split(/\s+/);
  if (/\d/.test(head)) return true;
  return raw.some((w, i) => i > 0 && /^[A-ZÀ-Ý]/.test(w));
}

function isTopicSpecific(head: string): boolean {
  const n = normalizeText(head);
  if (DOMAIN_HINTS.some((d) => n.includes(d))) return true;
  // Long single nouns in Dutch are usually topical compounds.
  const ts = tokens(head);
  return ts.length === 1 && ts[0]!.length >= 13;
}

// ---------------------------------------------------------------------------
// Stage 2 — signals. Each returns 0–10 plus the reasons that produced it.
// ---------------------------------------------------------------------------

type SignalResult = { value: number; reasons: string[] };

export function signalCommunicative(c: ExpressionCandidate): SignalResult {
  const reasons: string[] = [];
  let v = TYPE_BASE_A[c.type] ?? 4;
  reasons.push(`type ${c.type} base ${v}`);
  const n = normalizeText(c.head);
  if (PLEASANTRIES.has(n)) {
    v -= 2;
    reasons.push("pleasantry −2");
  }
  if (hasProperNounOrNumber(c.head)) {
    v -= 3;
    reasons.push("proper noun / number −3");
  } else if (!isTopicSpecific(c.head)) {
    v += 1;
    reasons.push("topic-independent +1");
  }
  return { value: clamp(v), reasons };
}

export function signalNatural(c: ExpressionCandidate): SignalResult {
  const reasons: string[] = [];
  const ts = tokens(c.head);
  let v = ts.length >= 2 && ts.length <= 5 ? 8 : ts.length === 1 ? 3 : 4;
  reasons.push(`${ts.length} token(s) → ${v}`);
  if (ts.some((t) => CHUNK_SKELETON.has(t))) {
    v += 2;
    reasons.push("chunk skeleton +2");
  }
  if (c.type === "separable" || c.type === "phrasal") {
    v += 1;
    reasons.push("separable/phrasal pattern +1");
  }
  return { value: clamp(v), reasons };
}

export function signalIdiomatic(c: ExpressionCandidate): SignalResult {
  const reasons: string[] = [];
  let v = step(c.opaque, [2, 5, 8, 10]);
  reasons.push(`opaque ${c.opaque} → ${v}`);
  if (c.literal && c.meaning) {
    const ov = jaccard(tokens(c.literal), tokens(c.meaning));
    if (ov >= 0.6) {
      v -= 2;
      reasons.push("literal ≈ meaning (transparent) −2");
    }
  }
  return { value: clamp(v), reasons };
}

export function signalReusability(c: ExpressionCandidate): SignalResult {
  const reasons: string[] = [];
  let v = step(c.reuse, [2, 5, 8, 10]);
  reasons.push(`reuse ${c.reuse} → ${v}`);
  if (isTopicSpecific(c.head)) {
    v -= 3;
    reasons.push("topic-locked −3");
  }
  if (tokens(c.head).some((t) => SLOT_MARKERS.has(t))) {
    v += 1;
    reasons.push("slot pattern +1");
  }
  return { value: clamp(v), reasons };
}

/** Δ = candidate level − learner level. Slightly-above-level wins. */
export function signalCefrFit(c: ExpressionCandidate, level: CefrLevel): SignalResult {
  const delta = LEVEL_INDEX[c.cefr] - LEVEL_INDEX[level];
  const curve: Record<number, number> = { [-2]: 2, [-1]: 5, 0: 8, 1: 10, 2: 7 };
  let v = delta <= -3 ? 0 : delta >= 3 ? 4 : (curve[delta] ?? 4);
  const reasons = [`Δ ${delta >= 0 ? "+" : ""}${delta} → ${v}`];
  const nonObvious =
    c.opaque >= 2 ||
    c.type === "idiom" ||
    c.type === "phrasal" ||
    c.type === "separable" ||
    c.type === "fixed";
  if (nonObvious && v < 5) {
    v = 5;
    reasons.push("non-obvious override → floor 5");
  }
  return { value: clamp(v), reasons };
}

export function signalContextual(c: ExpressionCandidate, sentence?: string): SignalResult {
  const reasons: string[] = [];
  let v = step(c.context, [2, 5, 8, 10]);
  reasons.push(`context ${c.context} → ${v}`);
  const ts = tokens(c.head);
  const carriesVerb =
    c.type === "phrasal" ||
    c.type === "separable" ||
    ts.some((t) => t.length > 3 && (t.endsWith("en") || t.endsWith("t")));
  if (carriesVerb && (!sentence || overlapScore(c.head, sentence) >= 0.5)) {
    v += 1;
    reasons.push("carries the clause verb +1");
  }
  return { value: clamp(v), reasons };
}

// ---------------------------------------------------------------------------
// Stage 3 — ranking
// ---------------------------------------------------------------------------

export function scoreCandidate(
  c: ExpressionCandidate,
  ctx: RankingContext,
  config = RANKING_CONFIG,
): ScoredCandidate {
  const parts: Array<[SignalKey, SignalResult]> = [
    ["A", signalCommunicative(c)],
    ["B", signalNatural(c)],
    ["C", signalIdiomatic(c)],
    ["D", signalReusability(c)],
    ["E", signalCefrFit(c, ctx.level)],
    ["F", signalContextual(c, ctx.sentence)],
    // Reserved personalization signals — weight 0 today.
    ["G", { value: 0, reasons: [] }],
    ["H", { value: 0, reasons: [] }],
  ];

  const signals = {} as Record<SignalKey, number>;
  const reasons: string[] = [];
  for (const [key, res] of parts) {
    let value = res.value;
    if (c.inferred && (key === "B" || key === "C" || key === "D")) {
      value = Math.min(value, config.inferredCap);
      res.reasons.push(`inferred candidate cap ${config.inferredCap}`);
    }
    signals[key] = value;
    for (const r of res.reasons) reasons.push(`${key}: ${r}`);
  }

  let weighted = 0;
  for (const key of Object.keys(config.weights) as SignalKey[]) {
    weighted += (config.weights[key] ?? 0) * (signals[key] ?? 0);
  }
  weighted = Math.round(weighted * 100) / 100;

  return { ...c, score: weighted, trace: { signals, weighted, reasons } };
}

/**
 * Stage 3 + Stage 4: score, sort, and drop everything below the quality gate.
 * Returning an EMPTY array is a normal, desirable outcome.
 */
export function rankCandidates(
  candidates: ExpressionCandidate[],
  ctx: RankingContext,
  config = RANKING_CONFIG,
): ScoredCandidate[] {
  return candidates
    .map((c) => scoreCandidate(c, ctx, config))
    .filter((c) => c.score >= config.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, config.maxPerSentence));
}

// ---------------------------------------------------------------------------
// Stage 5 — density + deduplication
// ---------------------------------------------------------------------------

/** Light Dutch lemma pass so inflected variants teach only once. */
export function dedupKey(head: string): string {
  const ts = tokens(head).filter((t) => !ARTICLES.has(t));
  return ts
    .map((t) => t.replace(/(je|tje|en|de|te|t|s)$/u, (m) => (t.length - m.length >= 3 ? "" : m)))
    .join(" ");
}

export type DensityTracker = {
  /** True when the candidate may be highlighted. Mutates internal state. */
  consider: (candidate: ScoredCandidate, startSeconds: number) => boolean;
  seen: () => string[];
};

/**
 * `getDurationSeconds` is a getter because the player often reports duration
 * later than the first candidates arrive.
 */
export function createDensityTracker(
  getDurationSeconds: () => number,
  config = RANKING_CONFIG,
): DensityTracker {
  const shown = new Map<string, string>(); // dedupKey -> head
  let accepted = 0;
  let lastAcceptedAt = Number.NEGATIVE_INFINITY;
  let lastAcceptedScore = 0;

  return {
    consider(candidate, startSeconds) {
      const key = dedupKey(candidate.head) || normalizeText(candidate.head);
      if (shown.has(key)) return false;
      // Near-duplicate check on STEMMED tokens, using an overlap coefficient
      // so inflected variants ("zin hebben in" / "zin had in") collapse.
      const ts = key.split(" ").filter(Boolean);
      for (const prev of shown.keys()) {
        const prevTs = prev.split(" ").filter(Boolean);
        const inter = ts.filter((t) => prevTs.includes(t)).length;
        const denom = Math.min(ts.length, prevTs.length) || 1;
        if (inter / denom >= config.dedupJaccard) return false;
      }


      const duration = Math.max(0, getDurationSeconds());
      const budget =
        duration > 0
          ? Math.ceil((duration / 60) * config.densityPerMinute)
          : Number.POSITIVE_INFINITY;
      if (accepted >= budget) return false;

      const gap = startSeconds - lastAcceptedAt;
      if (
        gap < config.minGapSeconds &&
        candidate.score < lastAcceptedScore + config.overrideMargin
      ) {
        return false;
      }

      shown.set(key, candidate.head);
      accepted += 1;
      lastAcceptedAt = startSeconds;
      lastAcceptedScore = candidate.score;
      return true;
    },
    seen: () => [...shown.values()],
  };
}

// ---------------------------------------------------------------------------
// Stage 1 output parsing (pure, so it lives here next to the consumer)
// ---------------------------------------------------------------------------

const TYPES = new Set<string>([
  "idiom",
  "collocation",
  "phrasal",
  "separable",
  "chunk",
  "fixed",
  "vocab",
  "grammar",
]);

function toLevel(v: string): CefrLevel {
  const up = v.trim().toUpperCase();
  return (up in LEVEL_INDEX ? up : "B1") as CefrLevel;
}

function toScale(v: string): number {
  const n = Number.parseInt(v.trim(), 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 1;
}

/**
 * Parse the machine-readable `Candidates:` block:
 * `phrase | literal | meaning | type | cefr | reuse | opaque | context`
 */
export function parseCandidatesBlock(text: string | null | undefined): ExpressionCandidate[] {
  if (!text) return [];
  const idx = text.search(/^\s*Candidates\s*:/im);
  if (idx < 0) return [];
  const body = text.slice(idx).replace(/^\s*Candidates\s*:/i, "");
  const out: ExpressionCandidate[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^[-•*]\s*/, "");
    if (!line || line === "—") continue;
    const f = line.split("|").map((x) => x.trim());
    if (f.length < 8 || !f[0]) continue;
    const type = (f[3] ?? "").toLowerCase();
    out.push({
      head: f[0]!,
      literal: f[1] === "—" ? "" : (f[1] ?? ""),
      meaning: f[2] === "—" ? "" : (f[2] ?? ""),
      type: (TYPES.has(type) ? type : "vocab") as CandidateType,
      cefr: toLevel(f[4] ?? ""),
      reuse: toScale(f[5] ?? ""),
      opaque: toScale(f[6] ?? ""),
      context: toScale(f[7] ?? ""),
    });
  }
  return out;
}
