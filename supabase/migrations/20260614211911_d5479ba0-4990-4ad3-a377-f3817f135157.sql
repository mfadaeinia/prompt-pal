
CREATE TABLE public.video_transcript_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id text NOT NULL,
  video_url text,
  video_title text,
  transcript_source text NOT NULL,
  language text,
  sentence_count integer NOT NULL DEFAULT 0,
  avg_sentence_length numeric NOT NULL DEFAULT 0,
  quality_score text NOT NULL,
  quality_reasons text[] NOT NULL DEFAULT '{}',
  full_learning_enabled boolean NOT NULL DEFAULT false,
  limited_mode_enabled boolean NOT NULL DEFAULT false,
  explanation_generation_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.video_transcript_reports TO service_role;

ALTER TABLE public.video_transcript_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_vtr_created_at ON public.video_transcript_reports (created_at DESC);
CREATE INDEX idx_vtr_video_id ON public.video_transcript_reports (video_id);
CREATE INDEX idx_vtr_source ON public.video_transcript_reports (transcript_source);
