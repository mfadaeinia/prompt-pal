import { useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { track } from "@/lib/analytics";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
};

const BENEFITS = [
  "Save words and phrases automatically",
  "Continue learning from any device",
  "Track your learning progress",
  "No credit card required",
];

export function AuthDialog({
  open,
  onOpenChange,
  title = "Create your free account",
  description = "Save vocabulary, track your progress, and continue learning across devices.",
}: Props) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) track("auth_dialog_opened", {});
  }, [open]);

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    track("google_login_started", {});
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.href,
      });
      if (result.error) {
        setError(result.error.message || "Could not sign in with Google.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white p-0 overflow-hidden">
        <div className="px-6 pt-8 pb-6 sm:px-8 sm:pt-10 sm:pb-8">
          <DialogHeader className="space-y-3 text-center sm:text-center">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground leading-relaxed">
              {description}
            </DialogDescription>
          </DialogHeader>

          <p className="mt-6 text-xs font-medium text-muted-foreground text-center">
            Your learning progress is automatically saved to your account.
          </p>

          <ul className="mt-5 space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 space-y-3">
            <Button
              type="button"
              className="w-full h-12 text-base font-medium"
              onClick={handleGoogle}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <GoogleIcon /> Continue with Google
                </>
              )}
            </Button>

            <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                We only use your Google account for authentication and basic profile information. We never access your emails.
              </p>
            </div>

            {error && <p className="text-xs text-destructive text-center">{error}</p>}

            <p className="text-[11px] text-muted-foreground text-center pt-1">
              By continuing, you agree to our{" "}
              <a href="/terms" className="underline hover:text-foreground">Terms</a>
              {" "}and{" "}
              <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
