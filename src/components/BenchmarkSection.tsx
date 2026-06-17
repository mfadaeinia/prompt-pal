import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getLatestBenchmark,
  getDatasetHealth,
  getDatasetSize,
  startBenchmarkRun,
  processBenchmarkVideo,
  finalizeBenchmarkRun,
  upsertBenchmarkVideos,
  exportBenchmarkVideos,
  FAILURE_LABELS,
  ALL_FAILURE_CODES,
  type FailureCode,
  type LatestBenchmark,
  type BenchmarkResultRow,
  type DatasetHealth,
  type UpsertBenchmarkResult,
} from "@/lib/benchmark.functions";
import {
  computeScores,
  pipelineBand,
  triggeredReasons,
  REASON_LABELS,
  aggregateBySource,
  SOURCE_LABELS,
  generateObservations,
  SCORE_THRESHOLDS,
  SCORE_WEIGHTS,
} from "@/lib/benchmark-scoring";

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
  const sizeFetcher = useServerFn(getDatasetSize);
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

  const sizeQ = useQuery({
    queryKey: ["benchmark-dataset-size"],
    queryFn: () => sizeFetcher(),
    refetchInterval: 60_000,
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
      // Throttle YouTube caption fetches: ~1s avg between videos with jitter,
      // extra cooldown when the previous video tripped a rate-limit signal.
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const baseDelayMs = 800;
      const jitterMs = 1200;
      const rateLimitCooldownMs = 8000;
      let consecutiveRateLimited = 0;
      for (let i = 0; i < videos.length; i++) {
        if (cancelRef.current) break;
        let rateLimited = false;
        try {
          const res = await processOne({ data: { runId, videoId: videos[i].id } });
          rateLimited = Boolean((res as { rateLimited?: boolean })?.rateLimited);
        } catch (e) {
          console.warn("[benchmark] video failed", videos[i].id, e);
        }
        setProgress({ mode, done: i + 1, total: videos.length });
        if ((i + 1) % 5 === 0) qc.invalidateQueries({ queryKey: ["benchmark-latest"] });
        if (i < videos.length - 1 && !cancelRef.current) {
          if (rateLimited) {
            consecutiveRateLimited += 1;
            // Exponential cooldown, capped at 30s, when YouTube is blocking us.
            const cooldown = Math.min(30000, rateLimitCooldownMs * consecutiveRateLimited);
            await sleep(cooldown + Math.random() * jitterMs);
          } else {
            consecutiveRateLimited = 0;
            await sleep(baseDelayMs + Math.random() * jitterMs);
          }
        }
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
          <UpdateGoldenDatasetButton onSaved={() => {
            qc.invalidateQueries({ queryKey: ["benchmark-latest"] });
            qc.invalidateQueries({ queryKey: ["benchmark-health"] });
            qc.invalidateQueries({ queryKey: ["benchmark-dataset-size"] });
          }} />
          {(() => {
            const total = sizeQ.data?.total ?? 0;
            const quickCount = Math.min(10, total || 10);
            return (
              <>
                <button
                  disabled={running}
                  onClick={() => mut.mutate("quick")}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {running && progress?.mode === "quick"
                    ? `Quick ${progress.done}/${progress.total}`
                    : `Run Quick (${quickCount})`}
                </button>
                <button
                  disabled={running}
                  onClick={() => mut.mutate("full")}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {running && progress?.mode === "full"
                    ? `Full ${progress.done}/${progress.total}`
                    : `Run Full (${total})`}
                </button>
              </>
            );
          })()}
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
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Transcript Success" value={run.transcript_success_rate} target={TARGETS.transcript} count={`${run.transcript_success_count}/${run.total_videos}`} />
            <Kpi label="Sentence Processing" value={run.sentence_success_rate} target={TARGETS.sentence} count={`${run.sentence_success_count}/${run.total_videos}`} />
            <Kpi label="Translation Success" value={run.translation_success_rate} target={TARGETS.translation} count={`${run.translation_success_count}/${run.total_videos}`} />
            <Kpi label="Overall Pipeline" value={run.pipeline_success_rate} target={TARGETS.pipeline} count={`${run.pipeline_success_count}/${run.total_videos}`} />
          </div>
          <TranscriptSourceMetrics results={results} total={run.total_videos} />
        </>
      )}

      <SummaryInsights results={results} health={health} />
      <TranscribrBreakdown results={results} />
      <AutoObservations results={results} />
      <QualityDistribution results={results} />
      <SourceAnalysis results={results} />
      <QualityThresholds />
      <AudioExtractionPanel results={results} />
      <FailureBreakdown results={results} />

      <CategoryPerformance results={results} />
      <DatasetPanel dataset={dataset} />
      <ScoredResultsTable results={results} onOpen={setDrill} />

      {drill && <Drilldown row={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}

function TranscriptSourceMetrics({ results, total }: { results: BenchmarkResultRow[]; total: number }) {
  const m = useMemo(() => {
    const denom = Math.max(1, total);
    const youtube = results.filter((r) => r.transcript_source === "youtube").length;
    const cache = results.filter((r) => r.transcript_source === "cache").length;
    const asr = results.filter((r) => r.transcript_source === "asr").length;
    const fallback = results.filter((r) => r.transcript_source === "fallback").length;
    const found = results.filter((r) => r.transcript_found).length;
    // Caption availability = videos where YouTube (or its scraping fallback) produced captions.
    const captionAvailable = youtube + cache + fallback;
    // ASR was attempted whenever captions weren't available AND we have a recorded result.
    const asrAttempted = results.length - captionAvailable;
    const asrSuccess = asr;
    return {
      captionAvailabilityPct: Number(((captionAvailable / denom) * 100).toFixed(1)),
      captionLabel: `${captionAvailable}/${total}`,
      asrSuccessPct: asrAttempted > 0 ? Number(((asrSuccess / asrAttempted) * 100).toFixed(1)) : 0,
      asrLabel: asrAttempted > 0 ? `${asrSuccess}/${asrAttempted}` : "0/0",
      cacheHitPct: Number(((cache / denom) * 100).toFixed(1)),
      cacheLabel: `${cache}/${total}`,
      overallPct: Number(((found / denom) * 100).toFixed(1)),
      overallLabel: `${found}/${total}`,
    };
  }, [results, total]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Transcript pipeline breakdown
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Caption availability" value={m.captionAvailabilityPct} target={70} count={m.captionLabel} />
        <Kpi label="ASR fallback success" value={m.asrSuccessPct} target={80} count={m.asrLabel} />
        <Kpi label="Cache hit rate" value={m.cacheHitPct} target={0} count={m.cacheLabel} />
        <Kpi label="Overall transcript success" value={m.overallPct} target={95} count={m.overallLabel} />
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Caption availability = YouTube + cache + scrape. ASR success = % of caption-less videos rescued by Gemini ASR.
      </p>
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

// ---------- Transcribr failure breakdown ----------

type TranscribrBucket =
  | "402_insufficient_credits"
  | "401_unauthorized"
  | "429_rate_limited"
  | "5xx_provider_error"
  | "empty_transcript"
  | "timeout"
  | "not_invoked"
  | "ok"
  | "unknown";

const TRANSCRIBR_BUCKET_LABEL: Record<TranscribrBucket, string> = {
  "402_insufficient_credits": "402 insufficient credits",
  "401_unauthorized": "401 unauthorized",
  "429_rate_limited": "429 rate limited",
  "5xx_provider_error": "5xx provider error",
  empty_transcript: "Empty transcript",
  timeout: "Timeout",
  not_invoked: "Not invoked",
  ok: "OK",
  unknown: "Unknown",
};

export function classifyTranscribrBucket(row: {
  transcribr_invoked: boolean | null;
  transcribr_status: number | null;
  transcribr_error: string | null;
  transcribr_segments_count: number | null;
}): TranscribrBucket {
  if (row.transcribr_invoked === false || row.transcribr_invoked == null) {
    // Distinguish "never tried" from "tried and ok": if status is set, treat as invoked.
    if (row.transcribr_status == null && !row.transcribr_error) return "not_invoked";
  }
  const s = row.transcribr_status;
  const err = (row.transcribr_error ?? "").toLowerCase();
  if (s === 402) return "402_insufficient_credits";
  if (s === 401 || s === 403) return "401_unauthorized";
  if (s === 429) return "429_rate_limited";
  if (s != null && s >= 500 && s <= 599) return "5xx_provider_error";
  if (/timeout|timed out|etimedout|aborted/.test(err)) return "timeout";
  if (s === 200 && (row.transcribr_segments_count ?? 0) === 0) return "empty_transcript";
  if (s === 200) return "ok";
  if (s == null && err) return "unknown";
  return "unknown";
}

function TranscribrBreakdown({ results }: { results: BenchmarkResultRow[] }) {
  const stats = useMemo(() => {
    const failures = results.filter((r) => !r.transcript_found);
    const buckets = new Map<TranscribrBucket, number>();
    for (const r of failures) {
      const b = classifyTranscribrBucket(r);
      buckets.set(b, (buckets.get(b) ?? 0) + 1);
    }
    const total = failures.length;
    const ordered: TranscribrBucket[] = [
      "402_insufficient_credits",
      "401_unauthorized",
      "429_rate_limited",
      "5xx_provider_error",
      "empty_transcript",
      "timeout",
      "not_invoked",
      "unknown",
    ];
    const rows = ordered
      .map((b) => ({ bucket: b, count: buckets.get(b) ?? 0 }))
      .filter((r) => r.count > 0);
    const c402 = buckets.get("402_insufficient_credits") ?? 0;
    const dominantInsight =
      total > 0 && c402 / total > 0.5
        ? "Most transcript failures are caused by Transcribr insufficient credits."
        : null;
    return { rows, total, dominantInsight };
  }, [results]);

  if (!stats.total) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Transcribr failure breakdown
      </h3>
      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
        {stats.dominantInsight && (
          <div className="mb-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-900">
            ⚠ {stats.dominantInsight}
          </div>
        )}
        {stats.rows.length === 0 ? (
          <div className="text-slate-500">
            No Transcribr diagnostics on the {stats.total} failed video(s) — run a new benchmark to populate these fields.
          </div>
        ) : (
          <table className="w-full">
            <thead className="text-slate-500">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Reason</th>
                <th className="px-2 py-1 text-right font-medium">Count</th>
                <th className="px-2 py-1 text-right font-medium">% of failures</th>
              </tr>
            </thead>
            <tbody>
              {stats.rows.map((r) => (
                <tr key={r.bucket} className="border-t border-slate-100">
                  <td className="px-2 py-1">{TRANSCRIBR_BUCKET_LABEL[r.bucket]}</td>
                  <td className="px-2 py-1 text-right font-mono">{r.count}</td>
                  <td className="px-2 py-1 text-right font-mono">
                    {Math.round((r.count / stats.total) * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-[11px] text-slate-500">
          Buckets are derived from per-row Transcribr HTTP status, error body, and segment count
          (new fields persisted to <code className="font-mono">benchmark_video_results</code>).
        </p>
      </div>
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

        <h5 className="mt-4 mb-1 text-xs font-semibold uppercase text-slate-500">Quality Score Breakdown</h5>
        <ScoreBreakdownBlock row={row} />

        <h5 className="mt-4 mb-1 text-xs font-semibold uppercase text-slate-500">Sentence Segmentation Diagnostics</h5>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded border border-slate-200 bg-slate-50 p-3 text-xs">
          <dt className="text-slate-500">Sentence count</dt>
          <dd className="font-mono">{row.sentence_count}</dd>
          <dt className="text-slate-500">Avg words / sentence</dt>
          <dd className="font-mono">{row.avg_sentence_length}</dd>
          <dt className="text-slate-500">Longest sentence</dt>
          <dd className="font-mono">{row.longest_sentence_words} words</dd>
          <dt className="text-slate-500">Short fragments (&lt;4w)</dt>
          <dd className="font-mono">{row.short_fragment_pct ?? "—"}%</dd>
          <dt className="text-slate-500">Giant sentences (&gt;35w)</dt>
          <dd className="font-mono">{row.giant_sentence_pct ?? "—"}%</dd>
          <dt className="text-slate-500">Punctuation coverage</dt>
          <dd className="font-mono">{row.punctuation_coverage_pct ?? "—"}%</dd>
          <dt className="text-slate-500">Median gap between sentences</dt>
          <dd className="font-mono">{row.median_gap_seconds != null ? `${row.median_gap_seconds}s` : "—"}</dd>
          <dt className="text-slate-500">Sentence UX quality</dt>
          <dd>
            <span className={
              row.sentence_quality_rating === "high" ? "text-green-700 font-semibold" :
              row.sentence_quality_rating === "medium" ? "text-amber-700 font-semibold" :
              "text-red-700 font-semibold"
            }>{row.sentence_quality_rating ?? "—"}</span>
            {row.sentence_quality_reason && (
              <span className="text-slate-500"> — {row.sentence_quality_reason}</span>
            )}
          </dd>
        </dl>

        {row.sentence_preview && row.sentence_preview.length > 0 && (
          <>
            <h5 className="mt-4 mb-1 text-xs font-semibold uppercase text-slate-500">
              First {row.sentence_preview.length} Sentence Units (manual inspection)
            </h5>
            <div className="overflow-hidden rounded border border-slate-200">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="w-10 px-2 py-1 text-left">#</th>
                    <th className="w-24 px-2 py-1 text-left">Time</th>
                    <th className="w-10 px-2 py-1 text-right">w</th>
                    <th className="px-2 py-1 text-left">Sentence</th>
                  </tr>
                </thead>
                <tbody>
                  {row.sentence_preview.map((s, i) => {
                    const tooShort = s.words > 0 && s.words < 4;
                    const tooLong = s.words > 35;
                    const cls = tooShort ? "bg-amber-50" : tooLong ? "bg-red-50" : "";
                    const fmt = (n: number) => {
                      const m = Math.floor(n / 60);
                      const sec = Math.floor(n % 60).toString().padStart(2, "0");
                      return `${m}:${sec}`;
                    };
                    return (
                      <tr key={i} className={`border-t border-slate-100 ${cls}`}>
                        <td className="px-2 py-1 font-mono text-slate-400">{i + 1}</td>
                        <td className="px-2 py-1 font-mono text-slate-500">
                          {fmt(s.start)}–{fmt(s.end)}
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-slate-500">{s.words}</td>
                        <td className="px-2 py-1 text-slate-800">{s.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Sentence Repair drilldown */}
        {(row.deterministic_quality || row.ai_repair_used) && (
          <>
            <h5 className="mt-4 mb-1 text-xs font-semibold uppercase text-slate-500">
              AI-Assisted Sentence Repair
            </h5>
            <dl className="mb-2 grid grid-cols-[180px_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-slate-500">Deterministic quality</dt>
              <dd className="font-mono">{row.deterministic_quality ?? "—"}</dd>
              <dt className="text-slate-500">AI repair used</dt>
              <dd className="font-mono">{row.ai_repair_used ? "yes" : "no"}</dd>
              <dt className="text-slate-500">AI repair success</dt>
              <dd className="font-mono">{row.ai_repair_success ? "yes" : "no"}</dd>
              <dt className="text-slate-500">Final sentence quality</dt>
              <dd className="font-mono">{row.final_sentence_quality ?? "—"}</dd>
              <dt className="text-slate-500">Reason</dt>
              <dd className="text-slate-700">{row.repair_reason ?? "—"}</dd>
            </dl>

            {row.repair_diagnostics && (
              <div className="grid gap-2 md:grid-cols-3">
                <RepairColumn
                  title="Raw caption chunks"
                  items={(row.repair_diagnostics.rawChunksPreview ?? []).map((c) => ({
                    label: `#${c.i} ${fmtTime(c.start)}–${fmtTime(c.end)}`,
                    text: c.text,
                  }))}
                />
                <RepairColumn
                  title={`Deterministic sentences${row.deterministic_quality ? ` (${row.deterministic_quality})` : ""}`}
                  items={(row.repair_diagnostics.deterministicPreview ?? []).map((s, i) => ({
                    label: `#${i + 1} ${fmtTime(s.start)}–${fmtTime(s.end)} · ${s.words}w`,
                    text: s.text,
                  }))}
                />
                <RepairColumn
                  title={`AI-repaired sentences${row.ai_repair_success ? " (accepted)" : row.ai_repair_used ? " (rejected)" : ""}`}
                  items={(row.repair_diagnostics.repairedPreview ?? []).map((s, i) => ({
                    label: `#${i + 1} ${fmtTime(s.start)}–${fmtTime(s.end)} · ${s.words}w`,
                    text: s.text,
                  }))}
                  empty={
                    row.ai_repair_used
                      ? row.repair_diagnostics.validationError ?? "no output"
                      : "not invoked"
                  }
                />
              </div>
            )}

            {row.ai_repair_used && row.repair_diagnostics && (
              <RepairValidationPanel
                accepted={!!row.ai_repair_success}
                reason={row.repair_reason ?? null}
                validationError={row.repair_diagnostics.validationError ?? null}
                httpStatus={row.repair_diagnostics.aiHttpStatus ?? null}
                rawChunks={row.repair_diagnostics.rawChunksPreview ?? []}
                repaired={row.repair_diagnostics.repairedPreview ?? null}
              />
            )}
          </>
        )}



        <h5 className="mt-4 mb-1 text-xs font-semibold uppercase text-slate-500">Pipeline Logs</h5>
        <div className="rounded border border-slate-200 bg-slate-50 p-2 text-[11px] font-mono">
          {(row.pipeline_logs ?? []).length === 0 && <div className="text-slate-400">No logs captured.</div>}
          {(row.pipeline_logs ?? []).map((l, i) => (
            <div key={i} className={l.ok ? "text-green-700" : "text-red-700"}>
              {l.ok ? "✓" : "✗"} {l.step} {l.ms != null ? `(${l.ms}ms)` : ""} {l.detail ? `— ${l.detail}` : ""}
            </div>
          ))}
        </div>

        <h5 className="mt-4 mb-1 text-xs font-semibold uppercase text-slate-500">Transcribr Diagnostics</h5>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded border border-slate-200 bg-slate-50 p-3 text-xs">
          <dt className="text-slate-500">Bucket</dt>
          <dd className="font-mono">
            {TRANSCRIBR_BUCKET_LABEL[classifyTranscribrBucket(row)]}
          </dd>
          <dt className="text-slate-500">Invoked</dt>
          <dd className="font-mono">{row.transcribr_invoked == null ? "—" : row.transcribr_invoked ? "yes" : "no"}</dd>
          <dt className="text-slate-500">HTTP status</dt>
          <dd className="font-mono">{row.transcribr_status ?? "—"}</dd>
          <dt className="text-slate-500">Segments returned</dt>
          <dd className="font-mono">{row.transcribr_segments_count ?? "—"}</dd>
          <dt className="text-slate-500">Latency</dt>
          <dd className="font-mono">{row.transcribr_duration_ms != null ? `${row.transcribr_duration_ms}ms` : "—"}</dd>
          <dt className="text-slate-500">Error body</dt>
          <dd className="font-mono break-all text-red-700">{row.transcribr_error ?? "—"}</dd>
        </dl>

        {row.provider_error && (
          <>
            <h5 className="mt-4 mb-1 text-xs font-semibold uppercase text-slate-500">Raw Provider Error</h5>
            <pre className="overflow-x-auto rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-800">
              {row.provider_error}
            </pre>
          </>
        )}
        {row.error_message && (
          <>
            <h5 className="mt-4 mb-1 text-xs font-semibold uppercase text-slate-500">User-facing Error</h5>
            <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
              {row.error_message}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Quality breakdown / explainability ----------

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80 ? "bg-green-500" : value >= 60 ? "bg-amber-500" : "bg-red-500";
  const text =
    value >= 80 ? "text-green-700" : value >= 60 ? "text-amber-700" : "text-red-700";
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-24 text-slate-600">{label}</div>
      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <div className={`w-10 text-right font-semibold tabular-nums ${text}`}>{value}</div>
    </div>
  );
}

function ScoreBreakdownBlock({ row }: { row: BenchmarkResultRow }) {
  const s = computeScores(row);
  const reasons = triggeredReasons(row);
  return (
    <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
      <ScoreBar label="Transcript" value={s.transcript} />
      <ScoreBar label="Sentences" value={s.sentences} />
      <ScoreBar label="Translation" value={s.translation} />
      <ScoreBar label="Quality" value={s.quality} />
      <div className="border-t border-slate-200 pt-2">
        <ScoreBar label="Pipeline" value={s.pipeline} />
        <div className="mt-1 text-[10px] text-slate-500">
          Band: <strong>{pipelineBand(s.pipeline).toUpperCase()}</strong>
        </div>
      </div>
      {reasons.length > 0 && (
        <div className="mt-2 border-t border-slate-200 pt-2">
          <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">
            Why this isn't High
          </div>
          <ul className="space-y-0.5 text-[11px] text-amber-800">
            {reasons.map((c) => (
              <li key={c}>• {REASON_LABELS[c]}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AutoObservations({ results }: { results: BenchmarkResultRow[] }) {
  const obs = useMemo(() => generateObservations(results), [results]);
  if (!obs.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Failure Analysis Insights
      </h3>
      <ul className="space-y-1 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-900">
        {obs.map((o, i) => (
          <li key={i}>• {o}</li>
        ))}
      </ul>
    </section>
  );
}

function QualityDistribution({ results }: { results: BenchmarkResultRow[] }) {
  const { bands, total } = useMemo(() => {
    const bands = { high: 0, medium: 0, low: 0 };
    let total = 0;
    for (const r of results) {
      if (!r.transcript_found) continue;
      total += 1;
      const b = pipelineBand(computeScores(r).pipeline);
      bands[b] += 1;
    }
    return { bands, total };
  }, [results]);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  if (!total) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Quality Distribution
      </h3>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex h-3 w-full overflow-hidden rounded bg-slate-100">
          <div className="bg-green-500" style={{ width: `${pct(bands.high)}%` }} />
          <div className="bg-amber-500" style={{ width: `${pct(bands.medium)}%` }} />
          <div className="bg-red-500" style={{ width: `${pct(bands.low)}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />{" "}
            High: <strong>{bands.high}</strong> ({pct(bands.high)}%)
          </div>
          <div>
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />{" "}
            Medium: <strong>{bands.medium}</strong> ({pct(bands.medium)}%)
          </div>
          <div>
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />{" "}
            Low: <strong>{bands.low}</strong> ({pct(bands.low)}%)
          </div>
        </div>
      </div>
    </section>
  );
}

function SourceAnalysis({ results }: { results: BenchmarkResultRow[] }) {
  const stats = useMemo(() => aggregateBySource(results), [results]);
  if (!stats.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Source Analysis
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Videos</th>
              <th className="px-3 py-2">Success</th>
              <th className="px-3 py-2">Avg Quality</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.source} className="border-t border-slate-100">
                <td className="px-3 py-1.5 font-medium">{SOURCE_LABELS[s.source]}</td>
                <td className="px-3 py-1.5 tabular-nums">{s.total}</td>
                <td className="px-3 py-1.5 tabular-nums">
                  {s.successPct}% <span className="text-slate-400">({s.success}/{s.total})</span>
                </td>
                <td
                  className={`px-3 py-1.5 font-semibold tabular-nums ${
                    s.avgQuality >= 80
                      ? "text-green-700"
                      : s.avgQuality >= 60
                        ? "text-amber-700"
                        : "text-red-700"
                  }`}
                >
                  {s.avgQuality}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QualityThresholds() {
  const t = SCORE_THRESHOLDS;
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Quality Thresholds (rules used)
      </h3>
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-xs sm:grid-cols-2">
        <div>
          <div className="font-semibold text-slate-700">Pipeline bands</div>
          <ul className="mt-1 space-y-0.5 text-slate-600">
            <li>High = Pipeline ≥ {t.pipelineBands.high}</li>
            <li>Medium = {t.pipelineBands.medium}–{t.pipelineBands.high - 1}</li>
            <li>Low = &lt; {t.pipelineBands.medium}</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-slate-700">Pipeline weights</div>
          <ul className="mt-1 space-y-0.5 text-slate-600">
            <li>Transcript {Math.round(SCORE_WEIGHTS.transcript * 100)}%</li>
            <li>Sentences {Math.round(SCORE_WEIGHTS.sentences * 100)}%</li>
            <li>Translation {Math.round(SCORE_WEIGHTS.translation * 100)}%</li>
            <li>Quality {Math.round(SCORE_WEIGHTS.quality * 100)}%</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-slate-700">Transcript score</div>
          <ul className="mt-1 space-y-0.5 text-slate-600">
            <li>0 at &lt; {t.transcript.minWords} words → 100 at ≥ {t.transcript.goodWords} words</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-slate-700">Sentence score</div>
          <ul className="mt-1 space-y-0.5 text-slate-600">
            <li>Count: 5 → {t.sentences.goodCount} sentences</li>
            <li>Avg length sweet-spot: {t.sentences.avgMin}–{t.sentences.avgMax} words</li>
            <li>Longest penalty above {t.sentences.longestSoftMax}; 0 above {t.sentences.longestHardMax}</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-slate-700">Quality score</div>
          <ul className="mt-1 space-y-0.5 text-slate-600">
            <li>Coverage {t.quality.minCoverage}% → {t.quality.goodCoverage}% (60% of quality)</li>
            <li>Boundary cleanliness from longest-sentence length (40%)</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-slate-700">Translation</div>
          <ul className="mt-1 space-y-0.5 text-slate-600">
            <li>100 if sample translation succeeded, else 0</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

type SortKey =
  | "title"
  | "pipeline"
  | "transcript"
  | "sentences"
  | "translation"
  | "quality"
  | "words"
  | "sentcount";

function ScoredResultsTable({
  results,
  onOpen,
}: {
  results: BenchmarkResultRow[];
  onOpen: (r: BenchmarkResultRow) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("pipeline");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const enriched = results.map((r) => ({ r, s: computeScores(r), reasons: triggeredReasons(r) }));
    enriched.sort((a, b) => {
      const get = (x: typeof a) => {
        switch (sortKey) {
          case "title":
            return (x.r.video_title ?? x.r.video_id_ext ?? "").toLowerCase();
          case "pipeline":
            return x.s.pipeline;
          case "transcript":
            return x.s.transcript;
          case "sentences":
            return x.s.sentences;
          case "translation":
            return x.s.translation;
          case "quality":
            return x.s.quality;
          case "words":
            return x.r.transcript_word_count ?? 0;
          case "sentcount":
            return x.r.sentence_count ?? 0;
        }
      };
      const av = get(a);
      const bv = get(b);
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * (asc ? 1 : -1);
    });
    return enriched;
  }, [results, sortKey, asc]);

  if (!results.length) return null;

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      className="cursor-pointer select-none px-2 py-2 hover:text-slate-900"
      onClick={() => {
        if (sortKey === k) setAsc(!asc);
        else {
          setSortKey(k);
          setAsc(false);
        }
      }}
    >
      {label} {sortKey === k ? (asc ? "▲" : "▼") : ""}
    </th>
  );

  const cellColor = (v: number) =>
    v >= 80 ? "text-green-700" : v >= 60 ? "text-amber-700" : "text-red-700";

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Per-video Quality Breakdown{" "}
        <span className="font-normal normal-case text-slate-400">
          (click headers to sort, row for details)
        </span>
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <Th k="title" label="Video" />
              <th className="px-2 py-2">Source</th>
              <Th k="words" label="Words" />
              <Th k="sentcount" label="Sent." />
              <Th k="transcript" label="Transcript" />
              <Th k="sentences" label="Sentences" />
              <Th k="translation" label="Translation" />
              <Th k="quality" label="Quality" />
              <Th k="pipeline" label="Pipeline" />
              <th className="px-2 py-2">Why not High</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, s, reasons }) => (
              <tr
                key={r.id}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => onOpen(r)}
              >
                <td className="max-w-[16rem] truncate px-2 py-1" title={r.video_title ?? ""}>
                  {r.video_title ?? r.video_id_ext ?? "—"}
                </td>
                <td className="px-2 py-1 text-slate-600">{r.transcript_source ?? "—"}</td>
                <td className="px-2 py-1 tabular-nums">{r.transcript_word_count ?? 0}</td>
                <td className="px-2 py-1 tabular-nums">{r.sentence_count ?? 0}</td>
                <td className={`px-2 py-1 font-semibold tabular-nums ${cellColor(s.transcript)}`}>{s.transcript}</td>
                <td className={`px-2 py-1 font-semibold tabular-nums ${cellColor(s.sentences)}`}>{s.sentences}</td>
                <td className={`px-2 py-1 font-semibold tabular-nums ${cellColor(s.translation)}`}>{s.translation}</td>
                <td className={`px-2 py-1 font-semibold tabular-nums ${cellColor(s.quality)}`}>{s.quality}</td>
                <td className={`px-2 py-1 font-bold tabular-nums ${cellColor(s.pipeline)}`}>{s.pipeline}</td>
                <td className="px-2 py-1 text-[11px] text-amber-700">
                  {reasons.length === 0 ? (
                    <span className="text-green-700">—</span>
                  ) : (
                    reasons.map((c) => REASON_LABELS[c]).join(" · ")
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- Update Golden Dataset modal ----------

function UpdateGoldenDatasetButton({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
      >
        Update Golden Dataset
      </button>
      {open && (
        <UpdateGoldenDatasetModal
          onClose={() => setOpen(false)}
          onSaved={() => {
            onSaved();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

type ParsedEntry = {
  youtube_url: string;
  video_id?: string;
  title?: string | null;
  category?: string | null;
  difficulty?: string | null;
  language?: string | null;
  active?: boolean;
  notes?: string | null;
};

function parseDatasetPayload(input: string): ParsedEntry[] {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste a JSON array or one YouTube URL per line.");

  // Try JSON first.
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.videos) ? parsed.videos : null;
    if (!arr) throw new Error("JSON must be an array, or an object with a `videos` array.");
    return arr.map((row: unknown, i: number) => {
      if (typeof row === "string") return { youtube_url: row };
      if (!row || typeof row !== "object" || typeof (row as ParsedEntry).youtube_url !== "string") {
        throw new Error(`Row ${i + 1}: missing "youtube_url" string.`);
      }
      return row as ParsedEntry;
    });
  }

  // Otherwise treat as one URL per line.
  return trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((youtube_url) => ({ youtube_url }));
}

function pickField(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (keys.includes(norm)) {
      const v = row[k];
      if (v == null) return null;
      const s = String(v).trim();
      return s ? s : null;
    }
  }
  return null;
}

/** Map free-form spreadsheet rows (e.g. the ValidationBenchmark .xlsx) to
 *  ParsedEntry objects. Recognizes URL/Title/Category/Language/Difficulty/Notes
 *  in any case, with or without spaces. */
function rowsToEntries(rows: Record<string, unknown>[]): ParsedEntry[] {
  const out: ParsedEntry[] = [];
  for (const row of rows) {
    const url = pickField(row, ["url", "youtubeurl", "videourl", "link"]);
    if (!url) continue;
    out.push({
      youtube_url: url,
      title: pickField(row, ["title", "name"]),
      category: pickField(row, ["category", "type"]),
      language: pickField(row, ["language", "lang"]),
      difficulty: pickField(row, ["difficulty", "level"]),
      notes: pickField(row, ["notes", "note", "comment", "comments"]),
      active: true,
    });
  }
  if (!out.length) throw new Error("No rows with a URL column found in the spreadsheet.");
  return out;
}

function UpdateGoldenDatasetModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const upsert = useServerFn(upsertBenchmarkVideos);
  const exportFn = useServerFn(exportBenchmarkVideos);
  const [text, setText] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UpsertBenchmarkResult | null>(null);

  const saveMut = useMutation({
    mutationFn: async () => {
      const videos = parseDatasetPayload(text);
      return upsert({ data: { videos, replaceMode } });
    },
    onSuccess: (r) => {
      setResult(r);
      setError(null);
      if (r.errors.length === 0) onSaved();
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const onFile = async (file: File) => {
    setError(null);
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const XLSX = (await import(/* @vite-ignore */ "xlsx/dist/xlsx.full.min.js")) as typeof import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
        const entries = rowsToEntries(rows);
        setText(JSON.stringify(entries, null, 2));
        setReplaceMode(true);
      } else {
        const reader = new FileReader();
        reader.onload = () => setText(String(reader.result ?? ""));
        reader.readAsText(file);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const downloadCurrent = async () => {
    try {
      const { videos } = await exportFn();
      const blob = new Blob([JSON.stringify(videos, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `benchmark-videos-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Update Golden Dataset</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="space-y-3 p-4 text-xs text-slate-700">
          <p>
            Upload a <code>.xlsx</code> / <code>.csv</code> file (auto-detects columns
            <em> URL</em>, <em>Title</em>, <em>Category</em>, <em>Language</em>,
            <em> Difficulty</em>, <em>Notes</em>), paste a JSON array of{" "}
            <code>{`{ youtube_url, title?, category?, difficulty?, language?, active?, notes? }`}</code>{" "}
            objects, or paste one YouTube URL per line. Matched on <code>video_id</code> —
            existing rows are updated, new ones inserted. Uploading a spreadsheet auto-enables
            <strong> Replace mode</strong> so the dataset mirrors the file.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".json,.txt,.csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
              className="text-xs"
            />
            <button
              onClick={downloadCurrent}
              className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
            >
              Download current
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`[\n  { "youtube_url": "https://youtu.be/abc12345678", "category": "TED" },\n  "https://youtu.be/def12345678"\n]`}
            className="h-64 w-full rounded border border-slate-300 p-2 font-mono text-xs"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={replaceMode}
              onChange={(e) => setReplaceMode(e.target.checked)}
            />
            <span>
              Replace mode — deactivate any video <em>not</em> in this payload (no rows
              deleted).
            </span>
          </label>
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-red-700">{error}</div>
          )}
          {result && (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">
              Inserted {result.inserted} · Updated {result.updated} · Deactivated{" "}
              {result.deactivated}
              {result.errors.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-red-700">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>
                      {e.youtube_url}: {e.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-3">
          <button
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-100"
          >
            Close
          </button>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !text.trim()}
            className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saveMut.isPending ? "Saving…" : "Save dataset"}
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtTime(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const m = Math.floor(n / 60);
  const sec = Math.floor(n % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function RepairColumn({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ label: string; text: string }>;
  empty?: string;
}) {
  return (
    <div className="overflow-hidden rounded border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
        {title}
      </div>
      <div className="max-h-72 overflow-y-auto p-1 text-[11px]">
        {items.length === 0 ? (
          <div className="px-2 py-3 text-center text-slate-400">{empty ?? "—"}</div>
        ) : (
          items.map((it, i) => (
            <div key={i} className="border-b border-slate-100 px-2 py-1 last:border-0">
              <div className="font-mono text-[10px] text-slate-500">{it.label}</div>
              <div className="text-slate-800">{it.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------- AI Repair Validation drilldown ----------

type PreviewSentence = { text: string; start: number; end: number; words: number };
type RawChunkPreview = { i: number; start: number; end: number; text: string };

type CheckStatus = "pass" | "fail" | "skip" | "info";
type ValidationCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  threshold?: string;
};

function tokenizeText(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function multisetOverlapPct(a: string[], b: string[]): number {
  const ma = new Map<string, number>();
  for (const t of a) ma.set(t, (ma.get(t) ?? 0) + 1);
  const mb = new Map<string, number>();
  for (const t of b) mb.set(t, (mb.get(t) ?? 0) + 1);
  let inter = 0;
  for (const [k, v] of ma) {
    const w = mb.get(k);
    if (w) inter += Math.min(v, w);
  }
  return inter / Math.max(a.length, b.length, 1);
}

function computeValidationChecks(args: {
  rawChunks: RawChunkPreview[];
  repaired: PreviewSentence[] | null;
}): ValidationCheck[] {
  const { rawChunks, repaired } = args;
  const checks: ValidationCheck[] = [];

  if (!repaired || repaired.length === 0) {
    checks.push({
      key: "output",
      label: "AI returned sentences",
      status: "fail",
      detail: "No output captured from model",
    });
    return checks;
  }

  checks.push({
    key: "output",
    label: "AI returned sentences",
    status: "pass",
    detail: `${repaired.length} preview unit(s)`,
  });

  // Word-count ratio (preview window only)
  const srcWords = rawChunks.reduce((n, c) => n + tokenizeText(c.text).length, 0);
  const dstWords = repaired.reduce((n, s) => n + tokenizeText(s.text).length, 0);
  const ratio = srcWords > 0 ? dstWords / srcWords : 0;
  const ratioOk = ratio >= 0.7 && ratio <= 1.3;
  checks.push({
    key: "ratio",
    label: "Content size ratio",
    status: rawChunks.length === 0 ? "skip" : ratioOk ? "pass" : "fail",
    detail: rawChunks.length === 0 ? "no raw preview" : `${ratio.toFixed(2)} (${dstWords}w / ${srcWords}w)`,
    threshold: "0.70 – 1.30",
  });

  // Token overlap
  const srcTok = rawChunks.flatMap((c) => tokenizeText(c.text));
  const dstTok = repaired.flatMap((s) => tokenizeText(s.text));
  const overlap = multisetOverlapPct(srcTok, dstTok);
  checks.push({
    key: "overlap",
    label: "Token overlap (multiset)",
    status: rawChunks.length === 0 ? "skip" : overlap >= 0.7 ? "pass" : "fail",
    detail: rawChunks.length === 0 ? "no raw preview" : `${(overlap * 100).toFixed(0)}%`,
    threshold: "≥ 70%",
  });

  // Timestamps present + end ≥ start
  const badTs = repaired.filter(
    (s) => !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.end < s.start,
  );
  checks.push({
    key: "timestamps",
    label: "Timestamps present & end ≥ start",
    status: badTs.length === 0 ? "pass" : "fail",
    detail: badTs.length === 0 ? "all valid" : `${badTs.length} invalid unit(s)`,
  });

  // Monotonic order
  let monoFails = 0;
  let lastEnd = -Infinity;
  for (const s of repaired) {
    if (s.start + 0.5 < lastEnd) monoFails += 1;
    lastEnd = s.end;
  }
  checks.push({
    key: "monotonic",
    label: "Monotonic ordering",
    status: monoFails === 0 ? "pass" : "fail",
    detail: monoFails === 0 ? "in order" : `${monoFails} out-of-order unit(s)`,
  });

  // In range of source
  if (rawChunks.length > 0) {
    const srcStart = rawChunks[0].start;
    const srcEnd = rawChunks[rawChunks.length - 1].end;
    const outOfRange = repaired.filter(
      (s) => s.start < srcStart - 1 || s.end > srcEnd + 1,
    ).length;
    checks.push({
      key: "range",
      label: "Timestamps within source range",
      status: outOfRange === 0 ? "pass" : "fail",
      detail:
        outOfRange === 0
          ? `${fmtTime(srcStart)}–${fmtTime(srcEnd)}`
          : `${outOfRange} unit(s) outside ${fmtTime(srcStart)}–${fmtTime(srcEnd)} (±1s)`,
    });
  } else {
    checks.push({
      key: "range",
      label: "Timestamps within source range",
      status: "skip",
      detail: "no raw preview",
    });
  }

  return checks;
}

function statusBadge(s: CheckStatus): { label: string; cls: string } {
  switch (s) {
    case "pass":
      return { label: "PASS", cls: "bg-green-100 text-green-800 border-green-200" };
    case "fail":
      return { label: "FAIL", cls: "bg-red-100 text-red-800 border-red-200" };
    case "skip":
      return { label: "SKIP", cls: "bg-slate-100 text-slate-600 border-slate-200" };
    default:
      return { label: "INFO", cls: "bg-blue-100 text-blue-800 border-blue-200" };
  }
}

function RepairValidationPanel({
  accepted,
  reason,
  validationError,
  httpStatus,
  rawChunks,
  repaired,
}: {
  accepted: boolean;
  reason: string | null;
  validationError: string | null;
  httpStatus: number | null;
  rawChunks: RawChunkPreview[];
  repaired: PreviewSentence[] | null;
}) {
  const checks = useMemo(
    () => computeValidationChecks({ rawChunks, repaired }),
    [rawChunks, repaired],
  );

  // Outcome derivation: prefer recorded reason; surface ai_call_failed vs validation_failed clearly.
  let outcome: { label: string; cls: string; sub: string };
  if (accepted) {
    outcome = {
      label: "Accepted",
      cls: "bg-green-50 border-green-200 text-green-900",
      sub: reason ?? "all validation checks passed",
    };
  } else if (reason?.startsWith("ai_call_failed")) {
    outcome = {
      label: "Fallback — AI call failed",
      cls: "bg-amber-50 border-amber-200 text-amber-900",
      sub: `${reason}${httpStatus != null ? ` · HTTP ${httpStatus}` : ""}`,
    };
  } else if (reason?.startsWith("validation_failed")) {
    outcome = {
      label: "Fallback — validation failed",
      cls: "bg-red-50 border-red-200 text-red-900",
      sub: validationError ?? reason,
    };
  } else {
    outcome = {
      label: "Fallback",
      cls: "bg-slate-50 border-slate-200 text-slate-800",
      sub: reason ?? "deterministic output used",
    };
  }

  return (
    <div className="mt-3 rounded border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          AI Repair Validation
        </div>
        <div className={`mt-1 inline-flex flex-col rounded border px-2 py-1 text-xs ${outcome.cls}`}>
          <span className="font-semibold">{outcome.label}</span>
          <span className="font-mono text-[11px] opacity-80">{outcome.sub}</span>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {checks.map((c) => {
          const b = statusBadge(c.status);
          return (
            <div key={c.key} className="flex items-start gap-3 px-3 py-1.5 text-xs">
              <span
                className={`inline-block w-12 shrink-0 rounded border px-1 py-0.5 text-center font-mono text-[10px] ${b.cls}`}
              >
                {b.label}
              </span>
              <div className="flex-1">
                <div className="font-medium text-slate-800">{c.label}</div>
                <div className="font-mono text-[11px] text-slate-600">
                  {c.detail}
                  {c.threshold ? <span className="ml-2 text-slate-400">[{c.threshold}]</span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
        Checks are computed from the captured preview window (first {rawChunks.length} raw chunks ·{" "}
        {repaired?.length ?? 0} repaired units). Server-side validation runs over the full transcript and
        is reflected in the outcome banner above.
      </div>
    </div>
  );
}
