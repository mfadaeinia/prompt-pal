import { createFileRoute } from "@tanstack/react-router";
import { HomeApp } from "@/features/home/HomeApp";

/**
 * Internal experiment surface: the same player as the public product, with the
 * passive-learning layer (useful-expression bar, expression ranking, learner
 * level) switched on. Not linked publicly, noindex, absent from the sitemap.
 */
export const Route = createFileRoute("/experiments/passive-learning")({
  head: () => ({
    meta: [
      { title: "Passive learning experiment — NativeFlow (internal)" },
      {
        name: "description",
        content: "Internal passive-learning experiment surface for NativeFlow.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Passive learning experiment — NativeFlow" },
      {
        property: "og:description",
        content: "Internal passive-learning experiment surface for NativeFlow.",
      },
    ],
  }),
  component: PassiveLearningExperiment,
});

function PassiveLearningExperiment() {
  return <HomeApp experiment />;
}
