## Goal

Add a human-in-the-loop transcript correctness layer on top of the existing benchmark. Lets you mark whether a benchmark transcript actually matches the spoken video, then surfaces accuracy as a first-class KPI separate from "generation success" and "quality score".

## 1. DB migration — extend `benchmark_video_results`

Add columns (nullable, non-breaking):
- `transcript_text text` — full transcript captured at benchmark time
- `transcript_preview text` — first 200 chars (denormalized for the queue list)
- `reviewed_by_founder boolean default false`
- `reviewed_at timestamptz`
- `transcript_truth_label text check in ('accurate','mostly_accurate','incorrect','not_reviewed') default 'not_reviewed'`
- `review_notes text`
- `sampling_bucket text check in ('high','medium','low')` — set when auto-sampled for review

Indexes on `(transcript_truth_label)` and `(reviewed_by_founder, run_id)`.

No GRANT/RLS changes — this table is server-only via `supabaseAdmin`.

## 2. Capture transcript text during benchmark runs

In `processBenchmarkVideo` (src/lib/benchmark.functions.ts), persist the assembled transcript string + first 200 chars into the new columns alongside existing metrics. No behavior change for runs.

## 3. Auto-sampling (Phase 7)

After `finalizeBenchmarkRun`, pick up to 5 results per bucket (highest / medium / lowest by pipeline score) for that run and tag `sampling_bucket`. Those rows show up in the queue first; founder can still review any row.

## 4. Server functions (new file `src/lib/transcript-review.functions.ts`)

- `getTranscriptReviewQueue({ filter })` — returns rows with id, video title/url, source, preview, scores, truth_label, reviewed flag, sampling_bucket. Filters: `score: 'high'|'medium'|'low'|'all'`, `source: string|'all'`, `reviewed: 'all'|'unreviewed'|'reviewed'`, `limit`.
- `getTranscriptReviewDetail({ resultId })` — full transcript_text + metrics + scores.
- `setTranscriptTruthLabel({ resultId, label, notes? })` — writes label, sets reviewed flag + timestamp.
- `getTranscriptAccuracyMetrics()` — totals: reviewed count, accuracy %, per-source breakdown (videos reviewed + accuracy rate), generation-vs-quality-vs-accuracy comparison (latest run), insights array (rule-based strings).

All use `supabaseAdmin` inside the handler. No auth middleware (founder route is password-gated already).

## 5. UI in `src/routes/founder.tsx`

New section `<TranscriptTruthSection />` placed above `BenchmarkSection`, containing:

- **KPI row**: Generation Success %, Quality Score %, Transcript Accuracy % (with `41 / 45 reviewed`).
- **Source Accuracy table**: source · videos reviewed · accuracy %.
- **Insights list**: bullet observations generated server-side.
- **Review Queue**: filter dropdowns (score bucket / source / reviewed) + table. Each row has a "Review" button opening an inline detail panel (no modal lib) with title, URL link, source, preview, scrollable full transcript, scores, and three buttons: ✓ Accurate, △ Mostly Accurate, ✗ Incorrect. Optional notes textarea. Submitting refetches queue + metrics.

## Out of scope

- No changes to consumer-facing transcript/learning flow.
- No automated ground-truth check (e.g. Whisper diff) — that's a future layer.
- No changes to existing benchmark scoring weights.

## Technical notes

- Server fns return plain DTOs.
- Sampling runs inside `finalizeBenchmarkRun` so no new cron.
- `transcript_text` may be large; queue list query selects preview only, detail query selects full text.
- Migration includes only ALTERs; no GRANTs needed since table is admin-only.
