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
Be concise (2-5 short lines total). Output plain text in this exact format, nothing else:

Meaning: <one short sentence explaining what is meant in ${data.targetLanguage}>
Translation: <natural translation into ${data.targetLanguage}>
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
            "Meaning: We're getting a lot of requests right now — please try again in a moment.\nTranslation: —\nNote: —",
          error: "rate_limited" as const,
        };
      }
      if (isCredits) {
        return {
          explanation:
            "Meaning: AI usage limit reached for now.\nTranslation: —\nNote: —",
          error: "credits_exhausted" as const,
        };
      }
      return {
        explanation:
          "Meaning: Couldn't load an explanation for this sentence. Try another one.\nTranslation: —\nNote: —",
        error: "unavailable" as const,
      };
    }
  });
