
ALTER TABLE public.benchmark_video_results
  ADD COLUMN IF NOT EXISTS transcribr_invoked boolean,
  ADD COLUMN IF NOT EXISTS transcribr_status integer,
  ADD COLUMN IF NOT EXISTS transcribr_error text,
  ADD COLUMN IF NOT EXISTS transcribr_segments_count integer,
  ADD COLUMN IF NOT EXISTS transcribr_duration_ms integer,
  ADD COLUMN IF NOT EXISTS provider_error text;
