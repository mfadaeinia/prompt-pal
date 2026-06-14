import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFounderMetrics, type FounderMetrics } from "@/lib/founder-metrics.functions";
import { getLibraryMetrics, type LibraryMetrics } from "@/lib/library-events.functions";

export const Route = createFileRoute("/founder")({
  head: () => ({ meta: [{ title: "Founder Dashboard" }, { name: "robots", content: "noindex" }] }),
  component: FounderPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-red-600">Error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

function FounderPage() {
  const fetcher = useServerFn(getFounderMetrics);
  const libFetcher = useServerFn(getLibraryMetrics);
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
            }}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          >
            {isFetching || libQ.isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {isLoading && <p>Loading…</p>}
        {error && <p className="text-red-600">{(error as Error).message}</p>}
        {data && <Dashboard m={data} />}
        {libQ.data && <LibrarySection m={libQ.data} />}
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
