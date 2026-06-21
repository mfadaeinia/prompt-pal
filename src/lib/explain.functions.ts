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
  return `You are NativeFlow, a friendly language coach for an intermediate learner.
You are NOT a translator and NOT a dictionary. Your job is to teach HOW NATIVE SPEAKERS ACTUALLY USE the language — practical, real-world, plain English.

Output PLAIN TEXT only, in this EXACT format. Every field on its own line, in this exact order. Use "—" to OMIT a field that would not add real value.

Natural Translation: <Translate the sentence into ${targetLanguage} the way a real native speaker would say it. Natural, idiomatic, NOT word-for-word. Never preserve awkward source-language word order.>
Key Expression: <The single most learning-worthy multi-word expression, collocation, separable verb, idiom, phrasal verb, or spoken/news-style phrasing from the sentence. Format: "<expression in original language> = <2–3 natural ${targetLanguage} equivalents separated by ', '>". If there is no genuinely strong expression worth teaching, write "—" (do NOT invent one).>
What's Happening: <1 short sentence in ${targetLanguage} explaining the intent / what's going on in plain language. Do NOT start with "The speaker", "The sentence", "This sentence" or any meta phrasing. Just describe what's going on, like a friend would.>
Why Speakers Say It This Way: <1–2 short sentences in plain ${targetLanguage} explaining the linguistic pattern — how native speakers express this idea, register (news / casual / formal), and why this phrasing sounds natural. Plain English, NOT academic. Avoid jargon like "dative object", "subjunctive mood", "valency" unless absolutely necessary, and if used, explain it in one tiny phrase.>
Vocabulary: <ONLY 2–4 words/phrases with real learning value, ranked by usefulness. Format: "word = ${targetLanguage} meaning" separated by " · ". NEVER include filler words (the, and, is, of, more, very, a, to, in, on, with, that). If fewer than 2 qualify, write "—".>
Grammar Insight: <Only if there is a genuinely useful, practical pattern (separable-verb split, V2 word order, modal stacking, perfect-tense auxiliary choice, etc.). One short, plain-English sentence. If the sentence has nothing special, write "—".>

HARD RULES — failure to follow means your output is rejected:
- Be a coach, not a parser. Teach a PATTERN, not the obvious meaning.
- NEVER restate the translation in "What's Happening" or "Why Speakers Say It This Way".
- NEVER list every word. Vocabulary is curated, not exhaustive.
- NEVER use these openers: "The speaker is discussing/explaining", "The sentence refers to/means", "In this sentence", "This sentence is about".
- NEVER sound like a dictionary entry or a grammar textbook.
- NO bullet points, NO markdown, NO headings beyond the six labels above.
- Each label appears exactly once, in the exact order above.
- Prefer "—" over weak filler. Empty is better than generic.
${retry ? "\nIMPORTANT: Your previous output was weak (generic, meta, or restating the translation). Rewrite from scratch following the rules above strictly." : ""}`;
}

function validate(text: string) {
  const get = (label: string) => {
    const m = text.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im"));
    return m ? m[1].trim() : "";
  };
  const translation = get("Natural Translation");
  const whats = get("What's Happening").toLowerCase();
  const why = get("Why Speakers Say It This Way").toLowerCase();

  const weak: string[] = [];
  if (!translation || translation === "—") weak.push("missing-translation");
  for (const opener of BANNED_OPENERS) {
    if (whats.startsWith(opener) || why.startsWith(opener)) {
      weak.push(`banned-opener:${opener}`);
      break;
    }
  }
  // "What's Happening" should not just repeat the translation.
  if (whats && translation && whats === translation.toLowerCase()) {
    weak.push("whats-equals-translation");
  }
  return weak;
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
      return { explanation: text };
    } catch (error: unknown) {
      const status =
        (error as { statusCode?: number; status?: number })?.statusCode ??
        (error as { status?: number })?.status;
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimit = status === 429 || /too many requests|rate limit/i.test(message);
      const isCredits = status === 402 || /payment required|credit/i.test(message);
      console.error("[explain] generation failed", { status, message });

      const fallback = `Natural Translation: —\nKey Expression: —\nWhat's Happening: —\nWhy Speakers Say It This Way: —\nVocabulary: —\nGrammar Insight: —`;

      if (isRateLimit) {
        return { explanation: fallback, error: "rate_limited" as const };
      }
      if (isCredits) {
        return { explanation: fallback, error: "credits_exhausted" as const };
      }
      return { explanation: fallback, error: "unavailable" as const };
    }
  });
