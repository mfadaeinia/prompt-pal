import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
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

        {cohortQ.data && <TesterCohortSection m={cohortQ.data} />}
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
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="px-2 py-1">When</th>
                <th className="px-2 py-1">Video</th>
                <th className="px-2 py-1">Source</th>
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
                  </td>
                  <td className="px-2 py-1 font-mono">{r.transcript_source ?? "—"}</td>
                  <td className={"px-2 py-1 font-medium " + qualityColor(r.quality_rating)}>{r.quality_rating}</td>
                  <td className="px-2 py-1">{r.sampling_bucket ?? "—"}</td>
                  <td className="max-w-md px-2 py-1 text-slate-600">
                    {r.transcript_preview ? r.transcript_preview.slice(0, 120) + (r.transcript_preview.length > 120 ? "…" : "") : "—"}
                  </td>
                  <td className="px-2 py-1">{truthBadge(r.transcript_truth_label)}</td>
                  <td className="px-2 py-1">
                    <button
                      onClick={() => { setOpenId(r.id === openId ? null : r.id); setNotes(""); }}
                      className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white hover:bg-slate-700"
                    >
                      {openId === r.id ? "Close" : "Review"}
                    </button>
                  </td>
                </tr>
              ))}
              {(queueQ.data ?? []).length === 0 && (
                <tr><td className="px-2 py-3 text-slate-400" colSpan={8}>No videos match the filters.</td></tr>
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
