import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { streamText } from "ai";
import { createLovableResponsesProvider } from "./ai-gateway.server";

const Input = z.object({
  sentence: z.string().min(1).max(2000),
  context: z.string().max(4000).optional(),
  targetLanguage: z.string().min(1).max(40).default("English"),
});

const BANNED_OPENERS = [
  "the speaker is discussing",
  "the speaker is explaining",
  "the speaker says",
  "the sentence refers to",
  "the sentence means",
  "this sentence means",
  "in this sentence",
  "this sentence is about",
];

function buildSystem(targetLanguage: string, retry: boolean) {
  return `You are NativeFlow, an instant comprehension companion for a language learner watching a video.
Goal: the learner reads your output in UNDER 5 SECONDS and returns to the video. You are NOT a teacher, NOT a translator, NOT a dictionary. No lessons, no essays.

CORE PRINCIPLE: A short explanation is better than a forced one. Feel COMFORTABLE writing "—" when there is nothing else worth explaining. Do NOT optimize for completeness — optimize for clarity and speed. MOST sentences should have ONLY Meaning + Key Expressions. Context and Grammar are EXCEPTIONS, not defaults.

Output PLAIN TEXT only, in this EXACT format. Every field on its own line, in this exact order. Use "—" to OMIT a field. PREFER "—" over filler.

Meaning: <ONE natural, idiomatic ${targetLanguage} sentence — how a real speaker would say this. Max 1–2 lines. Readability > literalness. Never word-for-word. No commentary. No quotes. ALWAYS REQUIRED.>
Key Expressions: <0–3 of the MOST useful idioms / common expressions / phrasal constructions. Format: "<phrase EXACTLY as in source> = <short ${targetLanguage} meaning> [<tag>]" separated by " · ". Tags (OPTIONAL, ONE per item): Idiom, Common, Very Common, Phrasal, News, Informal, Formal. Source on LEFT, ${targetLanguage} on RIGHT. If nothing qualifies, write "—". Do NOT pad.>
Vocabulary: <0–2 individual high-value vocabulary items NOT already in Key Expressions. Same format. NEVER function words (the, and, is, of, a, to, in, on, that). Default "—".>
Context: <OPTIONAL — DEFAULT "—". ONE short sentence (≤120 chars) ONLY when a news / political / cultural / historical / sports / regional reference provides background the learner would otherwise MISS. Hide ("—") for everyday conversation, simple statements, generic comments, or anything obvious from the translation. Do NOT restate the meaning. Do NOT start with "The speaker", "The sentence", "This sentence", "In this sentence", "The narrator".>
Grammar Insight: <OPTIONAL — DEFAULT "—". ONLY render when there is a GENUINE GRAMMAR PATTERN: separable verbs, V2 / word-order inversion, subordinate-clause order, passive voice, modal stacking, reflexive constructions, tense patterns that differ from ${targetLanguage}. MAX 2 SHORT LINES. NEVER explain what a WORD or PHRASE means here — that belongs in Key Expressions/Vocabulary. If what you would write is really a vocabulary/expression note (e.g. "'wel eens' means 'at some point'"), write "—" and put the phrase in Key Expressions instead.>

Candidates:
<STAGE-1 OUTPUT FOR A RANKING ENGINE — NOT shown to the learner. 0–4 lines, one candidate per line, LAST block of your output. You are proposing CANDIDATES to be evaluated; you do NOT decide what is taught, so slightly over-propose and describe each item honestly. Prefer meaningful language chunks: idioms, collocations, phrasal/separable verbs, conversational chunks, fixed/semi-fixed expressions, native-like phrasing, constructions whose meaning is not obvious word-for-word. Do NOT propose isolated basic vocabulary just because it is frequent. If nothing qualifies, write a single line: —
Fields, pipe-separated, in this EXACT order:
phrase | literal | meaning | type | cefr | reuse | opaque | context
- phrase: EXACTLY as it appears in the source sentence.
- literal: word-for-word gloss in ${targetLanguage} (use — if identical to meaning).
- meaning: short natural ${targetLanguage} meaning.
- type: one of idiom, collocation, phrasal, separable, chunk, fixed, vocab, grammar.
- cefr: A1|A2|B1|B2|C1|C2 — the level at which a learner typically MEETS this phrase (a greeting like "goedemorgen" is A1).
- reuse: 0–3 — in how many UNRELATED everyday situations could a learner reuse it (0 = only this topic, 3 = almost anywhere).
- opaque: 0–3 — how much the meaning CANNOT be derived from the individual words (0 = fully transparent, 3 = you must know it).
- context: 0–3 — how much understanding THIS sentence depends on it (0 = not at all, 3 = the sentence collapses without it).>

HARD RULES — failure means rejection:
- OPTIMIZE FOR SPEED. The explanation must NEVER feel longer than the original sentence.
- Meaning is the hero. Most outputs are Meaning + Key Expressions ONLY.
- Grammar Insight is NEVER a place for vocabulary/expression definitions. Word/phrase meanings = Key Expressions.
- Key Expressions = multi-word phrases/idioms. Vocabulary = single high-value words. Keep them SEPARATE.
- Skip rather than pad. "—" is preferred for Context, Grammar, Vocabulary, and Key Expressions when nothing strong qualifies.
- NEVER restate the meaning in other fields.
- NEVER use linguistic jargon ("dative", "subjunctive", "transitive", "auxiliary").
- NEVER use banned openers: "The speaker is discussing/explaining", "The sentence refers to/means", "In this sentence", "This sentence is about", "The narrator".
- NO bullet points, NO markdown, NO extra headings.
- Each label appears exactly once, in the exact order above, with Candidates LAST.
- Candidates ratings are honest observations, not sales pitches. Never inflate reuse/opaque/context.
${retry ? "\nIMPORTANT: Your previous output was padded or put a vocabulary/expression note in Grammar. Rewrite: keep Meaning, trim Key Expressions to the strongest 1–2, use \"—\" for Context AND Grammar unless truly essential. If Grammar was a word's meaning, move it to Key Expressions and put \"—\" in Grammar." : ""}`;
}

