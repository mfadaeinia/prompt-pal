import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { TestUserBadge } from "../components/DevAnalyticsPanel";

function NotFoundComponent() {
  useEffect(() => {
    document.title = "Page not found — NativeFlow";
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-site-verification", content: "x4c7ZElUAjtWIupXKHzTeBKUKpvH4_sNO16_f8f-vNE" },
      { title: "NativeFlow - Watch Native Dutch Content, Understand It Completely" },
      { name: "description", content: "Turn any YouTube video or podcast you love into a language lesson, without leaving the experience." },
      { name: "author", content: "NativeFlow" },
      { property: "og:site_name", content: "NativeFlow" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/s5dEz7LcCzaJ5od1wRUTKGEmBsg2/social-images/social-1782128857966-Branding.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/s5dEz7LcCzaJ5od1wRUTKGEmBsg2/social-images/social-1782128857966-Branding.webp" },
      // Cache-busting: force browsers to always fetch fresh HTML so they never load a stale asset manifest
      { httpEquiv: "Cache-Control", content: "no-cache, no-store, must-revalidate" },
      { httpEquiv: "Pragma", content: "no-cache" },
      { httpEquiv: "Expires", content: "0" },
      { property: "og:title", content: "NativeFlow — Understand any video, sentence by sentence" },
      { name: "twitter:title", content: "NativeFlow — Understand any video, sentence by sentence" },
      { property: "og:description", content: "Click any sentence in a YouTube video to get translations, explanations, vocabulary, and context — instantly." },
      { name: "twitter:description", content: "Click any sentence in a YouTube video to get translations, explanations, vocabulary, and context — instantly." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/svg+xml", href: "/logo-mark.svg" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "NativeFlow",
              url: "https://nativeflow.life",
            },
            {
              "@type": "WebSite",
              name: "NativeFlow",
              url: "https://nativeflow.life",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    import("../lib/tester").then(({ captureTesterRefFromUrl }) => {
      captureTesterRefFromUrl();
    });
    import("../lib/analytics").then(({ initAnalytics, track }) => {
      initAnalytics();
      track("page_view", { path: window.location.pathname });
    });
    // True visitor signal: one page_views row carrying BOTH the per-session id
    // and the persistent anonymous visitor id. Fire-and-forget.
    Promise.all([
      import("../lib/page-views.functions"),
      import("../lib/identity"),
    ])
      .then(([{ logPageView }, { getAnonymousUserId, getSessionId }]) => {
        const anonId = getAnonymousUserId();
        const sid = getSessionId() || anonId;
        if (!sid) return;
        const params = new URLSearchParams(window.location.search);
        return logPageView({
          data: {
            sessionId: sid,
            anonymousId: anonId || null,
            path: window.location.pathname,
            referrer: document.referrer || null,
            utmSource: params.get("utm_source"),
            utmMedium: params.get("utm_medium"),
            utmCampaign: params.get("utm_campaign"),
          },
        });
      })
      .catch(() => {});

  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TestUserBadge />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
