CREATE TABLE public.transcript_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','complete','failed')),
  detected_language TEXT,
  expected_language TEXT,
  audio_url TEXT,
  audio_url_fetched_at TIMESTAMPTZ,
  chunk_seconds INTEGER NOT NULL DEFAULT 90,
  assumed_kbps INTEGER NOT NULL DEFAULT 128,
  total_chunks INTEGER,
  completed_chunks INTEGER NOT NULL DEFAULT 0,
  whisper_reported_duration_s NUMERIC,
  chunks JSONB NOT NULL DEFAULT '[]'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ,
  first_chunk_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  time_to_first_clickable_sentence_ms INTEGER,
  time_to_full_transcript_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transcript_jobs_status_idx ON public.transcript_jobs (status);
CREATE INDEX transcript_jobs_updated_at_idx ON public.transcript_jobs (updated_at DESC);

GRANT SELECT ON public.transcript_jobs TO authenticated;
GRANT ALL ON public.transcript_jobs TO service_role;

ALTER TABLE public.transcript_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read transcript jobs"
  ON public.transcript_jobs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER set_transcript_jobs_updated_at
  BEFORE UPDATE ON public.transcript_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();