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

    const payloadBytes = system.length + prompt.length;
    const promptFirst500 = prompt.slice(0, 500);
    const promptLast500 = prompt.slice(-500);
    const chunkSizes = [prompt.length]; // one chunk: sentence + small context window
    const deliveryMode: "single_sentence" | "single_sentence_with_context" =
      data.context && data.context.length > 0
        ? "single_sentence_with_context"
        : "single_sentence";

    console.log("[explain-debug] AI INPUT INSPECTOR", {
      delivery_mode: deliveryMode,
      sentence_length: data.sentence.length,
      sentence_word_count: data.sentence.trim().split(/\s+/).filter(Boolean).length,
      context_length: data.context?.length ?? 0,
      context_word_count: data.context
        ? data.context.trim().split(/\s+/).filter(Boolean).length
        : 0,
      prompt_length: prompt.length,
      system_length: system.length,
      payload_bytes_estimate: payloadBytes,
      chunking_applied: false,
      chunks_sent: chunkSizes.length,
      chunk_sizes: chunkSizes,
      prompt_first_500: promptFirst500,
      prompt_last_500: promptLast500,
      truncated: false,
      target_language: data.targetLanguage,
      model: "google/gemini-3-flash-preview",
    });

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt,
    });

    console.log("[explain-debug] AI response", {
      response_length: text.length,
      preview: text.slice(0, 120),
    });

    return {
      explanation: text.trim(),
      debug: {
        sentenceLength: data.sentence.length,
        contextLength: data.context?.length ?? 0,
        promptLength: prompt.length,
        systemLength: system.length,
        payloadBytes,
        chunkingApplied: false,
        chunksSent: chunkSizes.length,
        chunkSizes,
        promptFirst500,
        promptLast500,
        deliveryMode,
        truncated: false,
      },
    };
  });
