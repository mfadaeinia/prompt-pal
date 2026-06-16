ALTER TABLE public.benchmark_video_results
  ADD COLUMN IF NOT EXISTS deterministic_quality text,
  ADD COLUMN IF NOT EXISTS ai_repair_used boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_repair_success boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_sentence_quality text,
  ADD COLUMN IF NOT EXISTS repair_reason text,
  ADD COLUMN IF NOT EXISTS repair_diagnostics jsonb;