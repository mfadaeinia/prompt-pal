/** Pick ONE useful expression out of the explanation the existing pipeline
 *  already produces for a sentence. No new NLP: we reuse the "Key Expressions"
 *  (and, as a fallback, "Vocabulary") fields and rank by simple pedagogical
 *  signals that are already present — tags and phrase length. */

export type UsefulExpression = {
  head: string;
  meaning: string;
  tag: string | null;
};

const TAG_WEIGHT: Record<string, number> = {
  idiom: 5,
  "very common": 4,
  phrasal: 3,
  common: 3,
  informal: 2,
  news: 2,
  formal: 1,
};

function parseItems(raw: string): UsefulExpression[] {
  if (!raw || raw === "—") return [];
  return raw
    .split(/\s*·\s*/)
    .map((item) => {
      const tagMatch = item.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
      const tag = tagMatch ? tagMatch[2].trim() : null;
      const core = (tagMatch ? tagMatch[1] : item).trim();
      const idx = core.indexOf("=");
      if (idx < 0) return null;
      const head = core.slice(0, idx).trim();
      const meaning = core.slice(idx + 1).trim();
      if (!head || !meaning) return null;
      return { head, meaning, tag };
    })
    .filter((x): x is UsefulExpression => x !== null);
}

function score(e: UsefulExpression) {
  const tagScore = e.tag ? (TAG_WEIGHT[e.tag.toLowerCase()] ?? 1) : 0;
  const words = e.head.trim().split(/\s+/).length;
  // Multi-word expressions teach more than single words, but very long
  // fragments are usually just a chunk of the sentence.
  const lengthScore = words >= 2 && words <= 5 ? 2 : words === 1 ? 0.5 : 0;
  return tagScore + lengthScore;
}

/** The single strongest expression for this moment, or null when the
 *  sentence has nothing worth surfacing (we stay quiet then). */
export function pickUsefulExpression(
  keyExpressions: string,
  vocabulary: string,
): UsefulExpression | null {
  const items = [...parseItems(keyExpressions), ...parseItems(vocabulary)];
  if (items.length === 0) return null;
  return items.slice().sort((a, b) => score(b) - score(a))[0];
}

/** All expressions from a sentence, strongest first (used for the rolling
 *  "Useful Dutch" queue). */
export function rankUsefulExpressions(
  keyExpressions: string,
  vocabulary: string,
): UsefulExpression[] {
  const items = [...parseItems(keyExpressions), ...parseItems(vocabulary)];
  const seen = new Set<string>();
  return items
    .filter((e) => {
      const k = e.head.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => score(b) - score(a));
}
