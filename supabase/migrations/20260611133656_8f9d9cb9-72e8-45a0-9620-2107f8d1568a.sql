ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS comprehension_helpful text,
  ADD COLUMN IF NOT EXISTS vs_current_workflow text,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS explanations_opened integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_segments_clicked integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_own_video boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_language text,
  ADD COLUMN IF NOT EXISTS seconds_watched integer DEFAULT 0;