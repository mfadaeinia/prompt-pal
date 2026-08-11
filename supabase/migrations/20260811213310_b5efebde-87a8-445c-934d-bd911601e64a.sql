ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS anonymous_id text;
ALTER TABLE public.video_sessions ADD COLUMN IF NOT EXISTS anonymous_id text;
ALTER TABLE public.library_events ADD COLUMN IF NOT EXISTS anonymous_id text;

CREATE INDEX IF NOT EXISTS page_views_anonymous_id_idx ON public.page_views (anonymous_id, created_at);
CREATE INDEX IF NOT EXISTS video_sessions_anonymous_id_idx ON public.video_sessions (anonymous_id, created_at);
CREATE INDEX IF NOT EXISTS library_events_anonymous_id_idx ON public.library_events (anonymous_id, created_at);