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
You are NOT a translator and NOT a dictionary. Your job is to teach HOW NATIVE SPEAKERS ACTUALLY USE the language — practical, real-world, plain ${targetLanguage}.

The MOST IMPORTANT field is "Key Expression". Everything else supports it. If the sentence has no strong expression worth teaching, write "—" for Key Expression and keep the other fields tight.

Output PLAIN TEXT only, in this EXACT format. Every field on its own line, in this exact order. Use "—" to OMIT a field that would not add real value.

Key Expression: <The single most learning-worthy multi-word expression, collocation, separable verb, idiom, phrasal verb, or spoken/news-style phrasing from the sentence. Format: "<expression in original language> = <2–3 natural ${targetLanguage} equivalents separated by ', '>". If there is no genuinely strong expression worth teaching, write "—" (do NOT invent one).>
Natural Translation: <Translate the sentence into ${targetLanguage} the way a real native speaker would say it. Natural, idiomatic, NOT word-for-word. Never preserve awkward source-language word order.>
Why Speakers Say It This Way: <1–2 short coaching sentences explaining native-speaker intuition — why this phrasing sounds natural here, the register (news / casual / formal), and what feeling or nuance it carries. Talk like a friend who lived in the country for 10 years. BAD: "This construction uses a dative object". GOOD: "Dutch often expresses success as something that happens to someone rather than something they actively do." Avoid linguistic jargon entirely (no "dative", "subjunctive", "valency", "transitive"). If there's no real intuition to teach, write "—".>
What's Happening: <ONE short sentence of CONTEXT only — what is going on in this moment of the conversation. Not a language explanation. Not a restatement of the translation. Do NOT start with "The speaker", "The sentence", "This sentence", "In this sentence", "The narrator". Just describe the moment, like a friend whispering context.>
Vocabulary: <Up to 4 curated items, each prefixed with a TIER tag. Tiers: [high] = high-value word/phrase a learner should actually remember; [useful] = solid intermediate word worth knowing; [basic] = common word included only if the meaning is non-obvious. Format: "[tier] word = ${targetLanguage} meaning" separated by " · ". Example: "[high] lukken = to manage to, to succeed · [useful] handhaven = to enforce · [basic] gemeente = municipality". NEVER include filler words (the, and, is, of, more, very, a, to, in, on, with, that, this). NEVER include words already covered by Key Expression. If fewer than 2 qualify, write "—".>
Grammar Insight: <ONLY if there is a genuinely useful, practical pattern worth flagging (separable-verb split, V2 word order, modal stacking, perfect-tense auxiliary choice, word-order inversion after a time phrase, etc.). One short, plain-${targetLanguage} sentence — no jargon. If the sentence has nothing special, write "—". Prefer "—" over generic comments like "this is a normal sentence".>

HARD RULES — failure to follow means your output is rejected:
- Be a coach, not a parser. Teach a PATTERN or NATIVE INTUITION, not the obvious meaning.
- Key Expression is the star. Pick the one phrase a learner would brag about knowing.
- NEVER restate the translation in "What's Happening", "Why Speakers Say It This Way", or "Grammar Insight".
- "What's Happening" is CONTEXT, max 1 sentence. If there's no real context to add, write "—".
- NEVER list every word. Vocabulary is curated, never exhaustive.
- NEVER use linguistic jargon ("dative", "subjunctive", "transitive", "valency", "auxiliary", "lexeme", "morpheme"). Use everyday words.
- NEVER use these openers anywhere: "The speaker is discussing/explaining/referring to", "The sentence refers to/means", "In this sentence", "This sentence is about", "The narrator".
- NEVER sound like a dictionary entry or a grammar textbook.
- NO bullet points, NO markdown, NO headings beyond the six labels above.
- Each label appears exactly once, in the exact order above.
- Prefer "—" over weak filler. Empty is better than generic.
${retry ? "\nIMPORTANT: Your previous output was weak (generic, meta, jargon, or restating the translation). Rewrite from scratch following the rules above strictly. Lead with a punchy Key Expression." : ""}`;
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

      const fallback = `Key Expression: —\nNatural Translation: —\nWhy Speakers Say It This Way: —\nWhat's Happening: —\nVocabulary: —\nGrammar Insight: —`;

      if (isRateLimit) {
        return { explanation: fallback, error: "rate_limited" as const };
      }
      if (isCredits) {
        return { explanation: fallback, error: "credits_exhausted" as const };
      }
      return { explanation: fallback, error: "unavailable" as const };
    }
  });
