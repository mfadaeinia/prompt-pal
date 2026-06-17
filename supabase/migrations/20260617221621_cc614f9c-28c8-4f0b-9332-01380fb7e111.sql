
ALTER TABLE public.benchmark_video_results
  ADD COLUMN IF NOT EXISTS extractor_provider text,
  ADD COLUMN IF NOT EXISTS extractor_http_status int,
  ADD COLUMN IF NOT EXISTS extractor_response_status text,
  ADD COLUMN IF NOT EXISTS extractor_response_body text,
  ADD COLUMN IF NOT EXISTS extractor_audio_url_found boolean,
  ADD COLUMN IF NOT EXISTS extractor_audio_url text,
  ADD COLUMN IF NOT EXISTS extractor_latency_ms int,
  ADD COLUMN IF NOT EXISTS extractor_failure_reason text,
  ADD COLUMN IF NOT EXISTS openai_invoked boolean;
