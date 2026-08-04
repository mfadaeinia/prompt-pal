import type { CefrLevel } from "@/lib/curated-library.functions";

export type BrowseVideo = {
  id: string;
  title: string;
  description: string;
  level: CefrLevel;
  tags: string[];
  duration: string;
  thumbnail: string;
};

/**
 * Placeholder curated content for the Browse by Level page.
 * Static on purpose: this is design/demo content, not CMS data.
 */
export const BROWSE_VIDEOS: BrowseVideo[] = [
  {
    id: "b1-expressions",
    title: "Dat slaat nergens op.",
    description: "Understand Dutch expressions",
    level: "B1",
    tags: ["Expressions", "Conversation"],
    duration: "12:45",
    thumbnail:
      "https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=640&q=70",
  },
  {
    id: "b2-machine",
    title: "De Nederlandse machine waar de wereld om vecht",
    description: "Technology & Innovation",
    level: "B2",
    tags: ["Technology", "News"],
    duration: "14:32",
    thumbnail:
      "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=640&q=70",
  },
  {
    id: "a2-eerste-dag",
    title: "Eerste dag in Nederland",
    description: "Daily life & Culture",
    level: "A2",
    tags: ["Daily Life", "Culture"],
    duration: "8:16",
    thumbnail:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=640&q=70",
  },
  {
    id: "c1-toekomst-werk",
    title: "De toekomst van werk",
    description: "Society & Future",
    level: "C1",
    tags: ["Society", "Future"],
    duration: "18:21",
    thumbnail:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=640&q=70",
  },
  {
    id: "a1-eten",
    title: "Typisch Nederlands eten",
    description: "Food & Traditions",
    level: "A1",
    tags: ["Food", "Culture"],
    duration: "6:52",
    thumbnail:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=640&q=70",
  },
  {
    id: "b1-fietsen",
    title: "Waarom fietst iedereen in Nederland?",
    description: "Everyday habits explained",
    level: "B1",
    tags: ["Daily Life", "Culture"],
    duration: "9:40",
    thumbnail:
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=640&q=70",
  },
  {
    id: "a2-boodschappen",
    title: "Boodschappen doen bij de supermarkt",
    description: "Practical vocabulary",
    level: "A2",
    tags: ["Daily Life", "Vocabulary"],
    duration: "7:05",
    thumbnail:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=640&q=70",
  },
  {
    id: "c2-satire",
    title: "Satire en subtiele humor",
    description: "Nuance & implicit meaning",
    level: "C2",
    tags: ["Comedy", "Culture"],
    duration: "21:10",
    thumbnail:
      "https://images.unsplash.com/photo-1527224857830-43a7acc85260?auto=format&fit=crop&w=640&q=70",
  },
];

export type LevelStat = {
  level: CefrLevel;
  label: string;
  blurb: string;
  videos: number;
  duration: string;
};

export const LEVEL_STATS: LevelStat[] = [
  { level: "A1", label: "Beginner", blurb: "Start here if you're new to Dutch.", videos: 24, duration: "6–8 min average" },
  { level: "A2", label: "Elementary", blurb: "Build your everyday vocabulary.", videos: 32, duration: "8–10 min average" },
  { level: "B1", label: "Intermediate", blurb: "Understand more, express more.", videos: 41, duration: "10–15 min average" },
  { level: "B2", label: "Upper Intermediate", blurb: "Dive deeper into real topics.", videos: 36, duration: "12–18 min average" },
  { level: "C1", label: "Advanced", blurb: "Advanced Dutch, real conversations.", videos: 28, duration: "15–25 min average" },
  { level: "C2", label: "Proficient", blurb: "For fluent learners and beyond.", videos: 18, duration: "20+ min average" },
];
