import type { CefrLevel } from "@/lib/curated-library.functions";

export type LevelMeta = {
  level: CefrLevel;
  name: string;
  short: string;
  who: string;
  vocab: string;
  /** Tailwind classes for the level's difficulty colour. */
  badge: string;
  ring: string;
  bar: string;
  dot: string;
};

export const LEVEL_META: Record<CefrLevel, LevelMeta> = {
  A1: {
    level: "A1",
    name: "Beginner",
    short: "Learn basic Dutch using slow, easy-to-follow videos.",
    who: "For absolute beginners: very slow speech, everyday words, short clips with lots of repetition.",
    vocab: "~500 words",
    badge: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    ring: "hover:border-emerald-500/50 hover:shadow-emerald-500/10",
    bar: "bg-emerald-500",
    dot: "🟢",
  },
  A2: {
    level: "A2",
    name: "Elementary",
    short: "Follow simple conversations about familiar, everyday topics.",
    who: "For learners who know the basics and want simple stories, routines and short interviews.",
    vocab: "~1,000 words",
    badge: "bg-teal-500/15 text-teal-600 border-teal-500/30",
    ring: "hover:border-teal-500/50 hover:shadow-teal-500/10",
    bar: "bg-teal-500",
    dot: "🟢",
  },
  B1: {
    level: "B1",
    name: "Intermediate",
    short: "Understand clear, everyday Dutch on familiar subjects.",
    who: "For learners who can follow the gist of native content but still lose the thread on fast passages.",
    vocab: "~2,000 words",
    badge: "bg-sky-500/15 text-sky-600 border-sky-500/30",
    ring: "hover:border-sky-500/50 hover:shadow-sky-500/10",
    bar: "bg-sky-500",
    dot: "🔵",
  },
  B2: {
    level: "B2",
    name: "Upper Intermediate",
    short: "Handle real news, podcasts and interviews at natural speed.",
    who: "For learners comfortable with native pace who want to sharpen nuance, idioms and abstract topics.",
    vocab: "~4,000 words",
    badge: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    ring: "hover:border-amber-500/50 hover:shadow-amber-500/10",
    bar: "bg-amber-500",
    dot: "🟠",
  },
  C1: {
    level: "C1",
    name: "Advanced",
    short: "Follow complex debate, satire and specialised content.",
    who: "For advanced learners working on register, humour, implicit meaning and specialised vocabulary.",
    vocab: "~8,000 words",
    badge: "bg-orange-600/15 text-orange-600 border-orange-600/30",
    ring: "hover:border-orange-600/50 hover:shadow-orange-600/10",
    bar: "bg-orange-600",
    dot: "🔴",
  },
  C2: {
    level: "C2",
    name: "Proficient",
    short: "Enjoy anything a native speaker watches, with full nuance.",
    who: "For near-native learners polishing subtle meaning, dialects and highly idiomatic speech.",
    vocab: "16,000+ words",
    badge: "bg-red-500/15 text-red-600 border-red-500/30",
    ring: "hover:border-red-500/50 hover:shadow-red-500/10",
    bar: "bg-red-500",
    dot: "🔴",
  },
};

export const NEXT_LEVEL: Partial<Record<CefrLevel, CefrLevel>> = {
  A1: "A2",
  A2: "B1",
  B1: "B2",
  B2: "C1",
  C1: "C2",
};

export function parseLevel(slug: string): CefrLevel | null {
  const up = slug.toUpperCase();
  return up in LEVEL_META ? (up as CefrLevel) : null;
}
