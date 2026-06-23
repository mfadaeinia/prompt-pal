import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  word: z.string().min(1).max(200),
  targetLanguage: z.string().min(1).max(40).default("English"),
  sourceLanguage: z.string().min(1).max(40).default("Dutch"),
});

export type WordExamplesResult = {
  contexts: Array<{
    label: string;
    sentences: Array<{ source: string; translation: string }>;
  }>;
};

function safeJson(text: string): any | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export const generateWordExamples = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<WordExamplesResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const system = `You generate practice examples for a language learner.
Given a ${data.sourceLanguage} word or short expression, produce TWO distinct everyday contexts (e.g., "At work", "Casual conversation with friends", "News headline", "Travel", "Family"). For EACH context, write 3 short natural ${data.sourceLanguage} sentences that use the word naturally, plus a concise ${data.targetLanguage} translation.

Rules:
- Sentences must be natural, conversational, and clearly different in tone/situation between the two contexts.
- Keep each sentence under 18 words.
- The two context labels MUST be clearly different situations.
- Output STRICT JSON only — no commentary, no markdown fences.

JSON shape:
{
  "contexts": [
    { "label": "<short context name>", "sentences": [
      { "source": "<${data.sourceLanguage} sentence>", "translation": "<${data.targetLanguage} translation>" },
      { "source": "...", "translation": "..." },
      { "source": "...", "translation": "..." }
    ]},
    { "label": "<different context>", "sentences": [ ... 3 items ... ] }
  ]
}`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt: `Word/expression: ${data.word}`,
      temperature: 0.7,
    });

    const parsed = safeJson(text);
    if (!parsed || !Array.isArray(parsed.contexts)) {
      throw new Error("Could not parse examples");
    }
    const contexts = parsed.contexts.slice(0, 2).map((c: any) => ({
      label: String(c.label ?? "Context"),
      sentences: (Array.isArray(c.sentences) ? c.sentences : [])
        .slice(0, 3)
        .map((s: any) => ({
          source: String(s.source ?? ""),
          translation: String(s.translation ?? ""),
        }))
        .filter((s: any) => s.source),
    }));
    return { contexts };
  });
