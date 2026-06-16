
CREATE TABLE public.tester_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_id text NOT NULL,
  event_name text NOT NULL,
  session_id text,
  video_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tester_events_tester_id_idx ON public.tester_events (tester_id);
CREATE INDEX tester_events_created_at_idx ON public.tester_events (created_at DESC);
CREATE INDEX tester_events_event_name_idx ON public.tester_events (event_name);

GRANT SELECT, INSERT ON public.tester_events TO anon, authenticated;
GRANT ALL ON public.tester_events TO service_role;

ALTER TABLE public.tester_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tester_events_insert_any" ON public.tester_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
