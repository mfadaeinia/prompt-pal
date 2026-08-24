import type { CoreMetrics } from "@/lib/core-metrics.functions";

/**
 * Single source of truth panel for the corrected measurement foundation.
 * Every number states its UNIT (session / visitor / user) and never mixes them.
 */
function Unit({ unit }: { unit: "session" | "visitor" | "user" }) {
  const color =
    unit === "session"
      ? "bg-blue-100 text-blue-700"
      : unit === "visitor"
        ? "bg-amber-100 text-amber-700"
        : "bg-violet-100 text-violet-700";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${color}`}
    >
      {unit}
    </span>
  );
}

function Step({
  label,
  unit,
  value,
  base,
  tooltip,
  awaiting,
  highlight,
}: {
  label: string;
  unit: "session" | "visitor" | "user";
  value: number;
  base: number;
  tooltip: string;
  awaiting?: boolean;
  highlight?: boolean;
}) {
  const pct = base > 0 ? Math.round((value / base) * 1000) / 10 : 0;
  return (
    <div className="flex items-center gap-3" title={tooltip}>
      <div className="flex w-56 items-center gap-1.5 text-sm font-medium text-slate-800">
        <span>{label}</span>
        <Unit unit={unit} />
      </div>
      <div className="w-14 text-xl font-bold tabular-nums text-slate-800">
        {awaiting ? "—" : value}
      </div>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={
            "h-full " + (awaiting ? "bg-slate-200" : highlight ? "bg-emerald-500" : "bg-slate-900")
          }
          style={{ width: awaiting ? "2%" : `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
      <div className="w-16 text-right text-xs tabular-nums text-slate-500">
        {awaiting ? "awaiting data" : `${pct}%`}
      </div>
    </div>
  );
}

function RetentionCard({
  title,
  unit,
  c,
  note,
}: {
  title: string;
  unit: "visitor" | "user";
  c: CoreMetrics["retention"]["authenticated"];
  note: string;
}) {
  const rate = (r: { returned: number; eligible: number }) =>
    r.eligible === 0 ? "not enough data yet" : `${Math.round((r.returned / r.eligible) * 100)}%`;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <Unit unit={unit} />
      </div>
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Active in period</dt>
          <dd className="font-semibold tabular-nums">{c.active}</dd>
        </div>
        <div className="flex justify-between" title="Meaningful activity on ≥2 distinct UTC days.">
          <dt className="text-slate-500">Returning (≥2 days)</dt>
          <dd className="font-semibold tabular-nums">{c.returning}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Day 1</dt>
          <dd className="tabular-nums">
            {rate(c.d1)}{" "}
            <span className="text-slate-400">
              ({c.d1.returned}/{c.d1.eligible})
            </span>
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Day 2–7</dt>
          <dd className="tabular-nums">
            {rate(c.d7)}{" "}
            <span className="text-slate-400">
              ({c.d7.returned}/{c.d7.eligible})
            </span>
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] leading-snug text-slate-400">{note}</p>
    </div>
  );
}

export function CoreMetricsSection({ c }: { c?: CoreMetrics }) {
  if (!c) return <p className="text-sm text-slate-500">Loading core metrics…</p>;
  const a = c.activation;
  const awaiting = !c.tracking.periodCoversUnifiedTracking;
  const activationRate =
    a.videoStarted > 0 ? Math.round((a.coreActivated / a.videoStarted) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        Unified session tracking started{" "}
        <span
          className="font-medium text-slate-700"
          title={`Exact start: ${c.tracking.unifiedSessionStart}`}
        >
          {formatExact(c.tracking.unifiedSessionStart)}
        </span>
        {" · "}Funnel events since{" "}
        <span
          className="font-medium text-slate-700"
          title={`Exact start: ${c.tracking.funnelEventStart}`}
        >
          {formatExact(c.tracking.funnelEventStart)}
        </span>
        {" · "}Internal excluded: {c.filters.internal === "exclude" ? "yes" : "no"} (
        {c.internalExcluded.users} user{c.internalExcluded.users === 1 ? "" : "s"},{" "}
        {c.internalExcluded.visitors} visitor
        {c.internalExcluded.visitors === 1 ? "" : "s"}, {c.internalExcluded.rows} rows)
        {awaiting && (
          <span className="ml-2 font-medium text-amber-600">
            Selected period starts before {formatExact(c.tracking.unifiedSessionStart)} — sessions
            before that timestamp were logged with a different session identifier, so
            session-scoped steps show “awaiting data”.
          </span>
        )}
      </div>


      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Core Activation</h3>
          <p className="text-sm text-slate-500">
            A session is <strong>core activated</strong> when it watched 30s{" "}
            <em>and</em> requested a subtitle explanation. Saving and accounts are not required.
          </p>
        </div>
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
          <Step
            label="Video started"
            unit="session"
            value={a.videoStarted}
            base={a.videoStarted}
            awaiting={awaiting}
            tooltip="Sessions with a video_started event."
          />
          <Step
            label="Watched ≥30s"
            unit="session"
            value={a.watched30s}
            base={a.videoStarted}
            awaiting={awaiting}
            tooltip="Sessions that also reached 30 seconds of playback."
          />
          <Step
            label="Requested explanation"
            unit="session"
            value={a.explanationRequested}
            base={a.videoStarted}
            awaiting={awaiting}
            tooltip="Sessions that tapped a subtitle to get an explanation."
          />
          <Step
            label="CORE ACTIVATED"
            unit="session"
            value={a.coreActivated}
            base={a.videoStarted}
            awaiting={awaiting}
            highlight
            tooltip="Watched ≥30s AND requested an explanation, same canonical session."
          />
          <Step
            label="Continued after explanation"
            unit="session"
            value={a.continuedAfterExplanation}
            base={a.videoStarted}
            awaiting={awaiting}
            tooltip="Resumed the video after reading an explanation."
          />
          <Step
            label="Started another video"
            unit="session"
            value={a.anotherVideoStarted}
            base={a.videoStarted}
            awaiting={awaiting}
            tooltip="Opened a second video in the same session."
          />
          <p className="pt-1 text-xs text-slate-500">
            Activation rate:{" "}
            <span className="font-semibold text-slate-800">
              {awaiting ? "awaiting data" : `${activationRate}%`}
            </span>{" "}
            of started sessions · {c.acquisition.sessions} sessions / {c.acquisition.visitors}{" "}
            visitors in period
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Retention</h3>
          <p className="text-sm text-slate-500">
            Distinct calendar days (UTC) with meaningful product activity. Account creation never
            counts as a return.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <RetentionCard
            title="Authenticated users"
            unit="user"
            c={c.retention.authenticated}
            note="Keyed by account id."
          />
          <RetentionCard
            title="Anonymous visitors"
            unit="visitor"
            c={c.retention.anonymous}
            note="Keyed by browser/device id — the same person on 3 browsers counts as 3 visitors. No fingerprinting."
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Diagnostic (not activation)</h3>
          <p className="text-sm text-slate-500">
            Useful for debugging discovery, deliberately excluded from the core funnel.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Transcript seen", c.diagnostic.transcriptSeenSessions],
            ["Expression tapped", c.diagnostic.highlightedExpressionSessions],
            ["Sentence clicked", c.diagnostic.sentenceClickedSessions],
            ["Saved something", c.diagnostic.savedSomethingSessions],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                {label as string}
              </div>
              <div className="text-xl font-bold tabular-nums text-slate-800">{value as number}</div>
              <Unit unit="session" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