function validate(text: string) {
  const get = (label: string) => {
    const m = text.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im"));
    return m ? m[1].trim() : "";
  };
  const translation = get("Meaning") || get("Natural Translation");
  const ctx = get("Context").toLowerCase();

  const weak: string[] = [];
  if (!translation || translation === "—") weak.push("missing-translation");
  for (const opener of BANNED_OPENERS) {
    if (ctx.startsWith(opener)) {
      weak.push(`banned-opener:${opener}`);
      break;
    }
  }
  if (ctx && translation && ctx === translation.toLowerCase()) {
    weak.push("context-equals-translation");
  }
  return weak;
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function overlapScore(phrase: string, sentence: string) {
  const sN = normalize(sentence);
  const tokens = normalize(phrase).split(" ").filter((t) => t.length >= 2);
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const t of tokens) if (sN.includes(t)) hits++;
  return hits / tokens.length;
}

// Flip "<target> = <source>" back to "<source> = <target>" when the model swapped sides.
function fixItemListOrder(text: string, label: string, sentence: string): string {
  return text.replace(new RegExp(`^(\\s*${label}\\s*:\\s*)(.+)$`, "im"), (_m, prefix, val) => {
    const v = String(val).trim();
    if (!v || v === "—") return `${prefix}${v}`;
    const items = v.split(/\s*·\s*/).map((item: string) => {
      const tagMatch = item.match(/^(.*?)(\s*\[[^\]]+\])\s*$/);
      const tag = tagMatch ? tagMatch[2] : "";
      const core = (tagMatch ? tagMatch[1] : item).trim();
      const idx = core.indexOf("=");
      if (idx < 0) return item;
      const left = core.slice(0, idx).trim();
      const right = core.slice(idx + 1).trim();
      if (!left || !right) return item;
      const leftScore = overlapScore(left, sentence);
      const rightScore = overlapScore(right, sentence);
      if (rightScore > leftScore + 0.25) return `${right} = ${left}${tag}`;
      return `${left} = ${right}${tag}`;
    });
    return `${prefix}${items.join(" · ")}`;
  });
}

