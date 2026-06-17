ALTER TABLE public.benchmark_video_results
  ADD COLUMN IF NOT EXISTS asr_provider text,
  ADD COLUMN IF NOT EXISTS asr_model text,
  ADD COLUMN IF NOT EXISTS asr_http_status int,
  ADD COLUMN IF NOT EXISTS asr_error_body text,
  ADD COLUMN IF NOT EXISTS asr_segments_count int,
  ADD COLUMN IF NOT EXISTS asr_duration_ms int,
  ADD COLUMN IF NOT EXISTS asr_language text,
  ADD COLUMN IF NOT EXISTS asr_failure_code text;

CREATE INDEX IF NOT EXISTS benchmark_video_results_asr_provider_idx
  ON public.benchmark_video_results (asr_provider);