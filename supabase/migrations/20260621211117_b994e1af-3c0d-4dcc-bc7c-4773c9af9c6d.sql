
ALTER TABLE public.library_events ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.video_sessions ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS library_events_user_id_idx ON public.library_events(user_id);
CREATE INDEX IF NOT EXISTS video_sessions_user_id_idx ON public.video_sessions(user_id);
CREATE INDEX IF NOT EXISTS library_events_event_name_idx ON public.library_events(event_name);

WITH s2u AS (
  SELECT DISTINCT ON (session_id) session_id, user_id
  FROM (
    SELECT session_id, user_id, created_at FROM public.saved_expressions WHERE user_id IS NOT NULL
    UNION ALL
    SELECT session_id, user_id, created_at FROM public.saved_videos WHERE user_id IS NOT NULL
  ) x
  ORDER BY session_id, created_at DESC
)
UPDATE public.library_events le
SET user_id = s2u.user_id
FROM s2u
WHERE le.user_id IS NULL AND le.session_id = s2u.session_id;

WITH s2u AS (
  SELECT DISTINCT ON (session_id) session_id, user_id
  FROM (
    SELECT session_id, user_id, created_at FROM public.saved_expressions WHERE user_id IS NOT NULL
    UNION ALL
    SELECT session_id, user_id, created_at FROM public.saved_videos WHERE user_id IS NOT NULL
  ) x
  ORDER BY session_id, created_at DESC
)
UPDATE public.video_sessions vs
SET user_id = s2u.user_id
FROM s2u
WHERE vs.user_id IS NULL AND vs.session_id = s2u.session_id;
