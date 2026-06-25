import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getFunnelComparison,
  type AnalyticsFilter,
  type FilteredFunnel,
} from "@/lib/founder-cohorts.functions";

export function ReleaseAnalyticsBlock({ filter }: { filter: AnalyticsFilter }) {
  const fn = useServerFn(getFunnelComparison);
  const q = useQuery({
    queryKey: [
      "funnel-comparison",
      JSON.stringify(filter ?? {}),
    ],
    queryFn: () => fn({ data: filter }),
    refetchInterval: 30_000,
  });

  if (q.isLoading) return <p className="text-sm text-slate-500">Loading release analytics…</p>;
  if (q.error) return <p className="text-sm text-red-600">{(q.error as Error).message}</p>;
  if (!q.data) return null;

  const { current, previous, trends } = q.data;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Release Analytics
          </h2>
          <p className="text-xs text-slate-500">
            Scope:{" "}
            <span className="font-medium text-slate-700">{current.label}</span>
            {previous && (
              <span className="ml-2 text-slate-400">vs. {previous.label}</span>
            )}
          </p>
        </div>
      </div>

      {/* Headline trends */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TrendKpi
          label="Activation Rate"
          unit="%"
          trend={trends.activationRate}
          tooltip="Signups in window that watched ≥30s AND clicked ≥1 sentence within 7 days of signup."
        />
        <TrendKpi
          label="Sentence Click Rate"
          unit="%"
          trend={trends.sentenceClickRate}
          tooltip="Sessions that clicked a sentence ÷ sessions that watched ≥30s."
        />
        <TrendKpi
          label="Save Rate"
          unit="%"
          trend={trends.saveRate}
          tooltip="Sessions that saved ÷ sessions that clicked a sentence."
        />
        <TrendKpi
          label="Signups"
          trend={trends.signups}
          tooltip="Authenticated users with first activity in this window."
        />
      </div>

      {/* Filtered funnel */}
      <FilteredFunnelView current={current} previous={previous} />

      {/* Not activated breakdown */}
      <NotActivatedPanel current={current} previous={previous} />

      {/* Acquisition breakdown */}
      <AcquisitionPanel current={current} />
    </div>
  );
}

// ============================================================
// Funnel
// ============================================================

