import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
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
  const cohortFetcher = useServerFn(getTesterCohort);
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
  const cohortQ = useQuery({
    queryKey: ["tester-cohort"],
    queryFn: () => cohortFetcher(),
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
              cohortQ.refetch();
            }}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          >
            {isFetching || libQ.isFetching || txQ.isFetching || cohortQ.isFetching
              ? "Refreshing…"
              : "Refresh"}
          </button>
        </header>

        <AsrProbeSection />
        {cohortQ.data && <TesterCohortSection m={cohortQ.data} />}
        <PipelineTraceSection />
        <TranscriptCacheTools />
        <TranscriptTruthSection />
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

function TesterCohortSection({ m }: { m: TesterCohortMetrics }) {
  function downloadCsv() {
    const headers = [
      "tester_id",
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
    const escape = (v: string | number | boolean) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(","),
      ...m.testers.map((t) =>
        [
          t.tester_id,
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          User Test Cohort
        </h2>
        <button
          onClick={downloadCsv}
          disabled={m.testers.length === 0}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Export CSV
        </button>
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
              <th className="px-2 py-2">Tester</th>
              <th className="px-2 py-2">First seen</th>
              <th className="px-2 py-2">Last seen</th>
              <th className="px-2 py-2">Sessions</th>
              <th className="px-2 py-2">Videos</th>
              <th className="px-2 py-2">Clicks</th>
              <th className="px-2 py-2">Saved</th>
              <th className="px-2 py-2">Feedback</th>
              <th className="px-2 py-2">Activated</th>
              <th className="px-2 py-2">Returned&nbsp;7d</th>
            </tr>
          </thead>
          <tbody>
            {m.testers.map((t: TesterRow) => (
              <tr key={t.tester_id} className="border-t border-slate-100">
                <td className="px-2 py-1 font-mono">{t.tester_id}</td>
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
            {m.testers.length === 0 && (
              <tr>
                <td className="px-2 py-3 text-slate-400" colSpan={10}>
                  No tester activity yet. Share links like{" "}
                  <code>/?ref=tester_001</code> to start tracking.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
        <Row k="language" v={trace.step2_cache.language ?? "—"} />
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
        )}
      </div>
    </section>
  );
}
