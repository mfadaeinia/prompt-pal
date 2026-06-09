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

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt,
    });

    return { explanation: text.trim() };
  });
