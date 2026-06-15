import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getLatestBenchmark,
  getDatasetHealth,
  startBenchmarkRun,
  processBenchmarkVideo,
  finalizeBenchmarkRun,
  FAILURE_LABELS,
  ALL_FAILURE_CODES,
  type FailureCode,
  type LatestBenchmark,
  type BenchmarkResultRow,
  type DatasetHealth,
} from "@/lib/benchmark.functions";

const CATEGORIES = ["TED", "Podcast", "Interview", "Educational", "News"];

const TARGETS = {
  transcript: 95,
  sentence: 90,
  translation: 99,
  pipeline: 85,
};

export function BenchmarkSection() {
  const fetcher = useServerFn(getLatestBenchmark);
  const healthFetcher = useServerFn(getDatasetHealth);
  const starter = useServerFn(startBenchmarkRun);
  const processOne = useServerFn(processBenchmarkVideo);
  const finalize = useServerFn(finalizeBenchmarkRun);
  const qc = useQueryClient();
  const [version, setVersion] = useState("");
  const [progress, setProgress] = useState<{ mode: string; done: number; total: number } | null>(null);
  const cancelRef = useRef(false);

  const q = useQuery({
    queryKey: ["benchmark-latest"],
    queryFn: () => fetcher(),
    refetchInterval: 15_000,
  });

  // Lazy-loaded — only triggered by button to avoid hammering YouTube oembed on every refresh
  const healthQ = useQuery({
    queryKey: ["benchmark-health"],
    queryFn: () => healthFetcher(),
    enabled: false,
    staleTime: 5 * 60_000,
  });

  const mut = useMutation({
    mutationFn: async (mode: "quick" | "full") => {
      cancelRef.current = false;
      const { runId, videos } = await starter({
        data: { mode, releaseVersion: version || undefined },
      });
      setProgress({ mode, done: 0, total: videos.length });
      for (let i = 0; i < videos.length; i++) {
        if (cancelRef.current) break;
        try {
          await processOne({ data: { runId, videoId: videos[i].id } });
        } catch (e) {
          console.warn("[benchmark] video failed", videos[i].id, e);
        }
        setProgress({ mode, done: i + 1, total: videos.length });
        if ((i + 1) % 5 === 0) qc.invalidateQueries({ queryKey: ["benchmark-latest"] });
      }
      await finalize({ data: { runId, status: cancelRef.current ? "failed" : "completed" } });
      return { runId };
    },
    onSettled: () => {
      setProgress(null);
      qc.invalidateQueries({ queryKey: ["benchmark-latest"] });
    },
  });

  const running = mut.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Benchmark Validation
        </h2>
        <div className="flex items-center gap-2">
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="Release version (optional)"
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <button
            disabled={healthQ.isFetching}
            onClick={() => healthQ.refetch()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {healthQ.isFetching ? "Probing…" : "Check Dataset Health"}
          </button>
          <button
            disabled={running}
            onClick={() => mut.mutate("quick")}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {running && progress?.mode === "quick"
              ? `Quick ${progress.done}/${progress.total}`
              : "Run Quick (10)"}
          </button>
          <button
            disabled={running}
            onClick={() => mut.mutate("full")}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {running && progress?.mode === "full"
              ? `Full ${progress.done}/${progress.total}`
              : "Run Full (200)"}
          </button>
          {running && (
            <button
              onClick={() => { cancelRef.current = true; }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {mut.isError && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {(mut.error as Error).message}
        </div>
      )}

      {healthQ.data && <DatasetHealthPanel h={healthQ.data} />}

      {q.isLoading && <p className="text-sm text-slate-500">Loading benchmark…</p>}
      {q.data && <BenchmarkBody data={q.data} health={healthQ.data ?? null} />}
    </div>
  );
}

function DatasetHealthPanel({ h }: { h: DatasetHealth }) {
  const inaccessible = h.total - h.accessible;
  const inaccessiblePct = h.total ? (inaccessible / h.total) * 100 : 0;
  const warn = inaccessiblePct > 5;
  const invalid = inaccessiblePct > 20;
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Benchmark Dataset Health
      </h3>
      {invalid && (
        <div className="mb-2 rounded border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-800">
          Benchmark invalid: dataset integrity issue detected. {inaccessible} of {h.total} videos
          ({inaccessiblePct.toFixed(0)}%) are inaccessible. Reliability score is hidden until the
          dataset is repaired.
        </div>
      )}
      {!invalid && warn && (
        <div className="mb-2 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          {inaccessible} of {h.total} benchmark assets ({inaccessiblePct.toFixed(0)}%) are
          inaccessible. Results may be skewed by missing sources.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 text-xs shadow-sm sm:grid-cols-3 lg:grid-cols-6">
        <Mini label="Total" value={h.total} />
        <Mini label="Accessible" value={h.accessible} tone="green" />
        <Mini label="Broken URLs" value={h.broken} tone={h.broken ? "red" : undefined} />
        <Mini label="Expired (404)" value={h.expired} tone={h.expired ? "red" : undefined} />
        <Mini label="Missing/Timeout" value={h.missing} tone={h.missing ? "amber" : undefined} />
        <Mini label="Cache available" value={`${h.cacheAvailable}/${h.total}`} />
      </div>
      {h.checkedAt && (
        <p className="mt-1 text-[10px] text-slate-400">
          Last checked: {new Date(h.checkedAt).toLocaleString()}
        </p>
      )}
    </section>
  );
}

function Mini({ label, value, tone }: { label: string; value: number | string; tone?: "green" | "red" | "amber" }) {
  const color =
    tone === "green" ? "text-green-700" : tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-slate-900";
  return (
    <div>
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

function BenchmarkBody({ data, health }: { data: LatestBenchmark; health: DatasetHealth | null }) {
  const { run, results, dataset } = data;
  const [drill, setDrill] = useState<BenchmarkResultRow | null>(null);

  if (!run) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        No benchmark run yet. Click <strong>Run Quick</strong> to generate the first
        report.
      </div>
    );
  }

  const score = Math.round(
    run.transcript_success_rate * 0.3 +
      run.sentence_success_rate * 0.3 +
      run.translation_success_rate * 0.2 +
      run.pipeline_success_rate * 0.2,
  );

  const datasetInvalid =
    health != null && health.total > 0 && (health.total - health.accessible) / health.total > 0.2;

  const scoreStatus =
    score >= 95
      ? { label: "Excellent", color: "bg-green-100 text-green-700" }
      : score >= 90
        ? { label: "Good", color: "bg-emerald-100 text-emerald-700" }
        : score >= 80
          ? { label: "Needs Improvement", color: "bg-amber-100 text-amber-700" }
          : { label: "Critical", color: "bg-red-100 text-red-700" };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              NativeFlow Reliability Score
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              {datasetInvalid ? (
                <span className="text-2xl font-bold text-red-700">Unavailable</span>
              ) : (
                <>
                  <span className="text-4xl font-bold text-slate-900">{score}%</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${scoreStatus.color}`}>
                    {scoreStatus.label}
                  </span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {datasetInvalid
                ? "Score hidden — dataset integrity compromised (>20% inaccessible)."
                : "Weighted: transcript 30% · sentences 30% · translation 20% · pipeline 20%"}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>
              Run:{" "}
              <span className="font-medium text-slate-700">
                {new Date(run.run_date).toLocaleString()}
              </span>
            </div>
            <div>Mode: {run.mode}</div>
            {run.release_version && <div>Release: {run.release_version}</div>}
            <div>{run.total_videos} videos</div>
          </div>
        </div>
      </div>

      {!datasetInvalid && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Transcript Success" value={run.transcript_success_rate} target={TARGETS.transcript} count={`${run.transcript_success_count}/${run.total_videos}`} />
          <Kpi label="Sentence Processing" value={run.sentence_success_rate} target={TARGETS.sentence} count={`${run.sentence_success_count}/${run.total_videos}`} />
          <Kpi label="Translation Success" value={run.translation_success_rate} target={TARGETS.translation} count={`${run.translation_success_count}/${run.total_videos}`} />
          <Kpi label="Overall Pipeline" value={run.pipeline_success_rate} target={TARGETS.pipeline} count={`${run.pipeline_success_count}/${run.total_videos}`} />
        </div>
      )}

      <SummaryInsights results={results} health={health} />
      <FailureBreakdown results={results} />
      <CategoryPerformance results={results} />
      <DatasetPanel dataset={dataset} />
      <ResultsTable results={results} onOpen={setDrill} />

      {drill && <Drilldown row={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}

function SummaryInsights({ results, health }: { results: BenchmarkResultRow[]; health: DatasetHealth | null }) {
  const insights = useMemo(() => {
    const out: string[] = [];
    const total = results.length;
    if (!total) return out;
    const failures = results.filter((r) => r.failure_code);
    const vFailures = failures.filter((r) => r.failure_code?.startsWith("V")).length;
    const preTranscript = failures.filter((r) => r.failure_code === "V01" || r.failure_code === "V02" || r.failure_code === "V03" || r.failure_code === "V04" || r.failure_code === "T01").length;

    if (failures.length && vFailures / failures.length >= 0.5) {
      out.push(`${Math.round((vFailures / failures.length) * 100)}% of failures are due to inaccessible source videos.`);
    }
    if (failures.length && preTranscript / failures.length >= 0.5) {
      out.push("Most failures occur before transcription begins.");
    }
    if (health && health.total > 0 && (health.total - health.accessible) / health.total > 0.2) {
      out.push("Pipeline quality cannot be evaluated because benchmark assets are unavailable.");
    }
    const transcriptOk = results.filter((r) => r.transcript_generated).length;
    if (transcriptOk === 0 && total > 0) {
      out.push("No transcripts were generated in this run — investigate transcript provider before judging downstream stages.");
    }
    return out;
  }, [results, health]);

  if (!insights.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Summary Insights
      </h3>
      <ul className="space-y-1 rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
        {insights.map((i, idx) => (
          <li key={idx}>• {i}</li>
        ))}
      </ul>
    </section>
  );
}

function Kpi({ label, value, target, count }: { label: string; value: number; target: number; count: string }) {
  const v = Number(value);
  const pass = v >= target;
  const color = pass ? "text-green-600" : v >= target - 5 ? "text-amber-600" : "text-red-600";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${color}`}>{v.toFixed(1)}%</div>
      <div className="mt-1 text-xs text-slate-500">
        {count} · target ≥{target}%{" "}
        <span className={pass ? "text-green-600" : "text-red-600"}>{pass ? "PASS" : "FAIL"}</span>
      </div>
    </div>
  );
}

function FailureBreakdown({ results }: { results: BenchmarkResultRow[] }) {
  const counts: Record<FailureCode, number> = ALL_FAILURE_CODES.reduce(
    (acc, c) => ({ ...acc, [c]: 0 }),
    {} as Record<FailureCode, number>,
  );
  for (const r of results) if (r.failure_code) counts[r.failure_code] += 1;
  const totalFails = Object.values(counts).reduce((a, b) => a + b, 0);
  const ranked = [...ALL_FAILURE_CODES].sort((a, b) => counts[b] - counts[a]);
  const max = Math.max(1, ...Object.values(counts));

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Failure Breakdown ({totalFails} total)
      </h3>
      <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-4">
        {ranked.map((c) => {
          const n = counts[c];
          const pct = totalFails ? Math.round((n / totalFails) * 100) : 0;
          return (
            <div key={c} className="flex items-center gap-3 text-xs">
              <div className="w-56 truncate font-mono text-slate-600">{FAILURE_LABELS[c]}</div>
              <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                <div className={`h-full ${n > 0 ? "bg-red-400" : ""}`} style={{ width: `${(n / max) * 100}%` }} />
              </div>
              <div className="w-20 text-right tabular-nums text-slate-700">
                {n} ({pct}%)
              </div>
            </div>
          );
        })}
        {totalFails === 0 && <p className="text-xs text-slate-400">No failures recorded in this run 🎉</p>}
      </div>
    </section>
  );
}

function CategoryPerformance({ results }: { results: BenchmarkResultRow[] }) {
  const byCat: Record<string, { total: number; success: number; highCount: number; mediumCount: number; lowCount: number }> = {};
  for (const c of CATEGORIES) byCat[c] = { total: 0, success: 0, highCount: 0, mediumCount: 0, lowCount: 0 };
  for (const r of results) {
    if (!byCat[r.category]) byCat[r.category] = { total: 0, success: 0, highCount: 0, mediumCount: 0, lowCount: 0 };
    const b = byCat[r.category];
    b.total += 1;
    if (r.transcript_found && !r.failure_code) b.success += 1;
    if (r.quality_rating === "high") b.highCount += 1;
    else if (r.quality_rating === "medium") b.mediumCount += 1;
    else b.lowCount += 1;
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Category Performance</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Tested</th>
              <th className="px-3 py-2">Success Rate</th>
              <th className="px-3 py-2">High</th>
              <th className="px-3 py-2">Medium</th>
              <th className="px-3 py-2">Low</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byCat).map(([cat, v]) => {
              const rate = v.total ? (v.success / v.total) * 100 : 0;
              const color = rate >= 95 ? "text-green-600" : rate >= 85 ? "text-amber-600" : "text-red-600";
              return (
                <tr key={cat} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-medium">{cat}</td>
                  <td className="px-3 py-1.5">{v.total}</td>
                  <td className={`px-3 py-1.5 font-semibold ${color}`}>{v.total ? `${rate.toFixed(0)}%` : "—"}</td>
                  <td className="px-3 py-1.5">{v.highCount}</td>
                  <td className="px-3 py-1.5">{v.mediumCount}</td>
                  <td className="px-3 py-1.5">{v.lowCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DatasetPanel({ dataset }: { dataset: LatestBenchmark["dataset"] }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Benchmark Dataset</h3>
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs shadow-sm">
        <div className="mb-2 text-slate-600">
          Total: <strong>{dataset.total}</strong> · Active: <strong>{dataset.active}</strong> ·
          Inactive: <strong className={dataset.inactive > 0 ? "text-amber-600" : ""}>{dataset.inactive}</strong>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(dataset.byCategory).map(([cat, v]) => (
            <div key={cat} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
              {cat}: <strong>{v.active}</strong>/{v.total}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ResultsTable({ results, onOpen }: { results: BenchmarkResultRow[]; onOpen: (r: BenchmarkResultRow) => void }) {
  if (!results.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Per-video Results <span className="font-normal normal-case text-slate-400">(click a row for details)</span>
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">URL</th>
              <th className="px-2 py-2">HTTP</th>
              <th className="px-2 py-2">Download</th>
              <th className="px-2 py-2">MB</th>
              <th className="px-2 py-2">Cache</th>
              <th className="px-2 py-2">Transcript</th>
              <th className="px-2 py-2">Chars</th>
              <th className="px-2 py-2">Sentences</th>
              <th className="px-2 py-2">Translation</th>
              <th className="px-2 py-2">Quality</th>
              <th className="px-2 py-2">Failure</th>
              <th className="px-2 py-2">ms</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => onOpen(r)}
              >
                <td className="px-2 py-1">{r.category}</td>
                <td className={`px-2 py-1 ${r.video_url_status === "OK" ? "text-green-600" : "text-red-600"}`}>
                  {r.video_url_status ?? "—"}
                </td>
                <td className="px-2 py-1">{r.http_status_code ?? "—"}</td>
                <td className="px-2 py-1">{r.download_status ?? "—"}</td>
                <td className="px-2 py-1 tabular-nums">{r.download_size_mb != null ? Number(r.download_size_mb).toFixed(3) : "—"}</td>
                <td className="px-2 py-1">{r.cache_hit ? "Yes" : "No"}</td>
                <td className="px-2 py-1">{r.transcript_generated ? "Yes" : "No"}</td>
                <td className="px-2 py-1 tabular-nums">{r.transcript_length_chars ?? 0}</td>
                <td className="px-2 py-1">{r.sentence_count}</td>
                <td className="px-2 py-1">{r.translation_generated ? "Yes" : "No"}</td>
                <td
                  className={`px-2 py-1 font-medium ${
                    r.quality_rating === "high" ? "text-green-600" : r.quality_rating === "medium" ? "text-amber-600" : "text-red-600"
                  }`}
                  title={r.quality_reason ?? ""}
                >
                  {r.quality_rating}
                </td>
                <td className="px-2 py-1 font-mono text-red-600">{r.failure_code ?? ""}</td>
                <td className="px-2 py-1 tabular-nums">{r.processing_time_ms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Drilldown({ row, onClose }: { row: BenchmarkResultRow; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Failure Drilldown</h4>
            <p className="text-xs text-slate-500">{row.video_title ?? row.video_id_ext ?? row.benchmark_video_id}</p>
          </div>
          <button onClick={onClose} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100">
            Close
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-slate-500">Video ID</dt>
          <dd className="font-mono">{row.video_id_ext ?? "—"}</dd>
          <dt className="text-slate-500">Original URL</dt>
          <dd className="truncate">
            {row.video_url ? (
              <a href={row.video_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                {row.video_url}
              </a>
            ) : "—"}
          </dd>
          <dt className="text-slate-500">URL Status</dt>
          <dd>{row.video_url_status ?? "—"}</dd>
          <dt className="text-slate-500">HTTP Code</dt>
          <dd>{row.http_status_code ?? "—"}</dd>
          <dt className="text-slate-500">Download</dt>
          <dd>{row.download_status ?? "—"} ({row.download_size_mb != null ? `${Number(row.download_size_mb).toFixed(3)} MB` : "—"})</dd>
          <dt className="text-slate-500">Cache hit</dt>
          <dd>{row.cache_hit ? "Yes" : "No"}</dd>
          <dt className="text-slate-500">Transcript exists</dt>
          <dd>{row.transcript_generated ? `Yes (${row.transcript_length_chars} chars)` : "No"}</dd>
          <dt className="text-slate-500">Translation</dt>
          <dd>{row.translation_generated ? "Yes" : "No"}</dd>
          <dt className="text-slate-500">Failure code</dt>
          <dd className="font-mono text-red-600">{row.failure_code ?? "—"}</dd>
          <dt className="text-slate-500">Quality</dt>
          <dd>{row.quality_rating} — {row.quality_reason ?? ""}</dd>
        </dl>

        <h5 className="mt-4 mb-1 text-xs font-semibold uppercase text-slate-500">Pipeline Logs</h5>
        <div className="rounded border border-slate-200 bg-slate-50 p-2 text-[11px] font-mono">
          {(row.pipeline_logs ?? []).length === 0 && <div className="text-slate-400">No logs captured.</div>}
          {(row.pipeline_logs ?? []).map((l, i) => (
            <div key={i} className={l.ok ? "text-green-700" : "text-red-700"}>
              {l.ok ? "✓" : "✗"} {l.step} {l.ms != null ? `(${l.ms}ms)` : ""} {l.detail ? `— ${l.detail}` : ""}
            </div>
          ))}
        </div>

        {row.error_message && (
          <>
            <h5 className="mt-4 mb-1 text-xs font-semibold uppercase text-slate-500">Error Message</h5>
            <pre className="overflow-x-auto rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-800">
              {row.error_message}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
