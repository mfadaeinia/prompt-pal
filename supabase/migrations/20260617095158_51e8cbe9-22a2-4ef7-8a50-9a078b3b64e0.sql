
ALTER TABLE public.benchmark_video_results
  ADD COLUMN IF NOT EXISTS transcript_text text,
  ADD COLUMN IF NOT EXISTS transcript_preview text,
  ADD COLUMN IF NOT EXISTS reviewed_by_founder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS transcript_truth_label text NOT NULL DEFAULT 'not_reviewed',
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS sampling_bucket text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'benchmark_video_results_truth_label_check'
  ) THEN
    ALTER TABLE public.benchmark_video_results
      ADD CONSTRAINT benchmark_video_results_truth_label_check
      CHECK (transcript_truth_label IN ('accurate','mostly_accurate','incorrect','not_reviewed'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'benchmark_video_results_sampling_bucket_check'
  ) THEN
    ALTER TABLE public.benchmark_video_results
      ADD CONSTRAINT benchmark_video_results_sampling_bucket_check
      CHECK (sampling_bucket IS NULL OR sampling_bucket IN ('high','medium','low'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS benchmark_video_results_truth_label_idx
  ON public.benchmark_video_results (transcript_truth_label);
CREATE INDEX IF NOT EXISTS benchmark_video_results_reviewed_idx
  ON public.benchmark_video_results (reviewed_by_founder, run_id);
