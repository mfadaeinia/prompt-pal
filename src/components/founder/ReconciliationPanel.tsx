import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getReconciliationReport,
  type AnalyticsFilter,
  type ReconciliationReason,
} from "@/lib/founder-cohorts.functions";

const REASON_LABEL: Record<ReconciliationReason, string> = {
  included: "Included in dashboard",
  missing_session_id: "Missing session_id",
  missing_release_cohort: "No release cohort assigned",
  cohort_mismatch: "Different release cohort",
  source_mismatch: "Different acquisition source",
  before_since: "Before window start",
  after_until: "After window end",
};

/**
 * Temporary debug panel: reconciles Founder Dashboard visitor counts
 * against the raw page_views stream for the *same* time window the
 * filter selects (with no cohort/source filter applied to the raw count).
 * Remove once the team is confident the aggregation is correct.
 */
export function ReconciliationPanel({ filter }: { filter: AnalyticsFilter }) {
  const fn = useServerFn(getReconciliationReport);
  const q = useQuery({
    queryKey: ["reconciliation-report", JSON.stringify(filter ?? {})],
    queryFn: () => fn({ data: filter }),
    refetchInterval: 60_000,
  });

  if (q.isLoading)
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
        Reconciling…
      </div>
    );
  if (q.error)
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Reconciliation error: {(q.error as Error).message}
      </div>
    );
  if (!q.data) return null;

  const r = q.data;
  const diff = r.raw.distinctSessions - r.dashboard.sessionsIncluded;
  const matched = diff === 0;

  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Reconciliation (debug)
          </div>
          <p className="text-xs text-amber-700">
            Filter: <span className="font-medium">{r.label}</span> · Window:{" "}
            {r.window.since?.slice(0, 16).replace("T", " ")} →{" "}
            {r.window.until?.slice(0, 16).replace("T", " ") ?? "now"}
          </p>
        </div>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
            (matched
              ? "bg-emerald-100 text-emerald-700"
              : "bg-red-100 text-red-700")
          }
        >
          {matched ? "Reconciles ✓" : `Off by ${diff}`}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Raw page_view rows"
          value={r.raw.pageViewRows}
          hint="From analytics stream"
        />
        <Stat
          label="Raw visitors"
          value={r.raw.distinctSessions}
          hint="Distinct session_id in window"
        />
        <Stat
          label="Dashboard visitors"
          value={r.dashboard.sessionsIncluded}
          hint="After cohort + source filter"
        />
        <Stat
          label="Excluded"
          value={r.excluded.total}
          hint="Rows filtered out"
          highlight={r.excluded.total > 0}
        />
      </div>

      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          Exclusion reasons
        </div>
        <table className="mt-1 w-full text-xs">
          <tbody>
            {(Object.keys(r.excluded.reasons) as ReconciliationReason[])
              .filter((k) => k !== "included" && r.excluded.reasons[k] > 0)
              .map((k) => (
                <tr key={k} className="border-t border-amber-200/60">
                  <td className="py-1 text-amber-900">{REASON_LABEL[k]}</td>
                  <td className="py-1 text-right tabular-nums font-semibold text-amber-900">
                    {r.excluded.reasons[k]}
                  </td>
                </tr>
              ))}
            {r.excluded.total === 0 && (
              <tr>
                <td className="py-1 text-amber-700">
                  No rows were excluded — dashboard matches the raw stream.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {r.excluded.samples.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            Sample excluded rows ({r.excluded.samples.length})
          </summary>
          <div className="mt-2 max-h-48 overflow-auto rounded border border-amber-200 bg-white">
            <table className="w-full text-[11px]">
              <thead className="bg-amber-50 text-amber-700">
                <tr>
                  <th className="px-2 py-1 text-left">When</th>
                  <th className="px-2 py-1 text-left">Reason</th>
                  <th className="px-2 py-1 text-left">Cohort</th>
                  <th className="px-2 py-1 text-left">Source</th>
                  <th className="px-2 py-1 text-left">Session</th>
                </tr>
              </thead>
              <tbody>
                {r.excluded.samples.map((s, i) => (
                  <tr key={i} className="border-t border-amber-100">
                    <td className="px-2 py-1 tabular-nums text-slate-700">
                      {s.created_at.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="px-2 py-1 text-amber-800">
                      {REASON_LABEL[s.reason]}
                    </td>
                    <td className="px-2 py-1 font-mono text-[10px] text-slate-500">
                      {s.release_cohort_id?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="px-2 py-1 text-slate-700">
                      {s.acquisition_source ?? "—"}
                    </td>
                    <td className="px-2 py-1 font-mono text-[10px] text-slate-500">
                      {s.session_id?.slice(0, 10) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <p className="mt-3 text-[10px] text-amber-700/80">
        Reconciles raw <code>page_views</code> in the selected window against the
        sessions the dashboard counts after cohort + source filters. Remove this
        panel once the reconciliation has been verified.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: number;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-md border bg-white p-2 " +
        (highlight ? "border-red-300" : "border-amber-200")
      }
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums text-slate-900">{value}</div>
      {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
    </div>
  );
}
