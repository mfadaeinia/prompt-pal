import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getFounderMetrics, type FounderMetrics } from "@/lib/founder-metrics.functions";
import {
  getLibraryMetrics,
  getSentenceClickDebug,
  type LibraryMetrics,
  type SentenceClickDebug,
} from "@/lib/library-events.functions";
import {
  getTranscriptQualityMetrics,
  type TranscriptQualityMetrics,
} from "@/lib/transcript-reports.functions";
import {
  getTesterCohort,
  type TesterCohortMetrics,
  type TesterRow,
} from "@/lib/tester-events.functions";
import { clearTranscriptCacheForVideo } from "@/lib/transcript.functions";
import {
  getTranscriptReviewQueue,
  getTranscriptReviewDetail,
  setTranscriptTruthLabel,
  getTranscriptAccuracyMetrics,
  type ReviewQueueItem,
  type ReviewDetail,
  type AccuracyMetrics,
  type TruthLabel,
} from "@/lib/transcript-review.functions";
import { clearBenchmarkTranscriptCache } from "@/lib/transcript.functions";
import { traceTranscriptPipeline, type PipelineTrace } from "@/lib/transcript-trace.functions";
import { BenchmarkSection } from "@/components/BenchmarkSection";
import { verifyFounderPassword } from "@/lib/founder-auth.functions";
import {
  getUserRetentionCohort,
  type UserRetentionCohort,
  type UserRetentionRow,
} from "@/lib/user-retention.functions";
import {
  DashboardFilters,
  DEFAULT_FILTER,
  toAnalyticsFilter,
  type DashboardFilterValue,
} from "@/components/founder/DashboardFilters";
import { ReleaseAnalyticsBlock } from "@/components/founder/ReleaseAnalyticsBlock";
import { ReconciliationPanel } from "@/components/founder/ReconciliationPanel";


export const Route = createFileRoute("/founder")({
  head: () => ({ meta: [{ title: "Founder Dashboard" }, { name: "robots", content: "noindex" }] }),
  ssr: false,
  component: () => <FounderGate Page={FounderPage} />,
  errorComponent: ({ error }) => (
    <div className="p-6 text-red-600">Error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

const AUTH_KEY = "founder-auth-v1";

export function FounderGate({ Page = FounderPage }: { Page?: React.ComponentType } = {}) {
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
  if (authed) return <Page />;

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

type FounderTab =
  | "release"
  | "overview"
  | "users"
  | "funnel"
  | "cohort"
  | "health"
  | "feedback"
  | "engineering";

const TABS: Array<{ id: FounderTab; label: string }> = [
  { id: "release", label: "Release ⭐" },
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "funnel", label: "Activation Funnel" },
  { id: "cohort", label: "User Test Cohort" },
  { id: "health", label: "Product Health" },
  { id: "feedback", label: "Feedback" },
  { id: "engineering", label: "Engineering" },
];


export function FounderDebugPage() {
  const fetcher = useServerFn(getFounderMetrics);
  const libFetcher = useServerFn(getLibraryMetrics);
  const clickDebugFetcher = useServerFn(getSentenceClickDebug);
  const txFetcher = useServerFn(getTranscriptQualityMetrics);
  const cohortFetcher = useServerFn(getTesterCohort);
  const retentionFetcher = useServerFn(getUserRetentionCohort);
  const [tab, setTab] = useState<FounderTab>("release");
  const [filter, setFilter] = useState<DashboardFilterValue>(DEFAULT_FILTER);
  const analyticsFilter = useMemo(() => toAnalyticsFilter(filter), [filter]);

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
  const clickDebugQ = useQuery({
    queryKey: ["sentence-click-debug"],
    queryFn: () => clickDebugFetcher(),
    refetchInterval: 30_000,
  });
  const txQ = useQuery({
    queryKey: ["transcript-quality-metrics"],
    queryFn: () => txFetcher(),
    refetchInterval: 30_000,
  });
  const cohortQ = useQuery({
    queryKey: ["tester-cohort"],
    queryFn: () => cohortFetcher(),
    refetchInterval: 30_000,
  });
  const retentionQ = useQuery({
    queryKey: ["user-retention"],
    queryFn: () => retentionFetcher(),
    refetchInterval: 60_000,
  });

  const refreshAll = () => {
    refetch();
    libQ.refetch();
    clickDebugQ.refetch();
    txQ.refetch();
    cohortQ.refetch();
    retentionQ.refetch();
  };


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
            onClick={refreshAll}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          >
            {isFetching || libQ.isFetching || txQ.isFetching || cohortQ.isFetching
              ? "Refreshing…"
              : "Refresh"}
          </button>
        </header>

        <DashboardFilters value={filter} onChange={setFilter} />
        <ReconciliationPanel filter={analyticsFilter} />

        <nav className="flex flex-wrap gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
                (tab === t.id
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-900")
              }
            >
              {t.label}
            </button>
          ))}
        </nav>

        {isLoading && <p>Loading…</p>}
        {error && <p className="text-red-600">{(error as Error).message}</p>}

        {tab === "release" && <ReleaseAnalyticsBlock filter={analyticsFilter} />}

        {tab === "overview" && data && (
          <>
            <ReleaseAnalyticsBlock filter={analyticsFilter} />
            <div className="mt-6 border-t border-slate-200 pt-6">
              <p className="mb-3 text-[11px] uppercase tracking-wide text-slate-400">
                Lifetime metrics (unfiltered)
              </p>
              <OverviewSection
                m={data}
                lib={libQ.data}
                tx={txQ.data}
                cohort={cohortQ.data}
                retention={retentionQ.data}
              />
            </div>
          </>
        )}
        {tab === "users" && (
          <UserRetentionSection q={retentionQ.data} loading={retentionQ.isLoading} />
        )}
        {tab === "funnel" && data && (
          <>
            <ReleaseAnalyticsBlock filter={analyticsFilter} />
            <div className="mt-6 border-t border-slate-200 pt-6">
              <p className="mb-3 text-[11px] uppercase tracking-wide text-slate-400">
                Lifetime funnel (unfiltered)
              </p>
              <FunnelSection
                m={data}
                lib={libQ.data}
                tx={txQ.data}
                cohort={cohortQ.data}
                retention={retentionQ.data}
              />
            </div>
          </>
        )}

        {tab === "cohort" && cohortQ.data && <TesterCohortSection m={cohortQ.data} />}
        {tab === "health" && <ProductHealthSection tx={txQ.data} />}
        {tab === "feedback" && data && <FeedbackTab m={data} />}
        {tab === "engineering" && (
          <div className="space-y-6">
            <AsrProbeSection />
            <PipelineTraceSection />
            <TranscriptCacheTools />
            <TranscriptTruthSection />
            <BenchmarkSection />
            {data && <Dashboard m={data} />}
            {libQ.data && <LibrarySection m={libQ.data} debug={clickDebugQ.data} />}
            {txQ.data && <TranscriptQualitySection m={txQ.data} />}
          </div>
        )}
      </div>
    </div>
  );
}



