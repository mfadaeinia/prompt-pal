
CREATE TABLE public.saved_expressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id text NOT NULL,
  sentence_text text NOT NULL,
  translation text,
  meaning text,
  expression_notes text,
  video_title text,
  video_url text,
  video_id text,
  timestamp_seconds integer NOT NULL DEFAULT 0,
  target_language text
);

GRANT SELECT, INSERT, DELETE ON public.saved_expressions TO anon;
GRANT SELECT, INSERT, DELETE ON public.saved_expressions TO authenticated;
GRANT ALL ON public.saved_expressions TO service_role;

ALTER TABLE public.saved_expressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read saved expressions"
  ON public.saved_expressions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert saved expressions"
  ON public.saved_expressions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete saved expressions"
  ON public.saved_expressions FOR DELETE
  USING (true);

CREATE INDEX saved_expressions_session_idx ON public.saved_expressions (session_id, created_at DESC);
