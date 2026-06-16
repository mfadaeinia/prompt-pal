import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getFounderMetrics, type FounderMetrics } from "@/lib/founder-metrics.functions";
import { getLibraryMetrics, type LibraryMetrics } from "@/lib/library-events.functions";
import {
  getTranscriptQualityMetrics,
  type TranscriptQualityMetrics,
} from "@/lib/transcript-reports.functions";
import {
  getTesterCohort,
  type TesterCohortMetrics,
  type TesterRow,
} from "@/lib/tester-events.functions";
import { BenchmarkSection } from "@/components/BenchmarkSection";
import { verifyFounderPassword } from "@/lib/founder-auth.functions";

export const Route = createFileRoute("/founder")({
  head: () => ({ meta: [{ title: "Founder Dashboard" }, { name: "robots", content: "noindex" }] }),
  ssr: false,
  component: FounderGate,
  errorComponent: ({ error }) => (
    <div className="p-6 text-red-600">Error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

const AUTH_KEY = "founder-auth-v1";

function FounderGate() {
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const verify = useServerFn(verifyFounderPassword);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(AUTH_KEY) === "1") {
      setAuthed(true);
    }
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (authed) return <FounderPage />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          setError(null);
          try {
            const res = await verify({ data: { password } });
            if (res.ok) {
              sessionStorage.setItem(AUTH_KEY, "1");
              setAuthed(true);
            } else {
              setError("Incorrect password");
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
          } finally {
            setSubmitting(false);
          }
        }}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Founder access</h1>
          <p className="text-sm text-slate-500">Enter the founder password to continue.</p>
        </div>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting || password.length === 0}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}

