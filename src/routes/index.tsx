import { createFileRoute } from "@tanstack/react-router";
import { curatedVideosQuery } from "@/lib/curated-videos.query";
import { HomeApp } from "@/features/home/HomeApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NativeFlow - Watch Native Dutch Content, Understand It Completely" },
      {
        name: "description",
        content:
          "Turn any YouTube video or podcast you love into a language lesson, without leaving the experience.",
      },
      { property: "og:title", content: "NativeFlow - Watch Native Dutch Content, Understand It Completely" },
      { property: "og:description", content: "Turn any YouTube video or podcast you love into a language lesson, without leaving the experience." },
      { property: "og:url", content: "https://nativeflow.life/" },
      { property: "og:image", content: "https://nativeflow.life/og-image.jpg?v=2" },
      { property: "og:image:width", content: "1216" },
      { property: "og:image:height", content: "640" },
      { name: "twitter:title", content: "NativeFlow - Watch Native Dutch Content, Understand It Completely" },
      { name: "twitter:description", content: "Turn any YouTube video or podcast you love into a language lesson, without leaving the experience." },
      { name: "twitter:image", content: "https://nativeflow.life/og-image.jpg?v=2" },
    ],
    links: [
      { rel: "canonical", href: "https://nativeflow.life/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "NativeFlow",
          applicationCategory: "EducationApplication",
          operatingSystem: "Web",
          url: "https://nativeflow.life/",
          description:
            "Turn any YouTube video or podcast you love into a language lesson, without leaving the experience.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),

  // Prime the curated-library cache so the discovery strip is server-rendered
  // with real videos instead of a "Loading…" placeholder.
  loader: ({ context }) => {
    // Non-blocking: the curated strip is secondary content, so it must never
    // delay the landing page's first paint.
    void context.queryClient.prefetchQuery(curatedVideosQuery(60));
  },

  component: HomeApp,

});

