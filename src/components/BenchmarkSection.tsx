import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getLatestBenchmark,
  startBenchmarkRun,
  processBenchmarkVideo,
  finalizeBenchmarkRun,
  FAILURE_LABELS,
  type FailureCode,
  type LatestBenchmark,
  type BenchmarkResultRow,
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
        // Refresh dashboard live every ~5 videos
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

      {q.isLoading && <p className="text-sm text-slate-500">Loading benchmark…</p>}
      {q.data && <BenchmarkBody data={q.data} />}
    </div>
  );
}


function BenchmarkBody({ data }: { data: LatestBenchmark }) {
  const { run, results, dataset } = data;
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
      {/* Reliability Score */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              NativeFlow Reliability Score
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-4xl font-bold text-slate-900">{score}%</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${scoreStatus.color}`}
              >
                {scoreStatus.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Weighted: transcript 30% · sentences 30% · translation 20% · pipeline 20%
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

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Transcript Success"
          value={run.transcript_success_rate}
          target={TARGETS.transcript}
          count={`${run.transcript_success_count}/${run.total_videos}`}
        />
        <Kpi
          label="Sentence Processing"
          value={run.sentence_success_rate}
          target={TARGETS.sentence}
          count={`${run.sentence_success_count}/${run.total_videos}`}
        />
        <Kpi
          label="Translation Success"
          value={run.translation_success_rate}
          target={TARGETS.translation}
          count={`${run.translation_success_count}/${run.total_videos}`}
        />
        <Kpi
          label="Overall Pipeline"
          value={run.pipeline_success_rate}
          target={TARGETS.pipeline}
          count={`${run.pipeline_success_count}/${run.total_videos}`}
        />
      </div>

      <FailureBreakdown results={results} />
      <CategoryPerformance results={results} />
      <DatasetPanel dataset={dataset} />
      <ResultsTable results={results} />
    </div>
  );
}

function Kpi({
  label,
  value,
  target,
  count,
}: {
  label: string;
  value: number;
  target: number;
  count: string;
}) {
  const v = Number(value);
  const pass = v >= target;
  const color = pass
    ? "text-green-600"
    : v >= target - 5
      ? "text-amber-600"
      : "text-red-600";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${color}`}>{v.toFixed(1)}%</div>
      <div className="mt-1 text-xs text-slate-500">
        {count} · target ≥{target}%{" "}
        <span className={pass ? "text-green-600" : "text-red-600"}>
          {pass ? "PASS" : "FAIL"}
        </span>
      </div>
    </div>
  );
}

function FailureBreakdown({ results }: { results: BenchmarkResultRow[] }) {
  const codes: FailureCode[] = ["T01", "T02", "T03", "S01", "S02", "S03", "L01", "U01"];
  const counts: Record<FailureCode, number> = {
    T01: 0, T02: 0, T03: 0, S01: 0, S02: 0, S03: 0, L01: 0, U01: 0,
  };
  for (const r of results) if (r.failure_code) counts[r.failure_code] += 1;
  const totalFails = Object.values(counts).reduce((a, b) => a + b, 0);
  const ranked = [...codes].sort((a, b) => counts[b] - counts[a]);
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
              <div className="w-44 truncate font-mono text-slate-600">{FAILURE_LABELS[c]}</div>
              <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                <div
                  className={`h-full ${n > 0 ? "bg-red-400" : ""}`}
                  style={{ width: `${(n / max) * 100}%` }}
                />
              </div>
              <div className="w-20 text-right tabular-nums text-slate-700">
                {n} ({pct}%)
              </div>
            </div>
          );
        })}
        {totalFails === 0 && (
          <p className="text-xs text-slate-400">No failures recorded in this run 🎉</p>
        )}
      </div>
    </section>
  );
}

function CategoryPerformance({ results }: { results: BenchmarkResultRow[] }) {
  const byCat: Record<
    string,
    { total: number; success: number; highCount: number; mediumCount: number; lowCount: number }
  > = {};
  for (const c of CATEGORIES) {
    byCat[c] = { total: 0, success: 0, highCount: 0, mediumCount: 0, lowCount: 0 };
  }
  for (const r of results) {
    if (!byCat[r.category]) {
      byCat[r.category] = { total: 0, success: 0, highCount: 0, mediumCount: 0, lowCount: 0 };
    }
    const b = byCat[r.category];
    b.total += 1;
    if (r.transcript_found && !r.failure_code) b.success += 1;
    if (r.quality_rating === "high") b.highCount += 1;
    else if (r.quality_rating === "medium") b.mediumCount += 1;
    else b.lowCount += 1;
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Category Performance
      </h3>
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
              const color =
                rate >= 95 ? "text-green-600" : rate >= 85 ? "text-amber-600" : "text-red-600";
              return (
                <tr key={cat} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-medium">{cat}</td>
                  <td className="px-3 py-1.5">{v.total}</td>
                  <td className={`px-3 py-1.5 font-semibold ${color}`}>
                    {v.total ? `${rate.toFixed(0)}%` : "—"}
                  </td>
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
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Benchmark Dataset
      </h3>
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs shadow-sm">
        <div className="mb-2 text-slate-600">
          Total: <strong>{dataset.total}</strong> · Active:{" "}
          <strong>{dataset.active}</strong> · Inactive:{" "}
          <strong className={dataset.inactive > 0 ? "text-amber-600" : ""}>
            {dataset.inactive}
          </strong>
          {dataset.inactive > 0 && (
            <span className="ml-2 text-amber-600">
              ← swap placeholder URLs in <code>benchmark_videos</code>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(dataset.byCategory).map(([cat, v]) => (
            <div
              key={cat}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700"
            >
              {cat}: <strong>{v.active}</strong>/{v.total}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ResultsTable({ results }: { results: BenchmarkResultRow[] }) {
  if (!results.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Per-video Results
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">Source</th>
              <th className="px-2 py-2">Sentences</th>
              <th className="px-2 py-2">Avg len</th>
              <th className="px-2 py-2">Longest</th>
              <th className="px-2 py-2">Translation</th>
              <th className="px-2 py-2">Quality</th>
              <th className="px-2 py-2">Failure</th>
              <th className="px-2 py-2">ms</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-2 py-1">{r.category}</td>
                <td className="px-2 py-1">{r.transcript_source ?? "—"}</td>
                <td className="px-2 py-1">{r.sentence_count}</td>
                <td className="px-2 py-1">{Number(r.avg_sentence_length).toFixed(1)}</td>
                <td className="px-2 py-1">{r.longest_sentence_words}</td>
                <td className="px-2 py-1">{r.translation_success ? "✓" : "—"}</td>
                <td
                  className={`px-2 py-1 font-medium ${
                    r.quality_rating === "high"
                      ? "text-green-600"
                      : r.quality_rating === "medium"
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}
                  title={r.quality_reason ?? ""}
                >
                  {r.quality_rating}
                </td>
                <td className="px-2 py-1 text-red-600">{r.failure_code ?? ""}</td>
                <td className="px-2 py-1 tabular-nums">{r.processing_time_ms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
