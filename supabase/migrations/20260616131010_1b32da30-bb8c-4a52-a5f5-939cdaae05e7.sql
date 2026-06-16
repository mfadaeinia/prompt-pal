
ALTER TABLE public.benchmark_video_results
  ADD COLUMN IF NOT EXISTS short_fragment_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS giant_sentence_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS punctuation_coverage_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS median_gap_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS sentence_quality_rating TEXT,
  ADD COLUMN IF NOT EXISTS sentence_quality_reason TEXT,
  ADD COLUMN IF NOT EXISTS sentence_preview JSONB;
