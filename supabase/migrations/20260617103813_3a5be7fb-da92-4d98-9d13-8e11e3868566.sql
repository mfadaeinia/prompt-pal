-- 1. Purge poisoned cache rows
DELETE FROM public.youtube_transcript_cache
WHERE provider = 'asr' OR provider IS NULL OR provider NOT IN ('youtube','fallback','manual');

-- 2. Lock down allowed providers going forward
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'youtube_transcript_cache_provider_check') THEN
    ALTER TABLE public.youtube_transcript_cache
      ADD CONSTRAINT youtube_transcript_cache_provider_check
      CHECK (provider IN ('youtube','fallback','manual'));
  END IF;
END$$;

-- 3. Provenance columns on benchmark_video_results
ALTER TABLE public.benchmark_video_results
  ADD COLUMN IF NOT EXISTS cache_row_id uuid,
  ADD COLUMN IF NOT EXISTS cache_key text,
  ADD COLUMN IF NOT EXISTS cache_validation_status text NOT NULL DEFAULT 'unreviewed';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'benchmark_video_results_cache_validation_check') THEN
    ALTER TABLE public.benchmark_video_results
      ADD CONSTRAINT benchmark_video_results_cache_validation_check
      CHECK (cache_validation_status IN ('valid','suspect','corrupted','unreviewed'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS benchmark_video_results_cache_row_idx
  ON public.benchmark_video_results (cache_row_id);