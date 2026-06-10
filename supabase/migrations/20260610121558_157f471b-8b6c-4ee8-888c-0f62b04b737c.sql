CREATE TABLE public.video_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  video_id text NOT NULL,
  video_url text,
  target_language text,
  page_url text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL DEFAULT 0,
  ended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_sessions_session_video_unique UNIQUE (session_id, video_id)
);

GRANT ALL ON public.video_sessions TO service_role;

ALTER TABLE public.video_sessions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER video_sessions_set_updated_at
  BEFORE UPDATE ON public.video_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX video_sessions_video_id_idx ON public.video_sessions (video_id);
CREATE INDEX video_sessions_started_at_idx ON public.video_sessions (started_at DESC);