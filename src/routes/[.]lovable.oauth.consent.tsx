import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";

type AuthorizationDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase session lives in localStorage, absent during SSR.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  component: Consent,
});

function Consent() {
  const { authorization_id } = Route.useSearch();
  const [status, setStatus] = useState<"loading" | "signin" | "ready" | "error">("loading");
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authorization_id) {
        setError("Missing authorization_id.");
        setStatus("error");
        return;
      }
      const { data: session } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session.session) {
        setStatus("signin");
        return;
      }
      const { data, error: err } = await oauth().getAuthorizationDetails(authorization_id);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setStatus("error");
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [authorization_id]);

  async function signIn() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.href,
    });
    if (result.error) {
      setBusy(false);
      setError(result.error.message);
    }
  }

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: err } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "this app";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        {status === "loading" && <p className="text-sm text-muted-foreground">Loading authorization request…</p>}

        {status === "signin" && (
          <>
            <h1 className="text-xl font-semibold text-foreground">Sign in to continue</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your NativeFlow account to connect an AI assistant to your library.
            </p>
            <Button className="mt-6 w-full" disabled={busy} onClick={signIn}>
              Continue with Google
            </Button>
          </>
        )}

        {status === "ready" && (
          <>
            <h1 className="text-xl font-semibold text-foreground">Connect {clientName} to NativeFlow</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {clientName} will be able to read your saved sentences and videos, and add or remove videos in your
              library — acting as you.
            </p>
            <div className="mt-6 flex gap-3">
              <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                Approve
              </Button>
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                Deny
              </Button>
            </div>
          </>
        )}

        {status === "error" && (
          <p className="text-sm text-destructive" role="alert">
            Could not load this authorization request: {error}
          </p>
        )}

        {status !== "error" && error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
