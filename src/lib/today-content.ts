// Data model for the /today daily discovery feed.
// Placeholder content — structure designed so a real ingestion pipeline
// (news APIs, YouTube trending, podcast RSS, social trends) can populate it.

export type TodayCategory =
  | "trending"
  | "talking"
  | "watch"
  | "listen"
  | "expressions";

export type Difficulty = "A2" | "B1" | "B2" | "C1";

export type VocabItem = {
  nl: string;
  en: string;
  example?: string;
};

export type TodayItem = {
  id: string;
  category: TodayCategory;
  title: string;
  source: string;
  contentType: "video" | "podcast" | "article" | "expression" | "discussion";
  summaryEn: string;
  whyRelevant: string;
  difficulty: Difficulty;
  imageUrl?: string;
  vocab: VocabItem[];
  cta?: string;
  // Optional deep-link into the existing NativeFlow player. When set, the card
  // navigates to /?v=<videoId> so it reuses the existing learning experience.
  youtubeId?: string;
};

export const TODAY_DATE_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

export const TODAY_ITEMS: TodayItem[] = [
  {
    id: "trend-1",
    category: "trending",
    title: "Woningnood: waarom bouwen zo traag gaat",
    source: "NOS Nieuwsuur",
    contentType: "video",
    summaryEn:
      "Why the Dutch housing shortage keeps growing despite ambitious construction plans.",
    whyRelevant:
      "One of the most discussed topics in Dutch media this week — you'll hear 'woningnood' everywhere.",
    difficulty: "B1",
    imageUrl:
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=75",
    vocab: [
      { nl: "woningnood", en: "housing shortage", example: "De woningnood in Amsterdam is enorm." },
      { nl: "bouwen", en: "to build" },
      { nl: "vergunning", en: "permit" },
      { nl: "huurprijs", en: "rental price" },
    ],
    cta: "Learn through this content",
  },
  {
    id: "trend-2",
    category: "trending",
    title: "Klimaatakkoord onder druk",
    source: "NRC",
    contentType: "article",
    summaryEn:
      "The Dutch climate agreement faces political pushback ahead of new elections.",
    whyRelevant:
      "Trending on Dutch Twitter and in every talk show this weekend.",
    difficulty: "B2",
    imageUrl:
      "https://images.unsplash.com/photo-1569163139394-de4e5f43e4e3?w=800&q=75",
    vocab: [
      { nl: "klimaatakkoord", en: "climate agreement" },
      { nl: "uitstoot", en: "emissions" },
      { nl: "onder druk staan", en: "to be under pressure" },
    ],
  },
  {
    id: "talk-1",
    category: "talking",
    title: "Moet de 4-daagse werkweek de norm worden?",
    source: "De Correspondent",
    contentType: "discussion",
    summaryEn:
      "Debate around whether the Netherlands should officially move to a four-day working week.",
    whyRelevant:
      "A recurring national conversation — great for opinion vocabulary.",
    difficulty: "B1",
    imageUrl:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&q=75",
    vocab: [
      { nl: "werkweek", en: "working week" },
      { nl: "productiviteit", en: "productivity" },
      { nl: "burn-out", en: "burnout" },
      { nl: "vrije tijd", en: "free time" },
    ],
  },
  {
    id: "watch-1",
    category: "watch",
    title: "Arjen Lubach — De week doorgenomen",
    source: "YouTube · VPRO",
    contentType: "video",
    summaryEn:
      "The satirical weekly recap that half of the Netherlands watches on Sunday night.",
    whyRelevant:
      "Fast, colloquial Dutch with tons of current references.",
    difficulty: "B2",
    imageUrl:
      "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800&q=75",
    vocab: [
      { nl: "de week doornemen", en: "to review the week" },
      { nl: "satire", en: "satire" },
      { nl: "aan de kaak stellen", en: "to call out / expose" },
    ],
    cta: "Watch with subtitles",
  },
  {
    id: "watch-2",
    category: "watch",
    title: "Zondag met Lubach — highlights",
    source: "YouTube",
    contentType: "video",
    summaryEn: "Highlight clips from this week's most-shared Dutch talk show moments.",
    whyRelevant: "Bite-sized clips — perfect for a first watch.",
    difficulty: "B1",
    imageUrl:
      "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&q=75",
    vocab: [
      { nl: "hoogtepunt", en: "highlight" },
      { nl: "aflevering", en: "episode" },
    ],
  },
  {
    id: "listen-1",
    category: "listen",
    title: "NRC Vandaag — Dagelijkse nieuwspodcast",
    source: "Podcast · NRC",
    contentType: "podcast",
    summaryEn:
      "A 20-minute daily podcast unpacking one Dutch news story in depth.",
    whyRelevant:
      "Clear diction and a predictable structure — ideal daily listening practice.",
    difficulty: "B1",
    imageUrl:
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&q=75",
    vocab: [
      { nl: "vandaag", en: "today" },
      { nl: "in het kort", en: "in short / briefly" },
      { nl: "verslaggever", en: "reporter" },
    ],
  },
  {
    id: "listen-2",
    category: "listen",
    title: "De Universiteit van Nederland",
    source: "Podcast",
    contentType: "podcast",
    summaryEn:
      "Dutch professors explaining big ideas in accessible language.",
    whyRelevant: "Academic vocabulary without the density of an actual lecture.",
    difficulty: "B2",
    imageUrl:
      "https://images.unsplash.com/photo-1485579149621-3123dd979885?w=800&q=75",
    vocab: [
      { nl: "onderzoek", en: "research" },
      { nl: "hoogleraar", en: "professor" },
      { nl: "verklaren", en: "to explain" },
    ],
  },
  {
    id: "expr-1",
    category: "expressions",
    title: "Doe maar gewoon, dan doe je al gek genoeg",
    source: "Dutch idiom",
    contentType: "expression",
    summaryEn:
      "'Just act normal, that's crazy enough already' — the unofficial motto of Dutch culture.",
    whyRelevant:
      "You'll hear a version of this any time someone brags or overreacts.",
    difficulty: "A2",
    vocab: [
      { nl: "doe maar gewoon", en: "just act normal" },
      { nl: "gek", en: "crazy" },
      { nl: "genoeg", en: "enough" },
    ],
  },
  {
    id: "expr-2",
    category: "expressions",
    title: "Even dimmen",
    source: "Dutch expression",
    contentType: "expression",
    summaryEn: "'Tone it down' — used to tell someone to calm down or lower the volume.",
    whyRelevant: "Very common in casual conversation and on Dutch TV this week.",
    difficulty: "A2",
    vocab: [
      { nl: "dimmen", en: "to dim / tone down" },
      { nl: "rustig aan", en: "take it easy" },
    ],
  },
  {
    id: "expr-3",
    category: "expressions",
    title: "Dat slaat als een tang op een varken",
    source: "Dutch idiom",
    contentType: "expression",
    summaryEn: "'That makes no sense' — literally 'that hits like pliers on a pig'.",
    whyRelevant: "A classic Dutch idiom that native speakers still use daily.",
    difficulty: "B1",
    vocab: [
      { nl: "slaan op", en: "to relate to" },
      { nl: "tang", en: "pliers" },
      { nl: "varken", en: "pig" },
    ],
  },
];

export const CATEGORY_META: Record<
  TodayCategory,
  { label: string; emoji: string; description: string }
> = {
  trending: {
    label: "Trending now",
    emoji: "🔥",
    description: "The stories dominating Dutch media today.",
  },
  talking: {
    label: "What people are talking about",
    emoji: "📰",
    description: "Discussions and debates from Dutch social media.",
  },
  watch: {
    label: "Watch",
    emoji: "🎥",
    description: "Videos worth watching today.",
  },
  listen: {
    label: "Listen",
    emoji: "🎧",
    description: "Podcasts for your commute.",
  },
  expressions: {
    label: "Dutch expressions you'll hear today",
    emoji: "💬",
    description: "Idioms and phrases in circulation right now.",
  },
};