function FilteredFunnelView({
  current,
  previous,
}: {
  current: FilteredFunnel;
  previous: FilteredFunnel | null;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Funnel
      </div>
      <div className="space-y-1.5">
        {current.stages.map((s, i) => {
          const prev = previous?.stages[i];
          const prevVal = prev?.value ?? 0;
          const deltaPct = prev && prevVal > 0
            ? Math.round(((s.value - prevVal) / prevVal) * 1000) / 10
            : null;
          return (
            <div key={s.label}>
              {s.continuePct !== null && (
                <div className="ml-3 text-[11px] text-slate-400">↓ {s.continuePct}% continue</div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-44 text-sm font-medium text-slate-800">{s.label}</div>
                <div className="w-14 text-right text-xl font-bold tabular-nums text-slate-900">
                  {s.value}
                </div>
                <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-slate-900"
                    style={{
                      width: `${Math.max(2, Math.min(100, s.continuePct ?? 100))}%`,
                    }}
                  />
                </div>
                {previous && (
                  <DeltaPill
                    deltaPct={deltaPct}
                    rawPrev={prevVal}
                    higherIsBetter
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Not activated
// ============================================================

function NotActivatedPanel({
  current,
  previous,
}: {
  current: FilteredFunnel;
  previous: FilteredFunnel | null;
}) {
  const na = current.notActivated;
  const eligible = current.activation.eligibleSignups;
  const totalBlocked = eligible - current.activation.activated;
  const rows: Array<{ label: string; key: keyof FilteredFunnel["notActivated"]; val: number }> = [
    { label: "Never opened a video", key: "never_opened_video", val: na.never_opened_video },
    { label: "Never watched 30s", key: "never_watched_30s", val: na.never_watched_30s },
    { label: "Never clicked a sentence", key: "never_clicked_sentence", val: na.never_clicked_sentence },
    { label: "Clicked but never watched 30s", key: "clicked_but_not_30s", val: na.clicked_but_not_30s },
  ];
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
        Not activated — why?
      </div>
      <p className="mb-3 text-xs text-amber-700">
        Of {eligible} signups in this cohort, {totalBlocked} did NOT activate within 7 days. Where
        did they stop?
      </p>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const pct = eligible ? Math.round((r.val / eligible) * 100) : 0;
          const prevVal = previous?.notActivated[r.key] ?? 0;
          return (
            <div key={r.key} className="flex items-center gap-3">
              <div className="w-56 text-sm text-amber-900">{r.label}</div>
              <div className="w-12 text-right text-base font-bold tabular-nums text-amber-900">
                {r.val}
              </div>
              <div className="w-12 text-xs tabular-nums text-amber-700">{pct}%</div>
              <div className="flex-1 h-2 rounded-full bg-amber-100 overflow-hidden">
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
                />
              </div>
              {previous && <DeltaPill deltaPct={delta(r.val, prevVal)} rawPrev={prevVal} higherIsBetter={false} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function delta(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

// ============================================================
// Acquisition
// ============================================================

function AcquisitionPanel({ current }: { current: FilteredFunnel }) {
  const rows = current.acquisitionBreakdown.slice(0, 12);
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        No acquisition data captured for this cohort yet.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Acquisition Sources
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="text-left font-medium pb-1">Source</th>
            <th className="text-right font-medium pb-1">Visitors</th>
            <th className="text-right font-medium pb-1">Activated</th>
            <th className="text-right font-medium pb-1">Act %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = r.visitors ? Math.round((r.activated / r.visitors) * 100) : 0;
            return (
              <tr key={r.source} className="border-t border-slate-100">
                <td className="py-1.5 text-slate-800">{r.source}</td>
                <td className="py-1.5 text-right tabular-nums">{r.visitors}</td>
                <td className="py-1.5 text-right tabular-nums">{r.activated}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-600">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Trend pill / KPI
// ============================================================

function TrendKpi({
  label,
  trend,
  unit,
  tooltip,
}: {
  label: string;
  trend: { current: number; previous: number; deltaAbs: number; deltaPct: number | null };
  unit?: string;
  tooltip?: string;
}) {
  const positive = trend.deltaAbs > 0;
  const negative = trend.deltaAbs < 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" title={tooltip}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-2xl font-bold tabular-nums text-slate-900">
          {formatNumber(trend.current)}
          {unit && <span className="text-base text-slate-400">{unit}</span>}
        </div>
      </div>
      <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
        <span>
          prev {formatNumber(trend.previous)}
          {unit ?? ""}
        </span>
        {trend.deltaPct !== null && (
          <span
            className={
              "rounded px-1.5 py-0.5 font-semibold " +
              (positive
                ? "bg-emerald-100 text-emerald-700"
                : negative
                  ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-600")
            }
          >
            {positive ? "↑" : negative ? "↓" : "→"} {Math.abs(trend.deltaPct)}%
          </span>
        )}
      </div>
    </div>
  );
}

function DeltaPill({
  deltaPct,
  rawPrev,
  higherIsBetter,
}: {
  deltaPct: number | null;
  rawPrev: number;
  higherIsBetter: boolean;
}) {
  if (deltaPct === null) {
    return <span className="w-20 text-right text-[10px] text-slate-400">prev {rawPrev}</span>;
  }
  const positive = deltaPct > 0;
  const good = higherIsBetter ? positive : !positive && deltaPct !== 0;
  const neutral = deltaPct === 0;
  return (
    <span
      className={
        "w-20 text-right rounded px-1.5 py-0.5 text-[10px] font-semibold " +
        (neutral
          ? "bg-slate-100 text-slate-600"
          : good
            ? "bg-emerald-100 text-emerald-700"
            : "bg-red-100 text-red-700")
      }
      title={`previous: ${rawPrev}`}
    >
      {positive ? "↑" : deltaPct < 0 ? "↓" : "→"} {Math.abs(deltaPct)}%
    </span>
  );
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n * 10) / 10 + "";
}
