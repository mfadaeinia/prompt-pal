CREATE TABLE public.library_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  session_id TEXT,
  video_id TEXT,
  expression_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.library_events TO service_role;
ALTER TABLE public.library_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX library_events_event_name_idx ON public.library_events(event_name);
CREATE INDEX library_events_session_id_idx ON public.library_events(session_id);
CREATE INDEX library_events_created_at_idx ON public.library_events(created_at DESC);