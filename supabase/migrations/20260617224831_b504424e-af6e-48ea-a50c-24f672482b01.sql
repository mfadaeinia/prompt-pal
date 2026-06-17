
ALTER TABLE public.benchmark_runs
  ADD COLUMN IF NOT EXISTS pipeline_mode TEXT NOT NULL DEFAULT 'current';
ALTER TABLE public.benchmark_video_results
  ADD COLUMN IF NOT EXISTS pipeline_mode TEXT NOT NULL DEFAULT 'current';
CREATE INDEX IF NOT EXISTS benchmark_runs_pipeline_mode_idx
  ON public.benchmark_runs(pipeline_mode, run_date DESC);
CREATE INDEX IF NOT EXISTS benchmark_video_results_pipeline_mode_idx
  ON public.benchmark_video_results(pipeline_mode);
