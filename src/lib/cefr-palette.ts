import type { CefrLevel } from "@/lib/curated-library.functions";

/** Soft pastel palette per CEFR level for the Browse dashboard cards. */
export const LEVEL_PALETTE: Record<
  CefrLevel,
  { tile: string; badge: string; art: string; blurb: string }
> = {
  A1: {
    tile: "bg-violet-50 border-violet-100",
    badge: "bg-violet-100 text-violet-700",
    art: "text-violet-300",
    blurb: "Perfect if you're just starting Dutch.",
  },
  A2: {
    tile: "bg-emerald-50 border-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
    art: "text-emerald-300",
    blurb: "Build your everyday vocabulary.",
  },
  B1: {
    tile: "bg-sky-50 border-sky-100",
    badge: "bg-sky-100 text-sky-700",
    art: "text-sky-300",
    blurb: "Understand more, express more.",
  },
  B2: {
    tile: "bg-amber-50 border-amber-100",
    badge: "bg-amber-100 text-amber-700",
    art: "text-amber-300",
    blurb: "Dive deeper into real topics.",
  },
  C1: {
    tile: "bg-pink-50 border-pink-100",
    badge: "bg-pink-100 text-pink-700",
    art: "text-pink-300",
    blurb: "Advanced Dutch, real conversations.",
  },
  C2: {
    tile: "bg-indigo-50 border-indigo-100",
    badge: "bg-indigo-100 text-indigo-700",
    art: "text-indigo-300",
    blurb: "For fluent learners and beyond.",
  },
};
