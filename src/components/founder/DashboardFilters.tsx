import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  listCohorts,
  startNewCohort,
  listAcquisitionSources,
  type ReleaseCohort,
  type AnalyticsFilter,
  type CohortScope,
  type TimeRange,
} from "@/lib/founder-cohorts.functions";

export type DashboardFilterValue = {
  scope: CohortScope;
  range: TimeRange;
  source: string | null;
};

export const DEFAULT_FILTER: DashboardFilterValue = {
  scope: { kind: "current" },
  range: { kind: "cohort" },
  source: null,
};

export function toAnalyticsFilter(v: DashboardFilterValue): AnalyticsFilter {
  return { scope: v.scope, range: v.range, source: v.source };
}

export function DashboardFilters({
  value,
  onChange,
}: {
  value: DashboardFilterValue;
  onChange: (v: DashboardFilterValue) => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listCohorts);
  const srcFn = useServerFn(listAcquisitionSources);
  const startFn = useServerFn(startNewCohort);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cohortsQ = useQuery({
    queryKey: ["release-cohorts"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });
  const srcQ = useQuery({
    queryKey: ["acquisition-sources"],
    queryFn: () => srcFn(),
    refetchInterval: 120_000,
  });

  const cohorts: ReleaseCohort[] = cohortsQ.data ?? [];
  const active = cohorts.find((c) => c.is_active) ?? null;

  const scopeKey = useMemo(() => {
    const s = value.scope;
    if (s.kind === "specific") return `c:${s.cohortId}`;
    return `k:${s.kind}`;
  }, [value.scope]);

  const setScope = (key: string) => {
    if (key.startsWith("c:")) {
      onChange({ ...value, scope: { kind: "specific", cohortId: key.slice(2) } });
    } else {
      const kind = key.slice(2) as CohortScope["kind"];
      if (kind === "specific") return;
      onChange({ ...value, scope: { kind } as CohortScope });
    }
  };

  const setRange = (kind: TimeRange["kind"]) => {
    if (kind === "custom") return; // not exposed here yet
    onChange({ ...value, range: { kind } as TimeRange });
  };

  async function submitNewCohort(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      await startFn({ data: { name: name.trim(), description: desc.trim() || null } });
      setDialogOpen(false);
      setName("");
      setDesc("");
      qc.invalidateQueries(); // refresh everything
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Cohort">
          <select
            value={scopeKey}
            onChange={(e) => setScope(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="k:current">⭐ Current Release{active ? ` (${active.name})` : ""}</option>
            <option value="k:since_last">Since Last Release</option>
            <option value="k:previous">Previous Release</option>
            <option value="k:all">All Time</option>
            <optgroup label="Specific cohort">
              {cohorts.map((c) => (
                <option key={c.id} value={`c:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        <Field label="Range">
          <select
            value={value.range.kind}
            onChange={(e) => setRange(e.target.value as any)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="cohort">Cohort window</option>
            <option value="last_7d">Last 7 days</option>
            <option value="last_30d">Last 30 days</option>
          </select>
        </Field>
        <Field label="Source">
          <select
            value={value.source ?? "all"}
            onChange={(e) =>
              onChange({ ...value, source: e.target.value === "all" ? null : e.target.value })
            }
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="all">All sources</option>
            {(srcQ.data ?? []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <div className="ml-auto">
          <button
            onClick={() => setDialogOpen(true)}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + Start New Release Cohort
          </button>
        </div>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitNewCohort}
            className="w-full max-w-md space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
          >
            <h3 className="text-base font-semibold text-slate-900">Start new release cohort</h3>
            <p className="text-xs text-slate-500">
              The currently active cohort will be closed. Every new session and event from this
              moment will be tagged with the new cohort. Historical data is not modified.
            </p>
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="v0.13 – Onboarding rev"
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Description (optional)</span>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                placeholder="What changed in this release?"
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || name.trim().length === 0}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? "Starting…" : "Start cohort"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </div>
  );
}
