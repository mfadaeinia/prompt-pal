
ALTER TABLE public.benchmark_video_results
  ADD COLUMN IF NOT EXISTS video_url_status text,
  ADD COLUMN IF NOT EXISTS http_status_code integer,
  ADD COLUMN IF NOT EXISTS download_status text,
  ADD COLUMN IF NOT EXISTS download_size_mb numeric,
  ADD COLUMN IF NOT EXISTS cache_hit boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS transcript_generated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS transcript_length_chars integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS translation_generated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pipeline_logs jsonb;
