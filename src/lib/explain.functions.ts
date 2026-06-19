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

    const system = `You help intermediate language learners understand sentences from native podcasts/videos.
Be concise. Output plain text in this EXACT format, nothing else (use "—" if a field doesn't apply):

Translation: <natural translation of the sentence into ${data.targetLanguage}>
Meaning: <one short sentence explaining what the speaker means in ${data.targetLanguage}>
Vocabulary: <2-4 key words/phrases from the sentence, formatted as "word = ${data.targetLanguage} meaning", separated by " · " (middle-dot). Use the original-language word on the left.>
Note: <one short note on a key phrase, idiom, slang, or grammar — or "—" if none>

Do not lecture. Be assistive, not teaching.`;

    const prompt = `Sentence: "${data.sentence}"${
      data.context ? `\n\nSurrounding context (for reference only): ${data.context}` : ""
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

      if (isRateLimit) {
        return {
          explanation:
            "Translation: —\nMeaning: We're getting a lot of requests right now — please try again in a moment.\nVocabulary: —\nNote: —",
          error: "rate_limited" as const,
        };
      }
      if (isCredits) {
        return {
          explanation:
            "Translation: —\nMeaning: AI usage limit reached for now.\nVocabulary: —\nNote: —",
          error: "credits_exhausted" as const,
        };
      }
      return {
        explanation:
          "Translation: —\nMeaning: Couldn't load an explanation for this sentence. Try another one.\nVocabulary: —\nNote: —",
        error: "unavailable" as const,
      };
    }
  });
