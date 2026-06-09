
CREATE TABLE public.youtube_transcript_cache (
  video_id TEXT PRIMARY KEY,
  video_url TEXT NOT NULL,
  transcript_json JSONB NOT NULL,
  language TEXT,
  source TEXT NOT NULL DEFAULT 'youtube',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.youtube_transcript_cache TO anon, authenticated;
GRANT ALL ON public.youtube_transcript_cache TO service_role;

ALTER TABLE public.youtube_transcript_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read transcript cache"
  ON public.youtube_transcript_cache
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER youtube_transcript_cache_set_updated_at
BEFORE UPDATE ON public.youtube_transcript_cache
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
