import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { X, Loader2, MessageCircle } from "lucide-react";
import { submitFeedback } from "@/lib/feedback.functions";
import { track } from "@/lib/analytics";

type Step = "ask" | "detail" | "again" | "done";

export type FeedbackContext = () => {
  sessionId: string;
  videoId: string | null;
  totalSentenceClicks: number;
  timeOnPageSeconds: number;
  demoStarted: boolean;
  pageUrl: string;
};

export function FeedbackWidget({
  triggerReason,
  getContext,
  onDismiss,
}: {
  triggerReason: string;
  getContext: FeedbackContext;
  onDismiss: () => void;
}) {
  const submit = useServerFn(submitFeedback);
  const [step, setStep] = useState<Step>("ask");
  const [sentiment, setSentiment] = useState<"positive" | "negative" | null>(null);
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function pickSentiment(s: "positive" | "negative") {
    const ctx = getContext();
    setSentiment(s);
    track(s === "positive" ? "feedback_positive" : "feedback_negative", {
      video_id: ctx.videoId,
      trigger_reason: triggerReason,
      total_sentence_clicks: ctx.totalSentenceClicks,
      time_on_page_seconds: ctx.timeOnPageSeconds,
      demo_started: ctx.demoStarted,
    });
    setStep("detail");
  }

  function goToAgain() {
    setStep("again");
  }

  async function finish(again: "definitely" | "maybe" | "probably_not") {
    if (!sentiment) return;
    const ctx = getContext();
    setSubmitting(true);
    track("would_use_again", { choice: again, video_id: ctx.videoId });
    if (email.trim()) {
      track("feedback_email_provided", {
        video_id: ctx.videoId,
        sentiment,
      });
    }
    try {
      await submit({
        data: {
          sessionId: ctx.sessionId,
          videoId: ctx.videoId,
          sentiment,
          usefulText: text.trim() || null,
          wouldUseAgain: again,
          triggerReason,
          email: email.trim() || null,
          pageUrl: ctx.pageUrl,
          totalSentenceClicks: ctx.totalSentenceClicks,
          timeOnPageSeconds: ctx.timeOnPageSeconds,
          demoStarted: ctx.demoStarted,
        },
      });
    } catch (err) {
      // TEMP DEBUG: log DB write failures so they don't silently swallow analytics
      console.error("feedback_submit_db_failed", err);
    }
    const submittedPayload = {
      sentiment,
      would_use_again: again,
      has_text: !!text.trim(),
      has_email: !!email.trim(),
      video_id: ctx.videoId,
      total_sentence_clicks: ctx.totalSentenceClicks,
      time_on_page_seconds: ctx.timeOnPageSeconds,
      demo_started: ctx.demoStarted,
      trigger_reason: triggerReason,
    };
    // TEMP DEBUG: verify PostHog event firing for feedback conversion
    console.log("feedback_submitted", submittedPayload);
    track("feedback_submitted", submittedPayload);
    setStep("done");
    setTimeout(onDismiss, 2200);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-5 shadow-2xl ring-1 ring-primary/10 animate-in slide-in-from-bottom-4">
      <button
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-accent"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-3 flex items-center gap-2 pr-6">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageCircle className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          💬 Help improve NativeFlow
        </p>
      </div>

      {step === "ask" && (
        <>
          <p className="text-sm font-semibold text-foreground">Was this useful?</p>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => pickSentiment("positive")}
            >
              👍 Yes
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => pickSentiment("negative")}
            >
              👎 No
            </Button>
          </div>
        </>
      )}

      {step === "detail" && (
        <>
          <p className="text-sm font-semibold text-foreground">
            {sentiment === "positive"
              ? "What did you find most useful?"
              : "What was confusing, missing, or frustrating?"}
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            rows={3}
            placeholder="Optional — a few words help a lot."
            className="mt-3 text-sm"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={goToAgain}>
              Skip
            </Button>
            <Button size="sm" onClick={goToAgain}>
              Next
            </Button>
          </div>
        </>
      )}

      {step === "again" && (
        <>
          <p className="text-sm font-semibold text-foreground">
            Would you use NativeFlow again?
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => finish("definitely")}
            >
              Definitely
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => finish("maybe")}
            >
              Maybe
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => finish("probably_not")}
            >
              Probably not
            </Button>
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <label className="text-xs font-medium text-foreground">
              Email (optional)
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.slice(0, 255))}
              placeholder="Leave your email if you'd like updates or a short chat."
              className="mt-1.5 h-9 text-sm"
              disabled={submitting}
            />
          </div>

          {submitting && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </p>
          )}
        </>
      )}

      {step === "done" && (
        <p className="text-sm font-medium text-foreground">
          🙏 Thank you! Your feedback helps shape NativeFlow.
        </p>
      )}
    </div>
  );
}

export function FeedbackFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-lg ring-1 ring-primary/10 transition hover:bg-accent hover:shadow-xl"
      aria-label="Send feedback"
    >
      <MessageCircle className="h-4 w-4 text-primary" />
      Feedback
    </button>
  );
}
