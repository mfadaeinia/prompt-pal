import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Loader2 } from "lucide-react";
import { submitFeedback } from "@/lib/feedback.functions";
import { track } from "@/lib/analytics";

type Step = "ask" | "detail" | "again" | "done";

export function FeedbackWidget({
  videoId,
  sessionId,
  triggerReason,
  onDismiss,
}: {
  videoId: string | null;
  sessionId: string;
  triggerReason: string;
  onDismiss: () => void;
}) {
  const submit = useServerFn(submitFeedback);
  const [step, setStep] = useState<Step>("ask");
  const [sentiment, setSentiment] = useState<"positive" | "negative" | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function pickSentiment(s: "positive" | "negative") {
    setSentiment(s);
    track(s === "positive" ? "feedback_positive" : "feedback_negative", {
      video_id: videoId,
      trigger_reason: triggerReason,
    });
    setStep("detail");
  }

  async function submitDetailAndNext() {
    setStep("again");
  }

  async function finish(again: "definitely" | "maybe" | "probably_not") {
    if (!sentiment) return;
    setSubmitting(true);
    track("would_use_again", { choice: again, video_id: videoId });
    try {
      await submit({
        data: {
          sessionId,
          videoId,
          sentiment,
          usefulText: text.trim() || null,
          wouldUseAgain: again,
          triggerReason,
        },
      });
      track("feedback_submitted", {
        sentiment,
        would_use_again: again,
        has_text: !!text.trim(),
        video_id: videoId,
      });
    } catch {}
    setStep("done");
    setTimeout(onDismiss, 1800);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-5 shadow-2xl ring-1 ring-primary/10 animate-in slide-in-from-bottom-4">
      <button
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-accent"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      {step === "ask" && (
        <>
          <p className="pr-6 text-sm font-semibold text-foreground">
            Quick question: was this useful?
          </p>
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
          <p className="pr-6 text-sm font-semibold text-foreground">
            {sentiment === "positive"
              ? "What did you find most useful?"
              : "What was confusing or missing?"}
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Optional — a few words help a lot."
            className="mt-3 text-sm"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={submitDetailAndNext}>
              Skip
            </Button>
            <Button size="sm" onClick={submitDetailAndNext}>
              Next
            </Button>
          </div>
        </>
      )}

      {step === "again" && (
        <>
          <p className="pr-6 text-sm font-semibold text-foreground">
            Would you use this again?
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
          {submitting && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </p>
          )}
        </>
      )}

      {step === "done" && (
        <p className="text-sm font-medium text-foreground">
          🙏 Thanks! Your feedback helps shape Clario.
        </p>
      )}
    </div>
  );
}
