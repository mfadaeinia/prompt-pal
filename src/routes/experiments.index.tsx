import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/experiments/")({
  head: () => ({
    meta: [
      { title: "Experiments — NativeFlow (internal)" },
      { name: "description", content: "Internal experiment surfaces for NativeFlow." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Experiments — NativeFlow (internal)" },
      { property: "og:description", content: "Internal experiment surfaces for NativeFlow." },
    ],
  }),
  component: ExperimentsIndex,
});

function ExperimentsIndex() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-foreground">Experiments</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Internal only. Not linked from the public product and excluded from search.
      </p>
      <ul className="mt-6 space-y-2 text-sm">
        <li>
          <Link
            to="/experiments/passive-learning"
            className="font-medium text-primary underline underline-offset-4"
          >
            Passive learning
          </Link>
          <span className="text-muted-foreground">
            {" "}
            — player with the useful-expression bar, expression ranking and learner-level
            personalization enabled.
          </span>
        </li>
      </ul>
    </main>
  );
}
