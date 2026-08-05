import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact NativeFlow — Talk to the Founder" },
      {
        name: "description",
        content:
          "Get in touch with NativeFlow. Email support@nativeflow.life with questions, bug reports, or ideas for learning Dutch through native video.",
      },
      { property: "og:title", content: "Contact NativeFlow — Talk to the Founder" },
      {
        property: "og:description",
        content:
          "Questions, bugs or ideas? Email support@nativeflow.life and you'll reach the person who builds NativeFlow.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://nativeflow.life/contact" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://nativeflow.life/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to home
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">Contact</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        NativeFlow is built by one person, Mahta, in Eindhoven. Every message lands directly in her
        inbox, so feedback genuinely shapes what gets built next.
      </p>

      <div className="mt-8 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">Email</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Questions, bug reports, partnership ideas or anything else:
          </p>
          <a
            href="mailto:support@nativeflow.life"
            className="mt-2 inline-block text-sm font-semibold text-primary underline"
          >
            support@nativeflow.life
          </a>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">Something not working?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            If a transcript looks wrong or an explanation misses the point, tell us which video it
            was. That is the fastest way to get it fixed.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">Pricing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            NativeFlow is free while it is in beta. There is nothing to buy today, and we will
            announce any paid plan by email before it launches.
          </p>
        </div>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Read our{" "}
        <Link to="/privacy" className="text-primary underline">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link to="/terms" className="text-primary underline">
          Terms of Service
        </Link>
        .
      </p>
    </main>
  );
}