function OverviewSection({
  m,
  lib,
  tx,
  cohort,
  retention,
}: {
  m: FounderMetrics;
  lib?: LibraryMetrics;
  tx?: TranscriptQualityMetrics;
  cohort?: TesterCohortMetrics;
  retention?: UserRetentionCohort;
}) {
  const f = m.funnel;
  const activatedUsers = retention?.totals.activated ?? 0;
  const returningUsers = retention?.totals.returning ?? 0;
  const totalSignups = retention?.totals.new_users ?? 0;
  const videosProcessed = tx?.totalVideos ?? m.video.totalSessions;
  const fc = m.firstClick;
  const firstClickPct = Math.round((fc.rate ?? 0) * 1000) / 10;
  const noClickPct = Math.round((fc.watchedNoClickPct ?? 0) * 1000) / 10;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader
          title="Discoverability (primary)"
          subtitle="Are users who watch the video actually finding the click-a-sentence feature?"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <BigKpi
            label="First Click Rate"
            unit="session"
            value={`${firstClickPct}%`}
            tooltip={`Unique sessions with ≥1 sentence click ÷ unique sessions that watched ≥30s. ${fc.clickedSessions} / ${fc.watched30s}.`}
          />
          <BigKpi
            label="Watched, Never Clicked"
            unit="session"
            value={fc.watchedNoClick}
            tooltip={`Sessions that watched ≥30s but never clicked a sentence. ${noClickPct}% of sessions that crossed the 30s mark.`}
          />
          <BigKpi
            label="Watched 30s+"
            unit="session"
            value={fc.watched30s}
            tooltip="Denominator for First Click Rate."
          />
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="Session Metrics"
          subtitle="One row per browser session. Anonymous and authed users included."
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <BigKpi
            label="Visitors"
            unit="session"
            value={f.visitors}
            tooltip="Unique sessions that arrived on the site (one page_views row, plus any historical sessions known from downstream events)."
          />
          <BigKpi
            label="Video Opened"
            unit="session"
            value={f.videoOpened}
            tooltip="Unique sessions that loaded a video page. Does NOT mean they watched it."
          />
          <BigKpi
            label="Engaged Sessions"
            unit="session"
            value={f.clickedSentence}
            tooltip="A session where the user clicked at least one subtitle sentence. First moment a user experiences NativeFlow's core value."
          />
          <BigKpi
            label="Saved Sessions"
            unit="session"
            value={f.savedSomething}
            tooltip="Unique sessions that saved at least one expression or video."
          />
        </div>
      </div>


      <div className="space-y-3">
        <SectionHeader
          title="User Metrics"
          subtitle="Authenticated users only. One row per auth.users record."
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <BigKpi
            label="Total Signups"
            unit="user"
            value={totalSignups}
            tooltip="Total authenticated users that have ever signed up."
          />
          <BigKpi
            label="Activated Users"
            unit="user"
            value={activatedUsers}
            tooltip="A registered user with at least one session that watched ≥30s of a video AND clicked ≥1 subtitle sentence."
          />
          <BigKpi
            label="Returning Users"
            unit="user"
            value={returningUsers}
            tooltip="Authenticated users last seen ≥1 day after signup."
          />
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="Content Metrics"
          subtitle="Raw counts of recorded items (rows in the database)."
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <BigKpi
            label="Sentence Clicks"
            unit="row"
            value={m.transcriptClicks}
            tooltip="Total sentence_clicked events recorded in library_events (not deduplicated by session)."
          />
          <BigKpi
            label="Words Saved"
            unit="row"
            value={lib?.totalSaves ?? 0}
            tooltip="Total rows in saved_expressions across all users and sessions."
          />
          <BigKpi
            label="Videos Processed"
            unit="row"
            value={videosProcessed}
            tooltip="Distinct videos processed (from transcript pipeline)."
          />
          <BigKpi
            label="Feedback Received"
            unit="row"
            value={m.feedbackCount}
            tooltip="Total feedback submissions across all users."
          />
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="Session Quality"
          subtitle="Average behavior across recorded video sessions."
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <BigKpi
            label="Average Session"
            unit="session"
            value={fmtDur(m.video.avgDurationSeconds)}
            tooltip="Mean of duration_seconds across all video_sessions rows."
          />
          <BigKpi
            label="Sessions ≥60s"
            unit="session"
            value={m.video.sessionsOver60s}
            tooltip="Video sessions whose duration_seconds > 60."
          />
          <BigKpi
            label="Sessions ≥5min"
            unit="session"
            value={m.video.sessionsOver5min}
            tooltip="Video sessions whose duration_seconds > 300."
          />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <p className="text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}

function FunnelSection({
  m,
  retention,
}: {
  m: FounderMetrics;
  lib?: LibraryMetrics;
  tx?: TranscriptQualityMetrics;
  cohort?: TesterCohortMetrics;
  retention?: UserRetentionCohort;
}) {
  const f = m.funnel;
  const sessionStages: Array<{
    label: string;
    value: number;
    tooltip: string;
  }> = [
    {
      label: "Visitors",
      value: f.visitors,
      tooltip: "Unique sessions that arrived on the site (page_views row, or any downstream data).",
    },
    {
      label: "Video Opened",
      value: f.videoOpened,
      tooltip: "Unique sessions that loaded a video page (video_sessions row created).",
    },
    {
      label: "Watched 30s+",
      value: f.watched30s,
      tooltip: "Unique sessions whose max video duration_seconds ≥ 30.",
    },
    {
      label: "Clicked Sentence",
      value: f.clickedSentence,
      tooltip: "Unique sessions with ≥1 deliberate sentence_clicked event (auto-explanations excluded).",
    },
    {
      label: "Saved Something",
      value: f.savedSomething,
      tooltip: "Unique sessions that saved an expression or a video.",
    },
  ];
  const returningUsers = retention?.totals.returning ?? 0;
  const activatedUsers = retention?.totals.activated ?? 0;

  const drops = sessionStages.slice(1).map((s, i) => {
    const prev = sessionStages[i].value;
    const invalid = s.value > prev;
    const continuePct = prev > 0 && !invalid ? Math.round((s.value / prev) * 100) : null;
    const dropPct = continuePct === null ? null : 100 - continuePct;
    return { ...s, continuePct, dropPct, invalid };
  });
  const validDrops = drops.filter((d) => d.dropPct !== null);
  const worstIdx = validDrops.length
    ? drops.indexOf(
        validDrops.reduce((w, d) => ((d.dropPct ?? 0) > (w.dropPct ?? 0) ? d : w)),
      )
    : -1;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Activation Funnel"
        subtitle={`Session-based funnel. Every step counts unique session_ids — not users, not rows. Cohort: ${f.cohortLabel}.`}
      />
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <FunnelRow
            label={sessionStages[0].label}
            unit="session"
            value={sessionStages[0].value}
            pct={100}
            tooltip={sessionStages[0].tooltip}
          />
          {drops.map((s, i) => {
            const isWorst = i === worstIdx && (s.dropPct ?? 0) > 0;
            return (
              <div key={s.label}>
                <div
                  className={
                    "ml-4 text-xs " +
                    (s.invalid
                      ? "text-amber-600 font-semibold"
                      : isWorst
                        ? "text-red-600 font-semibold"
                        : "text-slate-400")
                  }
                >
                  {s.invalid ? (
                    <>↓ data error — step exceeds previous step</>
                  ) : (
                    <>
                      ↓ {s.continuePct}% continue ({s.dropPct}% drop-off)
                      {isWorst && " ← biggest drop-off"}
                    </>
                  )}
                </div>
                <FunnelRow
                  label={s.label}
                  unit="session"
                  value={s.value}
                  pct={s.continuePct ?? 0}
                  highlight={isWorst}
                  tooltip={s.tooltip}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
        <SectionHeader
          title="User Metrics (separate cohort)"
          subtitle="Authenticated users only. Not comparable to the session funnel above."
        />
        <FunnelRow
          label="Activated Users"
          unit="user"
          value={activatedUsers}
          pct={100}
          tooltip="A registered user with at least one session that watched ≥30s of a video AND clicked ≥1 subtitle sentence."
        />
        <FunnelRow
          label="Returning Users"
          unit="user"
          value={returningUsers}
          pct={100}
          tooltip="Authenticated users last seen ≥1 day after signup."
        />
      </div>

      <DiscoveryFunnel m={m} />
    </div>
  );
}

function DiscoveryFunnel({ m }: { m: FounderMetrics }) {
  const d = m.discovery;
  const awaitingData = d.transcriptSeen === 0;
  const stages: Array<{ label: string; value: number; tooltip: string; awaiting?: boolean }> = [
    { label: "Video Opened", value: d.videoOpened, tooltip: "Sessions that loaded a video page." },
    { label: "Watched 30s+", value: d.watched30s, tooltip: "Sessions whose max duration ≥30s." },
    {
      label: "Transcript Seen",
      value: d.transcriptSeen,
      tooltip: "Sessions whose transcript scrolled into the viewport (transcript_seen event).",
      awaiting: awaitingData,
    },
    {
      label: "Hovered Sentence",
      value: d.hoveredSentence,
      tooltip: "Desktop sessions that hovered any sentence (sentence_hovered event). Mobile sessions cannot register hover.",
      awaiting: awaitingData,
    },
    {
      label: "Clicked Sentence",
      value: d.clickedSentence,
      tooltip: "Sessions with ≥1 deliberate sentence_clicked event.",
    },
    {
      label: "Saved Something",
      value: d.savedSomething,
      tooltip: "Sessions that saved an expression or video.",
    },
  ];
  const drops = stages.slice(1).map((s, i) => {
    const prev = stages[i];
    const prevVal = prev.value;
    const invalid = prev.awaiting || (s.awaiting ?? false);
    const continuePct = !invalid && prevVal > 0 ? Math.round((s.value / prevVal) * 100) : null;
    return { ...s, continuePct, dropPct: continuePct === null ? null : 100 - continuePct, invalid };
  });
  return (
    <div className="space-y-3">
      <SectionHeader
        title="Discovery Funnel"
        subtitle="Where do users drop off before discovering the click-a-sentence feature?"
      />
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-2">
        <FunnelRow
          label={stages[0].label}
          unit="session"
          value={stages[0].value}
          pct={100}
          tooltip={stages[0].tooltip}
        />
        {drops.map((s) => (
          <div key={s.label}>
            <div className="ml-4 text-xs text-slate-400">
              {s.invalid ? (
                <span className="text-amber-600">↓ awaiting data</span>
              ) : (
                <>
                  ↓ {s.continuePct}% continue ({s.dropPct}% drop-off)
                </>
              )}
            </div>
            <FunnelRow
              label={s.label}
              unit="session"
              value={s.value}
              pct={s.continuePct ?? 0}
              tooltip={s.tooltip}
              awaiting={s.awaiting}
            />
          </div>
        ))}
      </div>
    </div>
  );
}


function FunnelRow({
  label,
  unit,
  value,
  pct,
  highlight,
  tooltip,
  awaiting,
}: {
  label: string;
  unit?: "session" | "user" | "row";
  value: number;
  pct: number;
  highlight?: boolean;
  tooltip?: string;
  awaiting?: boolean;
}) {
  return (
    <div className="flex items-center gap-3" title={tooltip}>
      <div className="w-48 text-sm font-medium text-slate-800 flex items-center gap-1.5">
        <span>{label}</span>
        {unit && <UnitBadge unit={unit} />}
      </div>
      <div className="text-xl font-bold tabular-nums text-slate-400 w-16">
        {awaiting ? "—" : value}
      </div>
      <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={"h-full " + (highlight ? "bg-red-500" : awaiting ? "bg-slate-200" : "bg-slate-900")}
          style={{ width: awaiting ? "2%" : `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

function UnitBadge({ unit }: { unit: "session" | "user" | "row" }) {
  const color =
    unit === "session"
      ? "bg-blue-100 text-blue-700"
      : unit === "user"
        ? "bg-violet-100 text-violet-700"
        : "bg-slate-200 text-slate-700";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${color}`}>
      {unit}
    </span>
  );
}

function ProductHealthSection({ tx }: { tx?: TranscriptQualityMetrics }) {
  if (!tx) return <p className="text-sm text-slate-500">Loading health metrics…</p>;
  const transcriptSuccess = 100 - Math.round(tx.limitedModePct ?? 0);
  const learningMode = tx.fullLearningPct;
  const explanation = tx.explanationEnabledPct;
  const translation = 100 - Math.round(tx.limitedModePct ?? 0);
  const reliability = Math.round(
    (transcriptSuccess + learningMode + explanation + translation) / 4,
  );

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Product Health
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <HealthCard label="Transcript Success" value={transcriptSuccess} />
        <HealthCard label="Learning Mode Success" value={learningMode} />
        <HealthCard label="Explanation Success" value={explanation} />
        <HealthCard label="Translation Success" value={translation} />
        <HealthCard label="Reliability Score" value={reliability} bold />
      </div>
    </div>
  );
}

function HealthCard({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  const tier =
    value >= 85
      ? { dot: "bg-emerald-500", text: "text-emerald-700", word: "Healthy" }
      : value >= 60
      ? { dot: "bg-amber-500", text: "text-amber-700", word: "Watch" }
      : { dot: "bg-red-500", text: "text-red-700", word: "Critical" };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${tier.dot}`} />
        <div className="text-xs text-slate-500">{label}</div>
      </div>
      <div className={"mt-2 " + (bold ? "text-3xl" : "text-2xl") + " font-bold text-slate-900"}>
        {value}%
      </div>
      <div className={"mt-0.5 text-xs font-medium " + tier.text}>{tier.word}</div>
    </div>
  );
}

function FeedbackTab({ m }: { m: FounderMetrics }) {
  const featureRequests = m.feedback.recent.filter((r) =>
    (r.feedback_text ?? "").toLowerCase().match(/\b(would love|wish|feature|please add|could you|can you add|request)\b/),
  ).length;
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Recent Feedback
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigKpi label="Positive 👍" value={m.feedback.positive} />
        <BigKpi label="Negative 👎" value={m.feedback.negative} />
        <BigKpi label="Feature Requests" value={featureRequests} hint="keyword match" />
        <BigKpi label="Total Feedback" value={m.feedbackCount} />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Most Recent Comments
        </div>
        <ul className="space-y-3">
          {m.feedback.recent.length === 0 && (
            <li className="text-sm text-slate-400">No feedback yet.</li>
          )}
          {m.feedback.recent.map((r, i) => (
            <li key={i} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span
                  className={
                    "rounded px-1.5 py-0.5 font-medium " +
                    (r.feedback_type === "positive"
                      ? "bg-emerald-100 text-emerald-700"
                      : r.feedback_type === "negative"
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-100 text-slate-600")
                  }
                >
                  {r.feedback_type}
                </span>
                <span>{new Date(r.created_at).toLocaleString()}</span>
                {r.would_use_again && (
                  <span className="text-slate-400">· would use: {r.would_use_again}</span>
                )}
              </div>
              <div className="mt-1 text-sm text-slate-800">
                {r.feedback_text?.trim() || <span className="text-slate-400">(no comment)</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function UserRetentionSection({
  q,
  loading,
}: {
  q: UserRetentionCohort | undefined;
  loading: boolean;
}) {
  const [sortKey, setSortKey] = useState<
    | "created_at"
    | "last_seen_at"
    | "videos_opened"
    | "videos_watched_30s"
    | "sentence_clicks"
    | "expressions_saved"
    | "total_watch_seconds"
  >("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState<"all" | "activated" | "returning">("all");

  if (loading && !q) return <p className="text-sm text-slate-500">Loading user retention…</p>;
  if (!q) return <p className="text-sm text-slate-500">No data.</p>;

  const t = q.totals;
  const activationPct = Math.round(t.activation_rate * 100);

  let rows: UserRetentionRow[] = q.users;
  if (filter === "activated") rows = rows.filter((r) => r.activated);
  if (filter === "returning") rows = rows.filter((r) => r.returning);
  rows = [...rows].sort((a, b) => {
    const av = a[sortKey] as string | number;
    const bv = b[sortKey] as string | number;
    if (av === bv) return 0;
    const cmp = av > bv ? 1 : -1;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const setSort = (k: typeof sortKey) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };
  const arrow = (k: typeof sortKey) =>
    sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="space-y-4">
      <SectionHeader
        title="User Retention"
        subtitle="Authenticated users only. Activation = ≥1 session with ≥30s watched AND ≥1 sentence click."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <BigKpi
          label="Total Signups"
          unit="user"
          value={t.new_users}
          tooltip="Total authenticated users that have ever signed up."
        />
        <BigKpi
          label="Activated"
          unit="user"
          value={t.activated}
          tooltip="A registered user with at least one session that watched ≥30s of a video AND clicked ≥1 subtitle sentence."
        />
        <BigKpi
          label="Activation Rate"
          unit="user"
          value={`${activationPct}%`}
          tooltip="Activated Users ÷ Total Signups."
        />
        <BigKpi
          label="Weekly Active"
          unit="user"
          value={t.weekly_active}
          tooltip="Users last seen ≤7 days ago."
        />
        <BigKpi
          label="Returning"
          unit="user"
          value={t.returning}
          tooltip="Users last seen ≥1 day after signup."
        />
        <BigKpi
          label="7-Day Retention"
          unit="user"
          value={t.returned_7d}
          tooltip="Users still active 7+ days after signup."
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">Filter:</span>
        {(["all", "activated", "returning"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "rounded-full border px-3 py-1 transition-colors " +
              (filter === f
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
            }
          >
            {f === "all" ? "All users" : f === "activated" ? "Activated only" : "Returning"}
          </button>
        ))}
        <span className="ml-auto text-slate-400">{rows.length} users</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Email</th>
              <th className="px-2 py-2 font-semibold">
                <button onClick={() => setSort("created_at")}>Created{arrow("created_at")}</button>
              </th>
              <th className="px-2 py-2 font-semibold">
                <button onClick={() => setSort("last_seen_at")}>Last Seen{arrow("last_seen_at")}</button>
              </th>
              <th className="px-2 py-2 font-semibold text-right" title="Distinct videos opened.">
                <button onClick={() => setSort("videos_opened")}>Vid Opened{arrow("videos_opened")}</button>
              </th>
              <th className="px-2 py-2 font-semibold text-right" title="Sessions that watched ≥30s of a video.">
                <button onClick={() => setSort("videos_watched_30s")}>Watched 30s+{arrow("videos_watched_30s")}</button>
              </th>
              <th className="px-2 py-2 font-semibold text-right">
                <button onClick={() => setSort("sentence_clicks")}>Clicks{arrow("sentence_clicks")}</button>
              </th>
              <th className="px-2 py-2 font-semibold text-right">
                <button onClick={() => setSort("expressions_saved")}>Saved{arrow("expressions_saved")}</button>
              </th>
              <th className="px-2 py-2 font-semibold text-right" title="Sum of longest watched duration per session.">
                <button onClick={() => setSort("total_watch_seconds")}>Duration{arrow("total_watch_seconds")}</button>
              </th>
              <th className="px-2 py-2 font-semibold">Activated</th>
              <th className="px-2 py-2 font-semibold">Returning</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-400">
                  No users match this filter.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const fmt = (s: string) => new Date(s).toLocaleDateString();
              return (
                <tr key={r.user_id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 text-slate-800">
                    {r.email ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">{fmt(r.created_at)}</td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">{fmt(r.last_seen_at)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.videos_opened}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.videos_watched_30s}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.sentence_clicks}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.expressions_saved}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtDur(r.total_watch_seconds)}</td>
                  <td className="px-2 py-1.5">
                    {r.activated ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700">
                        Yes
                      </span>
                    ) : (
                      <span
                        className="text-slate-400"
                        title={`Needs ≥1 session with ≥30s watched AND ≥1 sentence click. ${r.reason_not_activated ?? ""}`}
                      >
                        No <span className="text-[10px] text-slate-400">— {r.reason_not_activated}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {r.returning ? (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        Yes
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">
        All counts are per-user aggregates across their sessions. Sentence click data only
        includes clicks logged after that feature shipped.
      </p>
    </div>
  );
}

function BigKpi({
  label,
  value,
  hint,
  unit,
  tooltip,
}: {
  label: string;
  value: string | number;
  hint?: string;
  unit?: "session" | "user" | "row";
  tooltip?: string;
}) {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      title={tooltip}
    >
      <div className="flex items-center gap-1.5">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        {unit && <UnitBadge unit={unit} />}
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
}


function TranscriptTruthSection() {
  const queueFetcher = useServerFn(getTranscriptReviewQueue);
  const metricsFetcher = useServerFn(getTranscriptAccuracyMetrics);
  const detailFetcher = useServerFn(getTranscriptReviewDetail);
  const labelFn = useServerFn(setTranscriptTruthLabel);
  const purgeOneFn = useServerFn(clearTranscriptCacheForVideo);
  const purgeAllFn = useServerFn(clearBenchmarkTranscriptCache);
  const qc = useQueryClient();

  const [score, setScore] = useState<"all" | "high" | "medium" | "low">("all");
  const [source, setSource] = useState<string>("all");
  const [reviewed, setReviewed] = useState<"all" | "unreviewed" | "reviewed">("unreviewed");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const metricsQ = useQuery({
    queryKey: ["transcript-accuracy"],
    queryFn: () => metricsFetcher(),
    refetchInterval: 60_000,
  });
  const queueQ = useQuery({
    queryKey: ["transcript-review-queue", score, source, reviewed],
    queryFn: () => queueFetcher({ data: { score, source, reviewed, limit: 100 } }),
  });
  const detailQ = useQuery({
    queryKey: ["transcript-review-detail", openId],
    queryFn: () => detailFetcher({ data: { resultId: openId! } }),
    enabled: !!openId,
  });

  const m = metricsQ.data;
  const sourcesFromMetrics = m?.bySource.map((s) => s.source) ?? [];

  useEffect(() => {
    if (openId && typeof document !== "undefined") {
      const el = document.getElementById("transcript-review-detail-panel");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [openId]);

  async function submitLabel(label: TruthLabel) {
    if (!openId) {
      setLabelError("No row selected. Click Review on a row first.");
      return;
    }
    setSaving(true);
    setLabelError(null);
    try {
      console.log("[transcript-review] saving label", { resultId: openId, label });
      await labelFn({ data: { resultId: openId, label, notes: notes || undefined } });
      setLastSaved(`Saved "${label}" at ${new Date().toLocaleTimeString()}`);
      setNotes("");
      setOpenId(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["transcript-accuracy"] }),
        qc.invalidateQueries({ queryKey: ["transcript-review-queue"] }),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[transcript-review] save failed", err);
      setLabelError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Transcript Truth Validation
      </h2>

      {/* KPI row */}
      {m && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Transcript Accuracy"
            value={`${m.accuracyPct}%`}
            hint={`${m.accurateCount} / ${m.totalReviewed} reviewed`}
          />
          <Stat
            label="Generation Success"
            value={`${m.latestRun.generationSuccessPct}%`}
            hint="latest run"
          />
          <Stat
            label="Quality Score (high)"
            value={`${m.latestRun.qualityScorePct}%`}
            hint="latest run"
          />
          <Stat
            label="Accuracy in latest run"
            value={`${m.latestRun.accuracyPct}%`}
            hint={`${m.latestRun.reviewedInRun} reviewed`}
          />
        </div>
      )}

      {/* Source accuracy table */}
      {m && m.bySource.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Source Accuracy
          </div>
          <table className="min-w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="px-2 py-1">Source</th>
                <th className="px-2 py-1">Reviewed</th>
                <th className="px-2 py-1">Accurate</th>
                <th className="px-2 py-1">Mostly</th>
                <th className="px-2 py-1">Incorrect</th>
                <th className="px-2 py-1">Accuracy %</th>
              </tr>
            </thead>
            <tbody>
              {m.bySource.map((s) => (
                <tr key={s.source} className="border-t border-slate-100">
                  <td className="px-2 py-1 font-mono">{s.source}</td>
                  <td className="px-2 py-1">{s.reviewed}</td>
                  <td className="px-2 py-1 text-green-600">{s.accurate}</td>
                  <td className="px-2 py-1 text-amber-600">{s.mostly_accurate}</td>
                  <td className="px-2 py-1 text-red-600">{s.incorrect}</td>
                  <td className="px-2 py-1 font-medium">{s.accuracy_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Insights */}
      {m && m.insights.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Insights
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
            {m.insights.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Review Queue */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Review Queue
          </div>
          <Select label="Score" value={score} onChange={(v) => setScore(v as any)}
            options={[["all","All"],["high","High"],["medium","Medium"],["low","Low"]]} />
          <Select label="Source" value={source} onChange={setSource}
            options={[["all","All"], ...sourcesFromMetrics.map((s) => [s, s] as [string,string])]} />
          <Select label="Reviewed" value={reviewed} onChange={(v) => setReviewed(v as any)}
            options={[["unreviewed","Unreviewed"],["reviewed","Reviewed"],["all","All"]]} />
          <button
            onClick={() => queueQ.refetch()}
            className="ml-auto rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-100"
          >
            {queueQ.isFetching ? "…" : "Refresh"}
          </button>
          <button
            onClick={async () => {
              if (!confirm("Purge cached transcripts for ALL benchmark videos? Next run will refetch from source.")) return;
              try {
                const res = await purgeAllFn();
                alert(`Purged ${res.removed} cache rows.`);
                qc.invalidateQueries({ queryKey: ["transcript-review-queue"] });
              } catch (e) {
                alert("Purge failed: " + (e instanceof Error ? e.message : String(e)));
              }
            }}
            className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
          >
            Purge benchmark cache
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="px-2 py-1">When</th>
                <th className="px-2 py-1">Video</th>
                <th className="px-2 py-1">Source</th>
                <th className="px-2 py-1">Cache row</th>
                <th className="px-2 py-1">Cache age</th>
                <th className="px-2 py-1">Quality</th>
                <th className="px-2 py-1">Bucket</th>
                <th className="px-2 py-1">Preview</th>
                <th className="px-2 py-1">Label</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {(queueQ.data ?? []).map((r: ReviewQueueItem) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-1 text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-2 py-1">
                    {r.video_url ? (
                      <a href={r.video_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        {r.video_title ?? r.video_id}
                      </a>
                    ) : (
                      r.video_title ?? r.video_id
                    )}
                    <div className="font-mono text-[10px] text-slate-400">{r.video_id}</div>
                  </td>
                  <td className="px-2 py-1 font-mono">
                    {r.transcript_source ?? "—"}
                    {r.cache_provider && <div className="text-[10px] text-slate-400">cache:{r.cache_provider}/{r.cache_language ?? "?"}</div>}
                  </td>
                  <td className="px-2 py-1 font-mono text-[10px] text-slate-500">{r.cache_row_id ? r.cache_row_id.slice(0, 8) : "—"}</td>
                  <td className="px-2 py-1 text-[10px] text-slate-500">{r.cache_updated_at ? new Date(r.cache_updated_at).toLocaleString() : "—"}</td>
                  <td className={"px-2 py-1 font-medium " + qualityColor(r.quality_rating)}>{r.quality_rating}</td>
                  <td className="px-2 py-1">{r.sampling_bucket ?? "—"}</td>
                  <td className="max-w-md px-2 py-1 text-slate-600">
                    {r.transcript_preview ? r.transcript_preview.slice(0, 120) + (r.transcript_preview.length > 120 ? "…" : "") : "—"}
                  </td>
                  <td className="px-2 py-1">{truthBadge(r.transcript_truth_label)}</td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    <button
                      onClick={() => { setOpenId(r.id === openId ? null : r.id); setNotes(""); }}
                      className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white hover:bg-slate-700"
                    >
                      {openId === r.id ? "Close" : "Review"}
                    </button>
                    <button
                      onClick={async () => {
                        if (!r.video_id) return;
                        if (!confirm(`Purge cache for ${r.video_id}?`)) return;
                        try {
                          const res = await purgeOneFn({ data: { videoId: r.video_id } });
                          alert(`Removed ${res.removed} row(s).`);
                          qc.invalidateQueries({ queryKey: ["transcript-review-queue"] });
                        } catch (e) {
                          alert("Purge failed: " + (e instanceof Error ? e.message : String(e)));
                        }
                      }}
                      className="ml-1 rounded-md border border-red-300 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Purge
                    </button>
                  </td>
                </tr>
              ))}
              {(queueQ.data ?? []).length === 0 && (
                <tr><td className="px-2 py-3 text-slate-400" colSpan={10}>No videos match the filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {openId && (
          <div id="transcript-review-detail-panel" className="mt-4 rounded-md border border-slate-300 bg-slate-50 p-4">
            {detailQ.isLoading && <p className="text-xs text-slate-500">Loading transcript…</p>}
            {detailQ.error && (
              <p className="text-xs text-red-600">Failed to load detail: {(detailQ.error as Error).message}</p>
            )}
            {labelError && (
              <p className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">Save failed: {labelError}</p>
            )}
            {detailQ.data && <ReviewDetailPanel
              d={detailQ.data}
              notes={notes}
              setNotes={setNotes}
              saving={saving}
              onLabel={submitLabel}
            />}
          </div>
        )}
        {lastSaved && !openId && (
          <p className="mt-2 text-xs text-green-700">{lastSaved}</p>
        )}
      </div>
    </section>
  );
}

function ReviewDetailPanel({
  d, notes, setNotes, saving, onLabel,
}: {
  d: ReviewDetail;
  notes: string;
  setNotes: (s: string) => void;
  saving: boolean;
  onLabel: (l: TruthLabel) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold">{d.video_title ?? d.video_id}</div>
        {d.video_url && (
          <a href={d.video_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
            {d.video_url}
          </a>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <KV k="Source" v={d.transcript_source ?? "—"} />
        <KV k="Quality" v={d.quality_rating} />
        <KV k="Sentences" v={String(d.sentence_count)} />
        <KV k="Words" v={String(d.transcript_word_count)} />
        <KV k="Avg len" v={d.avg_sentence_length.toFixed(1)} />
        <KV k="Coverage" v={`${d.coverage_percent}%`} />
        <KV k="Translation" v={d.translation_success ? "✓" : "—"} />
        <KV k="Failure" v={d.failure_code ?? "—"} />
      </div>
      <div className="rounded border border-slate-200 bg-white p-2 text-xs">
        <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Cache provenance</div>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          <KV k="Cache row id" v={d.cache_row_id ?? "—"} />
          <KV k="Cache key" v={d.cache_key ?? "—"} />
          <KV k="Cache provider" v={d.cache_provider ?? "—"} />
          <KV k="Cache language" v={d.cache_language ?? "—"} />
          <KV k="Cache created" v={d.cache_created_at ? new Date(d.cache_created_at).toLocaleString() : "—"} />
          <KV k="Cache updated" v={d.cache_updated_at ? new Date(d.cache_updated_at).toLocaleString() : "—"} />
          <KV k="Validation status" v={d.cache_validation_status} />
        </div>
      </div>
      {d.transcript_preview && (
        <div>
          <div className="text-[10px] font-semibold uppercase text-slate-500">First 200 chars</div>
          <div className="rounded border border-slate-200 bg-white p-2 text-xs">{d.transcript_preview}</div>
        </div>
      )}
      <div>
        <div className="text-[10px] font-semibold uppercase text-slate-500">Full transcript</div>
        <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded border border-slate-200 bg-white p-2 text-xs leading-relaxed">
          {d.transcript_text ?? "(no transcript text captured for this row)"}
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional review notes…"
        className="w-full rounded-md border border-slate-300 p-2 text-xs"
        rows={2}
      />
      <div className="flex flex-wrap gap-2">
        <button disabled={saving} onClick={() => onLabel("accurate")}
          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
          ✓ Accurate
        </button>
        <button disabled={saving} onClick={() => onLabel("mostly_accurate")}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50">
          △ Mostly Accurate
        </button>
        <button disabled={saving} onClick={() => onLabel("incorrect")}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
          ✗ Incorrect
        </button>
        <button disabled={saving} onClick={() => onLabel("not_reviewed")}
          className="ml-auto rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50">
          Reset
        </button>
      </div>
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-slate-600">
      <span>{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-2 py-1">
      <div className="text-[10px] uppercase text-slate-400">{k}</div>
      <div className="font-medium text-slate-800">{v}</div>
    </div>
  );
}

function truthBadge(label: TruthLabel) {
  const map: Record<TruthLabel, { text: string; cls: string }> = {
    accurate: { text: "✓ Accurate", cls: "bg-green-100 text-green-700" },
    mostly_accurate: { text: "△ Mostly", cls: "bg-amber-100 text-amber-700" },
    incorrect: { text: "✗ Incorrect", cls: "bg-red-100 text-red-700" },
    not_reviewed: { text: "— Unreviewed", cls: "bg-slate-100 text-slate-500" },
  };
  const b = map[label];
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${b.cls}`}>{b.text}</span>;
}

function TranscriptCacheTools() {
  const clearFn = useServerFn(clearTranscriptCacheForVideo);
  const [videoId, setVideoId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function parseVideoId(s: string): string | null {
    const trimmed = s.trim();
    const m = trimmed.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    );
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    return null;
  }

  async function onClear() {
    const id = parseVideoId(videoId);
    if (!id) {
      setResult({ ok: false, message: "Enter a YouTube URL or 11-char video ID." });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await clearFn({ data: { videoId: id } });
      setResult({ ok: true, message: `Removed ${res.removed} cached row(s) for ${id}.` });
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Failed to clear cache." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Transcript Cache Tools
      </h2>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs text-slate-500">
          Removes every cached transcript row for this video (all providers / languages).
          The next load will re-fetch from YouTube captions or Transcribr.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            placeholder="YouTube URL or video ID"
            className="min-w-[260px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
          <button
            onClick={onClear}
            disabled={busy || !videoId.trim()}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Clearing…" : "Clear transcript cache"}
          </button>
        </div>
        {result && (
          <p className={`mt-2 text-xs ${result.ok ? "text-green-600" : "text-red-600"}`}>
            {result.message}
          </p>
        )}
      </div>
    </section>
  );
}

type SortKey =
  | "tester_id"
  | "email"
  | "first_seen_at"
  | "last_seen_at"
  | "total_sessions"
  | "videos_loaded"
  | "sentence_clicks"
  | "expressions_saved"
  | "feedback_submitted_count"
  | "activated"
  | "returned_7d";

function TesterCohortSection({ m }: { m: TesterCohortMetrics }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("first_seen_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? m.testers.filter(
          (t) =>
            (t.email ?? "").toLowerCase().includes(q) ||
            t.tester_id.toLowerCase().includes(q),
        )
      : m.testers.slice();
    const dir = sortDir === "asc" ? 1 : -1;
    base.sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      // Nulls last
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      if (typeof av === "boolean" && typeof bv === "boolean")
        return (Number(av) - Number(bv)) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return base;
  }, [m.testers, search, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  function sortIndicator(k: SortKey) {
    if (sortKey !== k) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function downloadCsv() {
    const headers = [
      "tester_id",
      "email",
      "first_seen_at",
      "last_seen_at",
      "total_sessions",
      "videos_loaded",
      "sentence_clicks",
      "expressions_saved",
      "feedback_submitted_count",
      "activated",
      "returned_7d",
    ];
    const escape = (v: string | number | boolean | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(","),
      ...filtered.map((t: TesterRow) =>
        [
          t.tester_id,
          t.email,
          t.first_seen_at,
          t.last_seen_at,
          t.total_sessions,
          t.videos_loaded,
          t.sentence_clicks,
          t.expressions_saved,
          t.feedback_submitted_count,
          t.activated,
          t.returned_7d,
        ]
          .map(escape)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tester-cohort-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const headerBtn = (label: string, k: SortKey) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="font-medium text-slate-500 hover:text-slate-900"
    >
      {label}
      {sortIndicator(k)}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          User Test Cohort
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email or tester…"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />
          <button
            onClick={downloadCsv}
            disabled={filtered.length === 0}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Testers invited" value={m.invited} />
        <Stat
          label="Testers activated"
          value={m.totals.activated}
          hint="≥1 video AND ≥3 sentence clicks"
        />
        <Stat label="Loaded ≥1 video" value={m.totals.loadedVideo} />
        <Stat label="Clicked ≥3 sentences" value={m.totals.clickedThreeSentences} />
        <Stat label="Returned in 7 days" value={m.totals.returned7d} hint="day 6–10 after first seen" />
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-2 py-2">{headerBtn("Tester", "tester_id")}</th>
              <th className="px-2 py-2">{headerBtn("Email", "email")}</th>
              <th className="px-2 py-2">{headerBtn("First seen", "first_seen_at")}</th>
              <th className="px-2 py-2">{headerBtn("Last seen", "last_seen_at")}</th>
              <th className="px-2 py-2">{headerBtn("Sessions", "total_sessions")}</th>
              <th className="px-2 py-2">{headerBtn("Videos", "videos_loaded")}</th>
              <th className="px-2 py-2">{headerBtn("Clicks", "sentence_clicks")}</th>
              <th className="px-2 py-2">{headerBtn("Saved", "expressions_saved")}</th>
              <th className="px-2 py-2">{headerBtn("Feedback", "feedback_submitted_count")}</th>
              <th className="px-2 py-2">{headerBtn("Activated", "activated")}</th>
              <th className="px-2 py-2">{headerBtn("Returned 7d", "returned_7d")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t: TesterRow) => (
              <tr key={t.tester_id} className="border-t border-slate-100">
                <td className="px-2 py-1 font-mono">{t.tester_id}</td>
                <td className="px-2 py-1">
                  {t.email ? (
                    <a
                      href={`mailto:${t.email}`}
                      className="text-slate-700 hover:underline"
                    >
                      {t.email}
                    </a>
                  ) : (
                    <span className="text-slate-400">No email</span>
                  )}
                </td>
                <td className="px-2 py-1 text-slate-500">
                  {new Date(t.first_seen_at).toLocaleString()}
                </td>
                <td className="px-2 py-1 text-slate-500">
                  {new Date(t.last_seen_at).toLocaleString()}
                </td>
                <td className="px-2 py-1">{t.total_sessions}</td>
                <td className="px-2 py-1">{t.videos_loaded}</td>
                <td className="px-2 py-1">{t.sentence_clicks}</td>
                <td className="px-2 py-1">{t.expressions_saved}</td>
                <td className="px-2 py-1">{t.feedback_submitted_count}</td>
                <td className="px-2 py-1">{t.activated ? "✓" : "—"}</td>
                <td className="px-2 py-1">{t.returned_7d ? "✓" : "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="px-2 py-3 text-slate-400" colSpan={11}>
                  {m.testers.length === 0 ? (
                    <>
                      No tester activity yet. Share links like{" "}
                      <code>/?ref=tester_001</code> to start tracking.
                    </>
                  ) : (
                    <>No testers match your search.</>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LibrarySection({ m, debug }: { m: LibraryMetrics; debug?: SentenceClickDebug }) {
  return (
    <div className="space-y-4">
      <Section title="My Library">
        <Stat label="Users who saved" value={m.uniqueSavers} hint="unique browser sessions" />
        <Stat label="Saved expressions" value={m.totalSaves} />
        <Stat label="Library opens" value={m.libraryOpens} />
        <Stat label="Watch-again clicks" value={m.watchAgainClicks} />
        <Stat label="Saved-item revisits" value={m.savedItemRevisits} />
        <Stat label="Sentence clicks (all-time)" value={m.sentenceClicks} />
        <Stat
          label="Sessions w/ sentence click"
          value={m.uniqueSentenceClickSessions}
          hint="unique browser sessions"
        />
      </Section>
      <Section title="Sentence Click Debug">
        {debug ? (
          <>
            <Stat label="Clicks today" value={debug.clicksToday} />
            <Stat label="Clicks last 7d" value={debug.clicksLast7d} />
            <Stat
              label="Unique sessions (7d)"
              value={debug.uniqueSessionsLast7d}
            />
          </>
        ) : (
          <p className="text-xs text-slate-500">Loading…</p>
        )}
      </Section>
      {debug && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Top clicked videos (last 7d)
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-2 py-2">Video ID</th>
                  <th className="px-2 py-2">Clicks</th>
                  <th className="px-2 py-2">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {debug.topVideos.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-2 py-2 text-slate-400">
                      No sentence clicks in last 7 days.
                    </td>
                  </tr>
                )}
                {debug.topVideos.map((v, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-1 font-mono">{v.video_id ?? "(unknown)"}</td>
                    <td className="px-2 py-1">{v.clicks}</td>
                    <td className="px-2 py-1">{v.sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {debug && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recent sentence_clicked events
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-2 py-2">When</th>
                  <th className="px-2 py-2">Session</th>
                  <th className="px-2 py-2">Video</th>
                  <th className="px-2 py-2">User</th>
                </tr>
              </thead>
              <tbody>
                {debug.recent.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-2 text-slate-400">
                      No recent events.
                    </td>
                  </tr>
                )}
                {debug.recent.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-1 text-slate-500">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-2 py-1 font-mono">{r.session_id?.slice(0, 8) ?? "—"}</td>
                    <td className="px-2 py-1 font-mono">{r.video_id ?? "—"}</td>
                    <td className="px-2 py-1 font-mono">{r.user_id?.slice(0, 8) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
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

function PipelineTraceSection() {
  const traceFn = useServerFn(traceTranscriptPipeline);
  const [url, setUrl] = useState("");
  const [lang, setLang] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<PipelineTrace | null>(null);

  async function run() {
    if (!url.trim()) return;
    setRunning(true);
    setError(null);
    setTrace(null);
    try {
      const res = await traceFn({
        data: { url: url.trim(), expectedLanguage: lang.trim() || undefined },
      });
      setTrace(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Single-Video Pipeline Trace
      </h2>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-xs text-slate-500">
          Read-only walkthrough of every layer in <code>fetchTranscript</code>. Does
          not write to cache or benchmark tables. Order: validate → cache →
          YouTube captions → Transcribr → Gemini (disabled).
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="YouTube URL or 11-char video id"
            className="flex-1 min-w-[280px] rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            placeholder="Expected language (e.g. nl, en) — optional"
            className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={run}
            disabled={running || !url.trim()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {running ? "Tracing…" : "Run trace"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {trace && <TraceResult trace={trace} />}
      </div>
    </section>
  );
}

function TraceResult({ trace }: { trace: PipelineTrace }) {
  return (
    <div className="space-y-3 text-sm">
      <TraceBlock title="Input">
        <Row k="raw_url" v={trace.input.rawUrl} />
        <Row k="video_id" v={trace.input.videoId ?? "(none)"} />
        <Row k="video_url" v={trace.input.videoUrl} />
        <Row k="expected_language" v={trace.input.expectedLanguage ?? "_any_"} />
      </TraceBlock>

      <TraceBlock title="Step 1 — Validate YouTube video (oEmbed)" status={trace.step1_validate.status}>
        <Row k="attempted" v={String(trace.step1_validate.attempted)} />
        <Row k="http_status" v={trace.step1_validate.httpStatus ?? "—"} />
        <Row k="title" v={trace.step1_validate.title ?? "—"} />
        <Row k="author" v={trace.step1_validate.author ?? "—"} />
        <Row k="error" v={trace.step1_validate.errorMessage ?? "—"} />
      </TraceBlock>

      <TraceBlock title="Step 2 — Cache lookup" status={trace.step2_cache.status}>
        <Row k="attempted" v={String(trace.step2_cache.attempted)} />
        <Row k="cache_hit" v={String(trace.step2_cache.hit)} />
        <Row k="rows_for_video_id" v={trace.step2_cache.rowsForVideo} />
        <Row k="cache_row_id" v={trace.step2_cache.cacheRowId ?? "—"} />
        <Row k="cache_key" v={trace.step2_cache.cacheKey ?? "—"} />
        <Row k="provider" v={trace.step2_cache.provider ?? "—"} />
        <Row k="requested_language" v={trace.step2_cache.requestedLanguage ?? "—"} />
        <Row k="provider_response_language" v={trace.step2_cache.providerResponseLanguage ?? "—"} />
        <Row k="stored_language" v={trace.step2_cache.language ?? "—"} />
        <Row k="text_detected_language" v={trace.step2_cache.textDetectedLanguage ?? "—"} />
        <Row k="text_detection_confidence" v={trace.step2_cache.textDetectionConfidence ?? "—"} />
        <Row k="language_mismatch_detected" v={String(trace.step2_cache.languageMismatchDetected)} />
        <Row k="accepted_via_any_shortcut" v={String(trace.step2_cache.acceptedViaAnyShortcut)} />
        <Row k="final_language_used" v={trace.step2_cache.finalLanguageUsed ?? "—"} />
        <Row k="length_chars" v={trace.step2_cache.transcriptLengthChars ?? "—"} />
        <Row k="updated_at" v={trace.step2_cache.updatedAt ?? "—"} />
        {!trace.step2_cache.hit && <Row k="miss_reason" v={trace.step2_cache.missReason ?? "—"} />}
      </TraceBlock>

      <TraceBlock title="Step 3 — YouTube captions" status={trace.step3_youtube.status}>
        <Row k="attempted" v={String(trace.step3_youtube.attempted)} />
        <Row k="language_used" v={trace.step3_youtube.languageUsed ?? "—"} />
        <Row k="chunks" v={trace.step3_youtube.chunkCount} />
        <Row k="transcript_chars" v={trace.step3_youtube.transcriptChars} />
        <Row k="error" v={trace.step3_youtube.errorMessage ?? "—"} />
        {trace.step3_youtube.attempts.length > 0 && (
          <div className="mt-2">
            <div className="text-xs font-medium text-slate-500 mb-1">Per-language attempts</div>
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr><th className="text-left">lang</th><th className="text-left">ok</th><th className="text-left">chunks</th><th className="text-left">error</th></tr>
              </thead>
              <tbody>
                {trace.step3_youtube.attempts.map((a, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1 pr-2">{a.lang}</td>
                    <td className="py-1 pr-2">{a.ok ? "✓" : "✗"}</td>
                    <td className="py-1 pr-2">{a.chunks}</td>
                    <td className="py-1 pr-2 text-slate-600">{a.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TraceBlock>

      <TraceBlock title="Step 4 — Transcribr fallback" status={trace.step4_transcribr.status}>
        <Row k="attempted" v={String(trace.step4_transcribr.attempted)} />
        <Row k="request_sent" v={String(trace.step4_transcribr.requestSent)} />
        <Row k="http_status" v={trace.step4_transcribr.httpStatus ?? "—"} />
        <Row k="language_returned" v={trace.step4_transcribr.languageReturned ?? "—"} />
        <Row k="raw_segments" v={trace.step4_transcribr.rawSegments} />
        <Row k="kept_segments" v={trace.step4_transcribr.keptSegments} />
        <Row k="transcript_chars" v={trace.step4_transcribr.transcriptChars} />
        <Row k="skip_reason" v={trace.step4_transcribr.skipReason ?? "—"} />
        <Row k="error" v={trace.step4_transcribr.errorMessage ?? "—"} />
        {trace.step4_transcribr.responseBodySnippet && (
          <div className="mt-2">
            <div className="text-xs font-medium text-slate-500 mb-1">Response body (truncated)</div>
            <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700">{trace.step4_transcribr.responseBodySnippet}</pre>
          </div>
        )}
      </TraceBlock>

      <TraceBlock title="Step 5 — Gemini ASR fallback" status={"disabled" as any}>
        <Row k="attempted" v={String(trace.step5_gemini.attempted)} />
        <Row k="status" v="DISABLED" />
        <Row k="reason" v={trace.step5_gemini.reason} />
      </TraceBlock>

      <TraceBlock title="Step 6 — OpenAI Whisper fallback" status={trace.step6_openai_whisper.status}>
        <Row k="attempted" v={String(trace.step6_openai_whisper.attempted)} />
        <Row k="skip_reason" v={trace.step6_openai_whisper.skipReason ?? "—"} />
        <Row k="audio_extractor_provider" v={trace.step6_openai_whisper.audioExtractorProvider ?? "—"} />
        <Row k="audio_url_found" v={String(trace.step6_openai_whisper.audioUrlFound)} />
        <Row k="audio_extraction_failed" v={String(trace.step6_openai_whisper.audioExtractionFailed)} />
        <Row k="openai_invoked" v={String(trace.step6_openai_whisper.openaiInvoked)} />
        <Row k="openai_http_status" v={trace.step6_openai_whisper.openaiHttpStatus ?? "—"} />
        <Row k="transcript_chars" v={trace.step6_openai_whisper.transcriptChars} />
        <Row k="segments_count" v={trace.step6_openai_whisper.segmentsCount} />
        <Row k="language" v={trace.step6_openai_whisper.language ?? "—"} />
        <Row k="model" v={trace.step6_openai_whisper.model ?? "—"} />
        <Row k="failure_reason" v={trace.step6_openai_whisper.failureReason ?? "—"} />
        <Row k="extractor_failure_reason" v={trace.step6_openai_whisper.extractorFailureReason ?? "—"} />
      </TraceBlock>


      <TraceBlock title="Final result" status={trace.final.transcriptGenerated ? "ok" : "fail"}>
        <Row k="transcript_generated" v={String(trace.final.transcriptGenerated)} />
        <Row k="final_source" v={trace.final.finalSource} />
        <Row k="failure_code" v={trace.final.failureCode ?? "—"} />
        <Row k="failure_reason" v={trace.final.failureReason ?? "—"} />
      </TraceBlock>
    </div>
  );
}

function TraceBlock({ title, status, children }: { title: string; status?: "ok" | "fail" | "skipped" | "disabled"; children: ReactNode }) {
  const color =
    status === "ok" ? "bg-emerald-100 text-emerald-800"
    : status === "fail" ? "bg-red-100 text-red-800"
    : status === "disabled" ? "bg-amber-100 text-amber-800"
    : status === "skipped" ? "bg-slate-100 text-slate-600"
    : "bg-slate-100 text-slate-600";
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        {status && <span className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase ${color}`}>{status}</span>}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-2 text-xs">
      <div className="text-slate-500">{k}</div>
      <div className="text-slate-800 break-all">{v}</div>
    </div>
  );
}

const CURATED_VIDEOS = [
  {
    label: "Lubach — De Avondshow (demo)",
    url: "https://www.youtube.com/watch?v=ucsSnoeTPMc",
    lang: "nl",
  },
  {
    label: "TED — Simon Sinek (English)",
    url: "https://www.youtube.com/watch?v=qp0HIF3SfI4",
    lang: "en",
  },
  {
    label: "TED — Tim Urban (English)",
    url: "https://www.youtube.com/watch?v=7QTRptXgBfk",
    lang: "en",
  },
  {
    label: "VPRO Tegenlicht — AI & werk (Dutch)",
    url: "https://www.youtube.com/watch?v=3S1jH71V3pA",
    lang: "nl",
  },
  {
    label: "Lubach — Kijkersvragen AI-editie (Dutch)",
    url: "https://www.youtube.com/watch?v=0h0X8L15e1w",
    lang: "nl",
  },
];

function AsrProbeSection() {
  const [selectedIdx, setSelectedIdx] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [seconds, setSeconds] = useState(90);
  const [runningFull, setRunningFull] = useState(false);
  const [runningProgressive, setRunningProgressive] = useState(false);
  const [runningStream, setRunningStream] = useState(false);
  const [fullResult, setFullResult] = useState<any>(null);
  const [progressiveResult, setProgressiveResult] = useState<any>(null);
  const [streamEvents, setStreamEvents] = useState<Array<{ event: string; data: any; tMs: number }>>([]);
  const [streamMetrics, setStreamMetrics] = useState<{
    time_to_first_clickable_sentence_ms?: number;
    time_to_full_transcript_ms?: number;
    partial_transcript_ready_ms?: number;
    full_transcript_ready_ms?: number;
    completedChunks?: number;
    totalChunks?: number;
    totalSentences?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runStream() {
    if (!url) return;
    setRunningStream(true);
    setError(null);
    setStreamEvents([]);
    setStreamMetrics({});
    const t0 = performance.now();
    try {
      const res = await fetch(
        `/api/public/transcript-stream?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(lang || "nl")}&chunk=90`,
      );
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const block of events) {
          const evLine = block.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
          if (!evLine || !dataLine) continue;
          const ev = evLine.slice(6).trim();
          let data: any = null;
          try { data = JSON.parse(dataLine.slice(5).trim()); } catch { /* ignore */ }
          const tMs = Math.round(performance.now() - t0);
          setStreamEvents((prev) => [...prev, {
            event: ev,
            tMs,
            data: ev === "chunk" ? { ...data, sentences: `[${data?.sentences?.length ?? 0} sentences]` } : data,
          }]);
          if (ev === "chunk") {
            setStreamMetrics((m) => ({
              ...(m ?? {}),
              completedChunks: data?.completedChunks,
              totalChunks: data?.totalChunks,
              totalSentences: data?.sentences?.length,
              ...(data?.time_to_first_clickable_sentence_ms != null
                ? {
                    time_to_first_clickable_sentence_ms: data.time_to_first_clickable_sentence_ms,
                    partial_transcript_ready_ms: tMs,
                  }
                : {}),
            }));
          } else if (ev === "complete") {
            setStreamMetrics((m) => ({
              ...(m ?? {}),
              time_to_full_transcript_ms: data?.time_to_full_transcript_ms,
              full_transcript_ready_ms: tMs,
              totalSentences: data?.totalSentences,
            }));
          } else if (ev === "error") {
            setError(data?.message || "stream error");
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunningStream(false);
    }
  }

  const chosen = CURATED_VIDEOS[Number(selectedIdx)];
  const url = chosen?.url || customUrl.trim();
  const lang = chosen?.lang || "";

  async function runFull() {
    if (!url) return;
    setRunningFull(true);
    setError(null);
    setFullResult(null);
    try {
      const res = await fetch(`/api/public/asr-probe?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(lang)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setFullResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunningFull(false);
    }
  }

  async function runProgressive() {
    if (!url) return;
    setRunningProgressive(true);
    setError(null);
    setProgressiveResult(null);
    try {
      const res = await fetch(
        `/api/public/asr-probe-progressive?url=${encodeURIComponent(url)}&seconds=${seconds}&lang=${encodeURIComponent(lang)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setProgressiveResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunningProgressive(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        🧪 Progressive Transcript Experiment (ASR Probe)
      </h2>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-xs text-slate-500">
          Run the full-audio probe against the progressive (range-limited) probe
          on the same video. Compare latency, segment count, and real timestamps.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            <span>Curated test video</span>
            <select
              value={selectedIdx}
              onChange={(e) => {
                setSelectedIdx(e.target.value);
                if (e.target.value) setCustomUrl("");
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm min-w-[260px]"
            >
              <option value="">— Select or use custom —</option>
              {CURATED_VIDEOS.map((v, i) => (
                <option key={i} value={String(i)}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs text-slate-400 pb-2">or</span>
          <label className="flex flex-col gap-1 text-xs text-slate-600 flex-1 min-w-[200px]">
            <span>Custom URL</span>
            <input
              value={customUrl}
              onChange={(e) => {
                setCustomUrl(e.target.value);
                if (e.target.value) setSelectedIdx("");
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            <span>Progressive seconds</span>
            <input
              type="number"
              min={15}
              max={300}
              value={seconds}
              onChange={(e) => setSeconds(Math.max(15, Math.min(300, Number(e.target.value))))}
              className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runFull}
            disabled={runningFull || !url}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {runningFull ? "Running full…" : "Run full probe"}
          </button>
          <button
            onClick={runProgressive}
            disabled={runningProgressive || !url}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {runningProgressive ? "Running progressive…" : "Run progressive probe"}
          </button>
          <button
            onClick={async () => {
              if (!url) return;
              await runFull();
              await runProgressive();
            }}
            disabled={runningFull || runningProgressive || runningStream || !url}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {runningFull || runningProgressive ? "Running both…" : "Run both"}
          </button>
          <button
            onClick={runStream}
            disabled={runningStream || !url}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {runningStream ? "Streaming…" : "▶ Run progressive STREAM (SSE)"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {(fullResult || progressiveResult) && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {fullResult && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Full probe result
                </div>
                <pre className="overflow-x-auto text-[11px] text-slate-700 max-h-96">
                  {JSON.stringify(fullResult, null, 2)}
                </pre>
              </div>
            )}
            {progressiveResult && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Progressive probe result ({seconds}s)
                </div>
                <pre className="overflow-x-auto text-[11px] text-slate-700 max-h-96">
                  {JSON.stringify(progressiveResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
        {(streamEvents.length > 0 || streamMetrics) && (
          <div className="rounded-md border border-indigo-200 bg-indigo-50/40 p-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Progressive STREAM (SSE) — live
            </div>
            {streamMetrics && (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 text-[11px]">
                <Metric label="time_to_first_clickable_sentence" v={streamMetrics.time_to_first_clickable_sentence_ms} unit="ms" />
                <Metric label="partial_transcript_ready" v={streamMetrics.partial_transcript_ready_ms} unit="ms" />
                <Metric label="time_to_full_transcript" v={streamMetrics.time_to_full_transcript_ms} unit="ms" />
                <Metric label="full_transcript_ready" v={streamMetrics.full_transcript_ready_ms} unit="ms" />
                <Metric label="chunks" v={streamMetrics.completedChunks} unit={streamMetrics.totalChunks ? `/ ${streamMetrics.totalChunks}` : ""} />
                <Metric label="sentences" v={streamMetrics.totalSentences} unit="" />
              </div>
            )}
            <pre className="overflow-auto text-[11px] text-slate-700 max-h-80 bg-white rounded p-2 border border-slate-200">
              {streamEvents.map((e, i) =>
                `[${String(e.tMs).padStart(6)}ms] ${e.event}  ${JSON.stringify(e.data)}`
              ).join("\n")}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, v, unit }: { label: string; v: number | undefined; unit: string }) {
  return (
    <div className="rounded border border-indigo-200 bg-white px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-mono text-slate-900">
        {v == null ? "—" : v.toLocaleString()}{unit ? ` ${unit}` : ""}
      </div>
    </div>
  );
}
