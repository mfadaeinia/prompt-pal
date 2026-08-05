import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — NativeFlow" },
      {
        name: "description",
        content:
          "The terms for using NativeFlow: acceptable use, third-party video content, availability during beta, and how to contact us.",
      },
      { property: "og:title", content: "Terms of Service — NativeFlow" },
      {
        property: "og:description",
        content:
          "The terms for using NativeFlow: acceptable use, third-party video content, and availability during beta.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://nativeflow.life/terms" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://nativeflow.life/terms" }],
  }),
  component: TermsPage,
});

const UPDATED = "5 August 2026";

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to home
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. The service</h2>
          <p className="mt-2">
            NativeFlow helps you understand native Dutch videos by showing a synchronised transcript
            and explaining sentences on demand. By using it, you agree to these terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">2. Beta software</h2>
          <p className="mt-2">
            NativeFlow is an early-stage product built by one person. Features may change or break,
            and availability is not guaranteed. It is currently free to use; if paid plans are
            introduced, existing features you rely on will not be removed without notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Your account</h2>
          <p className="mt-2">
            You are responsible for keeping access to your email and account secure, and for the
            content you save. You must be old enough to consent to data processing in your country.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Third-party content</h2>
          <p className="mt-2">
            Videos are played through YouTube's embedded player and remain the property of their
            creators. NativeFlow does not host, download or redistribute them, and your use of them
            is also subject to YouTube's terms. Transcripts and explanations are study aids generated
            from the original audio or captions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Acceptable use</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>Do not use NativeFlow to break the law or infringe anyone's rights.</li>
            <li>Do not attempt to disrupt, overload or reverse-engineer the service.</li>
            <li>Do not use it to bulk-extract transcripts or resell generated content.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">6. AI-generated explanations</h2>
          <p className="mt-2">
            Explanations, translations and transcripts are produced automatically and can contain
            mistakes. Treat them as learning support, not as authoritative translation.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Liability</h2>
          <p className="mt-2">
            The service is provided "as is", without warranties. To the extent permitted by law, we
            are not liable for indirect or consequential damages arising from your use of NativeFlow.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">8. Contact</h2>
          <p className="mt-2">
            Questions about these terms? Email{" "}
            <a className="text-primary underline" href="mailto:support@nativeflow.life">
              support@nativeflow.life
            </a>
            . These terms are governed by Dutch law.
          </p>
        </section>

        <p>
          See also our{" "}
          <Link to="/privacy" className="text-primary underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
