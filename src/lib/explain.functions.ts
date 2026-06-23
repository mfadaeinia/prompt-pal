import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

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

Output PLAIN TEXT only, in this EXACT format. Every field on its own line, in this exact order. Use "—" to OMIT a field. PREFER "—" over filler.

Meaning: <ONE natural, idiomatic ${targetLanguage} sentence — how a real speaker would say this. Max 1–2 lines. Readability > literalness. Never word-for-word. No commentary. No quotes.>
Key Expressions: <0–2 of the MOST useful idioms / common expressions / phrasal constructions from the sentence. Format: "<phrase EXACTLY as in source> = <short ${targetLanguage} meaning> [<tag>]" separated by " · ". Tags (OPTIONAL, pick ONE per item): Idiom, Common, Very Common, Phrasal, News, Informal, Formal. Source on LEFT, ${targetLanguage} on RIGHT. If nothing qualifies, write "—". PREFER "—" over weak items.>
Vocabulary: <0–2 individual high-value vocabulary items (frequent or topic-essential words). Same format and tags as Key Expressions. NEVER function words (the, and, is, of, a, to, in, on, that). Skip if no standout vocabulary — write "—".>
Context: <OPTIONAL. ONE short sentence (≤120 chars) ONLY when a news / political / cultural / historical / sports reference is essential for comprehension. For everyday conversations, simple statements, or straightforward descriptions where the translation already says everything: write "—". Do NOT restate the meaning. Do NOT start with "The speaker", "The sentence", "This sentence", "In this sentence", "The narrator".>
Grammar Insight: <OPTIONAL. ONLY when there is a genuinely useful, practical pattern (separable-verb split, V2, modal stacking, passive construction, etc.). MAX 2–4 SHORT LINES of plain ${targetLanguage}. Focus on practical understanding, NOT linguistic theory. May briefly cite the phrase from the sentence. Otherwise "—". Default to "—".>

HARD RULES — failure means rejection:
- OPTIMIZE FOR SPEED. The explanation must NEVER feel longer than the original sentence.
- Meaning is the hero. Everything else is optional.
- Key Expressions = multi-word phrases/idioms. Vocabulary = single high-value words. Keep them SEPARATE.
- Max 2 items in each. Skip rather than pad. "—" is a valid and preferred answer.
- NEVER restate the meaning in other fields.
- NEVER use linguistic jargon ("dative", "subjunctive", "transitive", "auxiliary").
- NEVER use banned openers: "The speaker is discussing/explaining", "The sentence refers to/means", "In this sentence", "This sentence is about", "The narrator".
- NO bullet points, NO markdown, NO extra headings.
- Each label appears exactly once, in the exact order above.
${retry ? "\nIMPORTANT: Your previous output was too long or generic. Rewrite shorter. Meaning, then trim Key Expressions and Vocabulary to the strongest 1–2 each. Use \"—\" for Context and Grammar unless truly essential." : ""}`;
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

export const explainSentence = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured.");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const prompt = `Sentence: "${data.sentence}"${
      data.context ? `\n\nSurrounding context (for reference only, do not translate): ${data.context}` : ""
    }`;

    const run = async (retry: boolean) => {
      const { text } = await generateText({
        model,
        system: buildSystem(data.targetLanguage, retry),
        prompt,
      });
      return text.trim();
    };

    try {
      let text = await run(false);
      const issues = validate(text);
      if (issues.length > 0) {
        console.warn("[explain] weak output, regenerating", { issues });
        try {
          const retried = await run(true);
          if (validate(retried).length <= issues.length) text = retried;
        } catch {
          // keep first attempt if retry fails
        }
      }
      text = fixItemListOrder(text, "Key Expressions", data.sentence);
      text = fixItemListOrder(text, "Vocabulary", data.sentence);
      return { explanation: text };
    } catch (error: unknown) {
      const status =
        (error as { statusCode?: number; status?: number })?.statusCode ??
        (error as { status?: number })?.status;
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimit = status === 429 || /too many requests|rate limit/i.test(message);
      const isCredits = status === 402 || /payment required|credit/i.test(message);
      console.error("[explain] generation failed", { status, message });

      const fallback = `Meaning: —\nKey Expressions: —\nVocabulary: —\nContext: —\nGrammar Insight: —`;

      if (isRateLimit) {
        return { explanation: fallback, error: "rate_limited" as const };
      }
      if (isCredits) {
        return { explanation: fallback, error: "credits_exhausted" as const };
      }
      return { explanation: fallback, error: "unavailable" as const };
    }
  });