function FounderPage() {
  const fetcher = useServerFn(getFounderMetrics);
  const libFetcher = useServerFn(getLibraryMetrics);
  const txFetcher = useServerFn(getTranscriptQualityMetrics);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["founder-metrics"],
    queryFn: () => fetcher(),
    refetchInterval: 30_000,
  });
  const libQ = useQuery({
    queryKey: ["library-metrics"],
    queryFn: () => libFetcher(),
    refetchInterval: 30_000,
  });
  const txQ = useQuery({
    queryKey: ["transcript-quality-metrics"],
    queryFn: () => txFetcher(),
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Founder Dashboard</h1>
            <p className="text-sm text-slate-500">
              Live metrics from the database. Auto-refresh every 30s.
            </p>
          </div>
          <button
            onClick={() => {
              refetch();
              libQ.refetch();
              txQ.refetch();
            }}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          >
            {isFetching || libQ.isFetching || txQ.isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        <BenchmarkSection />
        {isLoading && <p>Loading…</p>}
        {error && <p className="text-red-600">{(error as Error).message}</p>}
        {data && <Dashboard m={data} />}
        {libQ.data && <LibrarySection m={libQ.data} />}
        {txQ.data && <TranscriptQualitySection m={txQ.data} />}
      </div>
    </div>
  );
}

function LibrarySection({ m }: { m: LibraryMetrics }) {
  return (
    <Section title="My Library">
      <Stat label="Users who saved" value={m.uniqueSavers} hint="unique browser sessions" />
      <Stat label="Saved expressions" value={m.totalSaves} />
      <Stat label="Library opens" value={m.libraryOpens} />
      <Stat label="Watch-again clicks" value={m.watchAgainClicks} />
      <Stat label="Saved-item revisits" value={m.savedItemRevisits} />
    </Section>
  );
}

function TranscriptQualitySection({ m }: { m: TranscriptQualityMetrics }) {
  return (
    <div className="space-y-4">
      <Section title="Transcript Quality">
        <Stat label="Total videos processed" value={m.totalVideos} />
        <Stat label="Full learning mode" value={`${m.fullLearningPct}%`} hint="quality = high" />
        <Stat label="Limited mode" value={`${m.limitedModePct}%`} hint="quality = low" />
        <Stat label="Medium quality" value={`${m.mediumPct}%`} />
        <Stat label="Explanations enabled" value={`${m.explanationEnabledPct}%`} />
      </Section>
      <Section title="Transcript Source Mix">
        <Stat label="Cache" value={`${m.sourceBreakdown.cachePct}%`} />
        <Stat label="YouTube captions" value={`${m.sourceBreakdown.youtubePct}%`} />
        <Stat label="Fallback provider" value={`${m.sourceBreakdown.fallbackPct}%`} />
        <Stat label="Manual" value={`${m.sourceBreakdown.manualPct}%`} />
        <Stat label="Avg sentences / video" value={m.avgSentenceCount} />
        <Stat label="Avg words / sentence" value={m.avgSentenceLength} />
      </Section>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent videos
        </h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-2 py-2">When</th>
                <th className="px-2 py-2">Video</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Quality</th>
                <th className="px-2 py-2">Sentences</th>
                <th className="px-2 py-2">Avg len</th>
                <th className="px-2 py-2">Full</th>
                <th className="px-2 py-2">Limited</th>
                <th className="px-2 py-2">Expl.</th>
              </tr>
            </thead>
            <tbody>
              {m.recent.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-2 py-1 text-slate-500">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-2 py-1 font-mono">
                    {r.video_url ? (
                      <a
                        href={r.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {r.video_title ?? r.video_id}
                      </a>
                    ) : (
                      r.video_title ?? r.video_id
                    )}
                  </td>
                  <td className="px-2 py-1">{r.transcript_source}</td>
                  <td className={"px-2 py-1 font-medium " + qualityColor(r.quality_score)}>
                    {r.quality_score}
                  </td>
                  <td className="px-2 py-1">{r.sentence_count}</td>
                  <td className="px-2 py-1">{Number(r.avg_sentence_length).toFixed(1)}</td>
                  <td className="px-2 py-1">{r.full_learning_enabled ? "✓" : "—"}</td>
                  <td className="px-2 py-1">{r.limited_mode_enabled ? "✓" : "—"}</td>
                  <td className="px-2 py-1">
                    {r.explanation_generation_enabled ? "✓" : "—"}
                  </td>
                </tr>
              ))}
              {m.recent.length === 0 && (
                <tr>
                  <td className="px-2 py-3 text-slate-400" colSpan={9}>
                    No processed videos yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function qualityColor(q: string) {
  if (q === "high") return "text-green-600";
  if (q === "medium") return "text-amber-600";
  return "text-red-600";
}

function Dashboard({ m }: { m: FounderMetrics }) {
  return (
    <div className="space-y-6">
      <Section title="Top-line">
        <Stat label="Visitors (unique sessions)" value={m.visitors} />
        <Stat label="Demo Starts" value={m.demoStarts} />
        <Stat label="Transcript Clicks" value={m.transcriptClicks} hint="from feedback reports" />
        <Stat label="Feedback Count" value={m.feedbackCount} />
        <Stat label="Waitlist Count" value={m.waitlistCount} />
      </Section>

      <Section title="Video Sessions">
        <Stat label="Total Sessions" value={m.video.totalSessions} />
        <Stat label="Avg Duration" value={fmtDur(m.video.avgDurationSeconds)} />
        <Stat label="Longest Session" value={fmtDur(m.video.longestDurationSeconds)} />
        <Stat label="Sessions > 60s" value={m.video.sessionsOver60s} />
        <Stat label="Sessions > 5 min" value={m.video.sessionsOver5min} />
      </Section>

      <Section title="Feedback">
        <Stat label="Positive 👍" value={m.feedback.positive} />
        <Stat label="Negative 👎" value={m.feedback.negative} />
        <Stat label="Would use — Definitely" value={m.feedback.wouldUseAgain.definitely} />
        <Stat label="Would use — Maybe" value={m.feedback.wouldUseAgain.maybe} />
        <Stat label="Would use — Probably not" value={m.feedback.wouldUseAgain.probably_not} />
      </Section>

      <Section title="Waitlist">
        <Stat label="Total Signups" value={m.waitlist.total} />
        <Stat
          label="Most Recent"
          value={m.waitlist.mostRecentAt ? new Date(m.waitlist.mostRecentAt).toLocaleString() : "—"}
        />
        <Stat label="Most Recent Email" value={m.waitlist.mostRecentEmail ?? "—"} />
      </Section>

      <p className="text-xs text-slate-500">
        Note: Visitors = unique <code>session_id</code>s seen in video_sessions or user_feedback.
        Transcript-click totals come from feedback submissions only — for full event counts use
        PostHog.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 truncate text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-[10px] text-slate-400">{hint}</div>}
    </div>
  );
}

function fmtDur(s: number) {
  if (!s) return "0s";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
