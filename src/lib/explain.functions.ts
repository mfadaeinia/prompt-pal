import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  sentence: z.string().min(1).max(2000),
  context: z.string().max(4000).optional(),
  targetLanguage: z.string().min(1).max(40).default("English"),
});

export const explainSentence = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured.");

    const gateway = createLovableAiGatewayProvider(key);

    const system = `You are a language coach — NOT a translator and NOT a dictionary.
Your job is to help an intermediate learner understand WHY native speakers say a sentence the way they do.

Output PLAIN TEXT in this EXACT format. Every field on its own line, in this order. Use "—" to skip a field.

Translation: <NATURAL ${data.targetLanguage} translation — how a real speaker would say this idea, NOT word-for-word. Avoid literal calques.>
Key Expression: <The single most learning-worthy idiom, collocation, phrasal verb, separable verb, fixed expression, or spoken pattern from the sentence, in the ORIGINAL language, followed by " = " and 1–3 natural ${data.targetLanguage} equivalents separated by ", ". If literally nothing notable, write "—".>
Why This Way: <1–2 sentences in ${data.targetLanguage}: where/when native speakers use this expression or construction, what register (news, conversational, formal), and why it sounds natural here. Skip with "—" only if there is no Key Expression.>
Vocabulary: <ONLY 0–3 genuinely difficult or high-value words from the sentence, formatted "word = ${data.targetLanguage} meaning" separated by " · ". Skip common words (and, the, is, more, very, etc.). If nothing qualifies, write "—".>
Usage Notes: <One short practical tip — register, tone, common pitfall, or a tiny variant — or "—".>
Grammar Insight: <Only when genuinely educational (separable verb split, word order, modal stacking, subjunctive, etc.) — one short sentence. Otherwise "—".>

Rules:
- Be a coach, not a parser. Teach a PATTERN, not the obvious meaning.
- Never restate the sentence. Never list every word.
- No bullet points, no markdown, no headings beyond the labels above.
- Each label appears exactly once, in the exact order above.`;

    const prompt = `Sentence: "${data.sentence}"${
      data.context ? `\n\nSurrounding context (for reference only, do not translate): ${data.context}` : ""
    }`;

    try {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system,
        prompt,
      });
      return { explanation: text.trim() };
    } catch (error: unknown) {
      const status =
        (error as { statusCode?: number; status?: number })?.statusCode ??
        (error as { status?: number })?.status;
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimit = status === 429 || /too many requests|rate limit/i.test(message);
      const isCredits = status === 402 || /payment required|credit/i.test(message);
      console.error("[explain] generation failed", { status, message });

      const fallback = (msg: string) =>
        `Translation: —\nWhats Happening: ${msg}\nKey Expression: —\nWhy This Way: —\nVocabulary: —\nUsage Notes: —\nGrammar Insight: —`;

      if (isRateLimit) {
        return {
          explanation: fallback("We're getting a lot of requests right now — please try again in a moment."),
          error: "rate_limited" as const,
        };
      }
      if (isCredits) {
        return {
          explanation: fallback("AI usage limit reached for now."),
          error: "credits_exhausted" as const,
        };
      }
      return {
        explanation: fallback("Couldn't load an explanation for this sentence. Try another one."),
        error: "unavailable" as const,
      };
    }
  });
