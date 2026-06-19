/**
 * Lightweight, dependency-free language detection for transcript text.
 *
 * Built specifically to catch poisoned cache rows where an ASR provider
 * (Transcribr today) labels a clip with the wrong language. We don't need a
 * full LID model — a stopword/character-bigram heuristic over ~500 chars is
 * enough to tell apart the EU languages we actually support.
 *
 * Returns { language, confidence, scores } where language is null when no
 * candidate scores meaningfully higher than the runners-up.
 */

export type DetectedLanguage =
  | "nl"
  | "en"
  | "de"
  | "fr"
  | "es"
  | "it"
  | "pt";

export type LangDetectResult = {
  language: DetectedLanguage | null;
  confidence: number; // 0..1
  scores: Record<DetectedLanguage, number>;
  sampledChars: number;
};

// Very common stopwords / function words per language. Kept short so a few
// shared cognates don't dominate, and biased toward words that are rare in
// the other listed languages (e.g. Dutch "het", "een", "niet").
const STOPWORDS: Record<DetectedLanguage, string[]> = {
  nl: [
    "de", "het", "een", "en", "van", "is", "dat", "die", "niet", "in", "op",
    "te", "ik", "je", "we", "ze", "zijn", "was", "hebben", "wordt", "worden",
    "maar", "ook", "wel", "geen", "want", "omdat", "naar", "uit", "voor",
    "met", "aan", "bij", "of", "als", "dan", "nog", "zo", "heel", "echt",
  ],
  en: [
    "the", "and", "of", "to", "a", "in", "is", "it", "you", "that", "he",
    "was", "for", "on", "are", "with", "as", "i", "his", "they", "be", "at",
    "this", "have", "from", "or", "one", "had", "by", "not", "but", "what",
    "all", "were", "when", "we", "there", "can", "an", "your",
  ],
  de: [
    "der", "die", "und", "den", "von", "zu", "das", "mit", "sich", "des",
    "auf", "für", "ist", "im", "dem", "nicht", "ein", "eine", "als", "auch",
    "es", "an", "werden", "aus", "er", "hat", "dass", "sie", "nach", "wird",
    "bei", "noch", "wie", "über", "nur", "oder", "aber", "vor", "zur", "ich",
  ],
  fr: [
    "le", "la", "les", "de", "des", "et", "un", "une", "à", "est", "que",
    "qui", "dans", "pour", "pas", "au", "sur", "ce", "il", "elle", "nous",
    "vous", "ils", "elles", "mais", "ou", "avec", "son", "sa", "ses", "par",
    "plus", "comme", "tout", "même", "bien", "alors", "donc", "très", "été",
  ],
  es: [
    "el", "la", "los", "las", "de", "que", "y", "en", "un", "una", "es",
    "se", "no", "por", "con", "para", "su", "lo", "como", "más", "pero",
    "este", "esta", "yo", "tú", "él", "ella", "nosotros", "muy", "todo",
    "todos", "hay", "ser", "estar", "fue", "son", "han", "porque", "cuando",
  ],
  it: [
    "il", "la", "lo", "i", "gli", "le", "di", "che", "e", "a", "un", "una",
    "in", "per", "con", "non", "è", "si", "ma", "come", "se", "sono", "ho",
    "ha", "anche", "questo", "questa", "quello", "quella", "molto", "tutto",
    "tutti", "perché", "quando", "dove", "loro", "noi", "voi", "lui", "lei",
  ],
  pt: [
    "o", "a", "os", "as", "de", "que", "e", "em", "um", "uma", "para",
    "com", "não", "é", "se", "por", "do", "da", "dos", "das", "no", "na",
    "mas", "como", "mais", "muito", "também", "está", "são", "ser", "ter",
    "isso", "esse", "essa", "este", "esta", "porque", "quando", "onde",
  ],
};

const STOP_SETS: Record<DetectedLanguage, Set<string>> = Object.fromEntries(
  (Object.keys(STOPWORDS) as DetectedLanguage[]).map((lang) => [
    lang,
    new Set(STOPWORDS[lang]),
  ]),
) as Record<DetectedLanguage, Set<string>>;

const LANGS = Object.keys(STOPWORDS) as DetectedLanguage[];

/** Detect language from a chunk of text. Returns null language when unsure. */
export function detectLanguage(text: string, opts?: { sampleChars?: number }): LangDetectResult {
  const sampleChars = opts?.sampleChars ?? 800;
  const sample = (text ?? "").slice(0, sampleChars).toLowerCase();
  const sampledChars = sample.length;
  const tokens = sample
    .replace(/[^\p{L}\s']/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 1 && t.length <= 24);

  const scores: Record<DetectedLanguage, number> = {
    nl: 0, en: 0, de: 0, fr: 0, es: 0, it: 0, pt: 0,
  };

  for (const t of tokens) {
    for (const lang of LANGS) {
      if (STOP_SETS[lang].has(t)) scores[lang] += 1;
    }
  }

  // Character heuristics: distinctive diacritics / digraphs.
  if (/ç/.test(sample)) {
    scores.fr += 2; scores.pt += 2;
  }
  if (/ñ/.test(sample)) scores.es += 4;
  if (/ß|ä|ö|ü/.test(sample)) scores.de += 2;
  if (/ã|õ/.test(sample)) scores.pt += 4;
  if (/à|è|ò|ù|ì/.test(sample)) scores.it += 1;
  if (/\bij\b/.test(sample) || /\b(een|niet|maar|omdat|zonder)\b/.test(sample)) {
    scores.nl += 2;
  }
  if (/\b(the|and|that|with|from|this)\b/.test(sample)) scores.en += 1;

  // Pick winner.
  let best: DetectedLanguage | null = null;
  let bestScore = 0;
  let second = 0;
  for (const lang of LANGS) {
    const s = scores[lang];
    if (s > bestScore) {
      second = bestScore;
      bestScore = s;
      best = lang;
    } else if (s > second) {
      second = s;
    }
  }

  const totalSignal = bestScore + second;
  // Need enough signal (≥3 hits) AND a meaningful margin over runner-up.
  let language: DetectedLanguage | null = null;
  let confidence = 0;
  if (best && bestScore >= 3 && totalSignal > 0) {
    confidence = (bestScore - second) / Math.max(bestScore, 1);
    if (confidence >= 0.25) language = best;
  }

  return { language, confidence: Number(confidence.toFixed(3)), scores, sampledChars };
}

/** Returns true when two language codes refer to the same base language. */
export function sameBaseLanguage(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const norm = (s: string) => s.toLowerCase().split(/[-_]/)[0];
  return norm(a) === norm(b);
}
