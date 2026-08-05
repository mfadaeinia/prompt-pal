import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — NativeFlow" },
      {
        name: "description",
        content:
          "How NativeFlow handles your data: what we store, why we store it, which services we use, and how to request deletion.",
      },
      { property: "og:title", content: "Privacy Policy — NativeFlow" },
      {
        property: "og:description",
        content:
          "How NativeFlow handles your data: what we store, why we store it, and how to request deletion.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://nativeflow.life/privacy" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://nativeflow.life/privacy" }],
  }),
  component: PrivacyPage,
});

const UPDATED = "5 August 2026";

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to home
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">Who we are</h2>
          <p className="mt-2">
            NativeFlow is an independent language-learning product built in Eindhoven, the
            Netherlands. It helps you understand native Dutch YouTube videos by explaining
            sentences in context. You can reach us any time at{" "}
            <a className="text-primary underline" href="mailto:support@nativeflow.life">
              support@nativeflow.life
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">What we collect</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Account data.</strong> If you create an account,
              we store your email address and authentication metadata so you can sign back in.
            </li>
            <li>
              <strong className="text-foreground">Learning data.</strong> Videos you open, sentences
              you save, saved expressions and vocabulary, and the videos you bookmark or mark as
              watched.
            </li>
            <li>
              <strong className="text-foreground">Transcripts.</strong> Transcripts of the videos you
              open are cached so the same video loads faster next time.
            </li>
            <li>
              <strong className="text-foreground">Product analytics.</strong> Anonymous page views
              and feature-usage events (for example, that a sentence explanation was requested),
              plus a random browser identifier. We do not use advertising trackers.
            </li>
            <li>
              <strong className="text-foreground">Feedback.</strong> Anything you voluntarily send us
              through the in-app feedback form.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Why we use it</h2>
          <p className="mt-2">
            To provide the product (playback, transcripts, explanations, saved items), to keep it
            secure, and to understand which parts of it actually help people learn so we can improve
            them. We do not sell your data, and we do not use it for advertising.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Services we rely on</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>Cloud database, authentication and hosting providers, to run the app.</li>
            <li>
              AI providers, to generate sentence explanations and, when captions are unavailable, to
              transcribe audio. Only the sentence or audio needed for that request is sent.
            </li>
            <li>YouTube, to embed and play the videos you choose.</li>
            <li>An email provider, to send sign-in and account emails.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Retention and your rights</h2>
          <p className="mt-2">
            We keep your data while your account exists. You can ask us to access, correct, export
            or delete your data by emailing{" "}
            <a className="text-primary underline" href="mailto:support@nativeflow.life">
              support@nativeflow.life
            </a>
            . Because NativeFlow is built in the EU, GDPR rights apply, including the right to
            complain to your local data-protection authority.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Cookies and local storage</h2>
          <p className="mt-2">
            We use browser storage for essentials only: keeping you signed in, remembering your
            explanation language, and remembering which onboarding hints you have already seen.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Changes</h2>
          <p className="mt-2">
            NativeFlow is in active development, so this policy may change. Significant changes will
            be reflected in the date above.
          </p>
        </section>

        <p>
          See also our{" "}
          <Link to="/terms" className="text-primary underline">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