// Tiny in-memory LRU cache for repeat sentence clicks within a server
// instance. Keyed by sentence+targetLanguage+model so the same sentence in
// different help-languages stays distinct. Bounded to avoid leaks.
const MODEL_VERSION = "openai/gpt-5.6-sol@v2-candidates";
const EXPLAIN_CACHE = new Map<string, string>();
const EXPLAIN_CACHE_MAX = 500;
function cacheKey(sentence: string, targetLanguage: string) {
  return `${MODEL_VERSION}::${targetLanguage}::${sentence}`;
}
function cacheGet(k: string): string | undefined {
  const v = EXPLAIN_CACHE.get(k);
  if (v !== undefined) {
    // Touch for LRU.
    EXPLAIN_CACHE.delete(k);
    EXPLAIN_CACHE.set(k, v);
  }
  return v;
}
function cacheSet(k: string, v: string) {
  if (EXPLAIN_CACHE.size >= EXPLAIN_CACHE_MAX) {
    const first = EXPLAIN_CACHE.keys().next().value;
    if (first !== undefined) EXPLAIN_CACHE.delete(first);
  }
  EXPLAIN_CACHE.set(k, v);
}

export const explainSentence = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured.");

    const ck = cacheKey(data.sentence, data.targetLanguage);
    const cached = cacheGet(ck);
    if (cached) {
      console.log("[perf][server] explain_cache_hit");
      return { explanation: cached, cached: true as const };
    }

    const gateway = createLovableResponsesProvider(key);
    const model = gateway.responses("openai/gpt-5.6-sol");

    const prompt = `Sentence: "${data.sentence}"${
      data.context ? `\n\nSurrounding context (for reference only, do not translate): ${data.context}` : ""
    }`;

    const run = async (retry: boolean) => {
      // Streaming (consumed server-side): a buffered call on a reasoning model
      // can outlive the platform request timeout.
      const result = streamText({
        model,
        system: buildSystem(data.targetLanguage, retry),
        prompt,
        providerOptions: { openai: { store: false } },
      });
      const text = await result.text;
      return text.trim();
    };

    try {
      const tGen = Date.now();
      // Single attempt — return immediately. Weak outputs degrade gracefully
      // instead of doubling latency with a synchronous retry round-trip.
      let text = await run(false);
      console.log("[perf][server] explain_generated", { ms: Date.now() - tGen });
      const issues = validate(text);
      if (issues.length > 0) {
        console.warn("[explain] weak output (no retry, returning anyway)", { issues });
      }
      text = fixItemListOrder(text, "Key Expressions", data.sentence);
      text = fixItemListOrder(text, "Vocabulary", data.sentence);
      cacheSet(ck, text);
      return { explanation: text };
    } catch (error: unknown) {
      const status =
        (error as { statusCode?: number; status?: number })?.statusCode ??
        (error as { status?: number })?.status;
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimit = status === 429 || /too many requests|rate limit/i.test(message);
      const isCredits = status === 402 || /payment required|credit/i.test(message);
      console.error("[explain] generation failed", { status, message });

      const fallback = `Meaning: —\nKey Expressions: —\nVocabulary: —\nContext: —\nGrammar Insight: —\nCandidates:\n—`;

      if (isRateLimit) {
        return { explanation: fallback, error: "rate_limited" as const };
      }
      if (isCredits) {
        return { explanation: fallback, error: "credits_exhausted" as const };
      }
      return { explanation: fallback, error: "unavailable" as const };
    }
  });
