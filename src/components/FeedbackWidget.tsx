import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Check, Sparkles } from "lucide-react";
import { submitFeedback } from "@/lib/feedback.functions";
import { track } from "@/lib/analytics";

type Comprehension = "yes" | "sort_of" | "no";
type Workflow = "faster" | "same" | "slower";

export type FeedbackContext = () => {
  sessionId: string;
  videoId: string | null;
  totalSentenceClicks: number;
  uniqueSegmentsClicked: number;
  explanationsOpened: number;
  timeOnPageSeconds: number;
  secondsWatched: number;
  isOwnVideo: boolean;
  targetLanguage: string | null;
  demoStarted: boolean;
  pageUrl: string;
};

type Step = "primary" | "followup" | "text" | "done";

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
  const [step, setStep] = useState<Step>("primary");
  const [comprehension, setComprehension] = useState<Comprehension | null>(null);
  const [followupChoice, setFollowupChoice] = useState<string | null>(null);
  const [text, setText] = useState("");
  const autoDismissRef = useRef<number | null>(null);

  function clearAuto() {
    if (autoDismissRef.current) {
      window.clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }
  }

  function scheduleAutoDismiss(ms = 8000) {
    clearAuto();
    autoDismissRef.current = window.setTimeout(() => {
      setStep("done");
      window.setTimeout(onDismiss, 1500);
    }, ms);
  }

  useEffect(() => () => clearAuto(), []);

  async function persist(partial: {
    comprehensionHelpful: Comprehension;
    vsCurrentWorkflow?: Workflow | null;
    failureReason?: string | null;
    feedbackText?: string | null;
  }) {
    const ctx = getContext();
    try {
      await submit({
        data: {
          sessionId: ctx.sessionId,
          videoId: ctx.videoId,
          comprehensionHelpful: partial.comprehensionHelpful,
          vsCurrentWorkflow: partial.vsCurrentWorkflow ?? null,
          failureReason: partial.failureReason ?? null,
          feedbackText: partial.feedbackText ?? null,
          triggerReason,
          pageUrl: ctx.pageUrl,
          totalSentenceClicks: ctx.totalSentenceClicks,
          uniqueSegmentsClicked: ctx.uniqueSegmentsClicked,
          explanationsOpened: ctx.explanationsOpened,
          timeOnPageSeconds: ctx.timeOnPageSeconds,
          secondsWatched: ctx.secondsWatched,
          isOwnVideo: ctx.isOwnVideo,
          targetLanguage: ctx.targetLanguage,
          demoStarted: ctx.demoStarted,
        },
      });
    } catch (err) {
      console.error("feedback_submit_failed", err);
    }
  }

  async function pickComprehension(c: Comprehension) {
    setComprehension(c);
    const ctx = getContext();
    track("feedback_comprehension", {
      comprehension: c,
      trigger_reason: triggerReason,
      video_id: ctx.videoId,
      is_own_video: ctx.isOwnVideo,
      explanations_opened: ctx.explanationsOpened,
      target_language: ctx.targetLanguage,
    });
    // Save the primary signal immediately so we get the answer even if they bail.
    await persist({ comprehensionHelpful: c });
    setStep("followup");
    scheduleAutoDismiss(8000);
  }

  async function pickFollowup(value: string) {
    clearAuto();
    setFollowupChoice(value);
    if (!comprehension) return;
    track("feedback_followup", {
      comprehension,
      followup: value,
      trigger_reason: triggerReason,
    });
    if (value === "other") {
      setStep("text");
      scheduleAutoDismiss(12000);
      return;
    }
    await persist({
      comprehensionHelpful: comprehension,
      vsCurrentWorkflow: comprehension === "yes" ? (value as Workflow) : null,
      failureReason: comprehension !== "yes" ? value : null,
    });
    setStep("done");
    window.setTimeout(onDismiss, 1500);
  }

  async function submitText() {
    clearAuto();
    if (!comprehension) return;
    track("feedback_text_added", { comprehension, has_text: !!text.trim() });
    await persist({
      comprehensionHelpful: comprehension,
      vsCurrentWorkflow:
        comprehension === "yes" && followupChoice && followupChoice !== "other"
          ? (followupChoice as Workflow)
          : null,
      failureReason:
        comprehension !== "yes" && followupChoice ? followupChoice : null,
      feedbackText: text.trim() || null,
    });
    setStep("done");
    window.setTimeout(onDismiss, 1500);
  }

  const followupOptions =
    comprehension === "yes"
      ? [
          { value: "faster", label: "Much faster" },
          { value: "same", label: "About the same" },
          { value: "slower", label: "Slower" },
        ]
      : comprehension === "sort_of"
        ? [
            { value: "translation", label: "Translation" },
            { value: "grammar", label: "Grammar" },
            { value: "context", label: "More context" },
            { value: "other", label: "Other" },
          ]
        : [
            { value: "wrong_meaning", label: "Wrong meaning" },
            { value: "too_generic", label: "Too generic" },
            { value: "too_slow", label: "Too slow" },
            { value: "other", label: "Other" },
          ];

  const followupQuestion =
    comprehension === "yes"
      ? "Faster than your usual way (subtitles, Google Translate, ChatGPT)?"
      : comprehension === "sort_of"
        ? "What was missing?"
        : "What went wrong?";

  return (
    <div
      role="dialog"
      aria-label="Quick feedback"
      className="fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-border bg-card/95 p-4 shadow-2xl ring-1 ring-primary/10 backdrop-blur-xl animate-in slide-in-from-bottom-4 fade-in"
    >
      <button
        onClick={() => {
          clearAuto();
          track("feedback_dismissed", { step, comprehension });
          onDismiss();
        }}
        className="absolute right-2.5 top-2.5 rounded-full p-1 text-muted-foreground hover:bg-accent"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      {step === "primary" && (
        <>
          <p className="pr-6 text-[13px] font-semibold uppercase tracking-wider text-primary/80">
            Quick pulse · 1 tap
          </p>
          <p className="mt-1.5 pr-6 text-[15px] font-semibold leading-snug text-foreground">
            Did that explanation help you understand the video?
          </p>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <PulseButton onClick={() => pickComprehension("yes")} emoji="👍" label="Yes" />
            <PulseButton onClick={() => pickComprehension("sort_of")} emoji="🤔" label="Sort of" />
            <PulseButton onClick={() => pickComprehension("no")} emoji="👎" label="No" />
          </div>
        </>
      )}

      {step === "followup" && (
        <>
          <p className="pr-6 text-[13px] font-medium text-muted-foreground">
            Thanks — one more tap?
          </p>
          <p className="mt-1 pr-6 text-[14px] font-semibold leading-snug text-foreground">
            {followupQuestion}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {followupOptions.map((o) => (
              <button
                key={o.value}
                onClick={() => pickFollowup(o.value)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5"
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}

      {step === "text" && (
        <>
          <p className="pr-6 text-[14px] font-semibold leading-snug text-foreground">
            Anything else? (optional)
          </p>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 600))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitText();
              }
            }}
            rows={2}
            placeholder="A few words help a lot…"
            className="mt-2 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={submitText}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Send
            </button>
          </div>
        </>
      )}

      {step === "done" && (
        <p className="flex items-center gap-2 pr-6 text-sm font-medium text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
            {comprehension === "yes" ? <Sparkles className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          </span>
          Thanks — this shapes NativeFlow.
        </p>
      )}
    </div>
  );
}

function PulseButton({
  onClick,
  emoji,
  label,
}: {
  onClick: () => void;
  emoji: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-background py-2.5 text-xs font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 active:translate-y-0"
    >
      <span className="text-lg leading-none">{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

export function FeedbackFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-2 text-xs font-medium text-muted-foreground shadow-md ring-1 ring-primary/5 backdrop-blur transition hover:text-foreground hover:shadow-lg"
      aria-label="Send feedback"
    >
      Feedback
    </button>
  );
}
