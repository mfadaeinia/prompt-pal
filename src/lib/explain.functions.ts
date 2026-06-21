import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateObject } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  sentence: z.string().min(1).max(2000),
  context: z.string().max(4000).optional(),
  targetLanguage: z.string().min(1).max(40).default("English"),
});

// Structured contract returned to the client. Frontend renders sections
// dynamically and hides anything null / empty / low value.
const ExplanationSchema = z.object({
  natural_translation: z.string(),
  key_expression: z
    .object({
      expression: z.string(),
      meaning: z.string(),
      why_it_matters: z.string(),
    })
    .nullable(),
  whats_happening: z.string(),
  why_speakers_say_it_this_way: z.string(),
  vocabulary: z.array(
    z.object({
      term: z.string(),
      meaning: z.string(),
      importance: z.enum(["high", "medium", "low"]),
    }),
  ),
  grammar_insight: z.string().nullable(),
});

export type ExplanationJson = z.infer<typeof ExplanationSchema>;

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
  return `You are NativeFlow, a friendly language coach for an intermediate learner.
You are NOT a translator and NOT a dictionary. Teach HOW NATIVE SPEAKERS ACTUALLY USE the language — practical, real-world, plain ${targetLanguage}.

You MUST return ONE JSON object matching the provided schema. No prose, no markdown, no commentary.

FIELD GUIDANCE:
- natural_translation: Natural ${targetLanguage} translation a real speaker would say. Idiomatic, NOT word-for-word. Concise and readable.
- key_expression: The single most learning-worthy multi-word expression / collocation / separable verb / idiom / phrasal verb / news-style phrasing in the sentence. Set to null if there is no genuinely strong expression worth teaching. Do NOT invent one.
  - expression: the phrase in the original language
  - meaning: 2–3 natural ${targetLanguage} equivalents, comma-separated
  - why_it_matters: 1 short sentence in ${targetLanguage} on when / why native speakers reach for it
- whats_happening: 1 short sentence in ${targetLanguage} describing the intent / context. Do NOT start with "The speaker", "The sentence", "This sentence", "In this sentence". Do NOT repeat the translation. Describe what's going on like a friend would.
- why_speakers_say_it_this_way: 1–2 short sentences in plain ${targetLanguage} explaining the pattern / register / why this phrasing sounds natural. Avoid academic jargon (dative object, subjunctive mood, valency, etc.).
- vocabulary: 2–4 items max, ranked by usefulness, highest first. NEVER include filler words (the, and, is, of, more, very, a, to, in, on, with, that). Use "high" only for genuinely high-value learning items. Use [] if nothing qualifies.
- grammar_insight: Only if there is a genuinely useful, practical pattern (separable-verb split, V2 word order, modal stacking, perfect-tense auxiliary, etc.). One short, plain-${targetLanguage} sentence. Set null otherwise.

HARD RULES:
- Be a coach, not a parser. Teach a PATTERN, not the obvious meaning.
- NEVER restate the translation in whats_happening or why_speakers_say_it_this_way.
- NEVER list every word. vocabulary is curated.
- NEVER sound like a dictionary entry or a grammar textbook.
- Prefer null / [] over weak filler. Empty is better than generic.
${retry ? "\nIMPORTANT: Your previous output was weak (generic, meta, or restating the translation). Rewrite from scratch following the rules above strictly." : ""}`;
}

function validate(obj: ExplanationJson): string[] {
  const weak: string[] = [];
  if (!obj.natural_translation || !obj.natural_translation.trim()) {
    weak.push("missing-translation");
  }
  const whats = obj.whats_happening.toLowerCase().trim();
  const why = obj.why_speakers_say_it_this_way.toLowerCase().trim();
  for (const opener of BANNED_OPENERS) {
    if (whats.startsWith(opener) || why.startsWith(opener)) {
      weak.push(`banned-opener:${opener}`);
      break;
    }
  }
  if (whats && whats === obj.natural_translation.toLowerCase().trim()) {
    weak.push("whats-equals-translation");
  }
  return weak;
}

function emptyExplanation(): ExplanationJson {
  return {
    natural_translation: "",
    key_expression: null,
    whats_happening: "",
    why_speakers_say_it_this_way: "",
    vocabulary: [],
    grammar_insight: null,
  };
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
      const { object } = await generateObject({
        model,
        schema: ExplanationSchema,
        system: buildSystem(data.targetLanguage, retry),
        prompt,
      });
      return object;
    };

    try {
      let obj = await run(false);
      const issues = validate(obj);
      if (issues.length > 0) {
        console.warn("[explain] weak output, regenerating", { issues });
        try {
          const retried = await run(true);
          if (validate(retried).length <= issues.length) obj = retried;
        } catch {
          // keep first attempt if retry fails
        }
      }
      return { explanation: obj };
    } catch (error: unknown) {
      const status =
        (error as { statusCode?: number; status?: number })?.statusCode ??
        (error as { status?: number })?.status;
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimit = status === 429 || /too many requests|rate limit/i.test(message);
      const isCredits = status === 402 || /payment required|credit/i.test(message);
      console.error("[explain] generation failed", { status, message });

      if (isRateLimit) {
        return { explanation: emptyExplanation(), error: "rate_limited" as const };
      }
      if (isCredits) {
        return { explanation: emptyExplanation(), error: "credits_exhausted" as const };
      }
      return { explanation: emptyExplanation(), error: "unavailable" as const };
    }
  });
