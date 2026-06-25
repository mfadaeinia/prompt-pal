
-- 1. Release cohorts
CREATE TABLE public.release_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.release_cohorts TO service_role;
GRANT SELECT ON public.release_cohorts TO authenticated;

ALTER TABLE public.release_cohorts ENABLE ROW LEVEL SECURITY;

-- Only service role writes; authenticated may read (founder dashboard already gates by password,
-- but harmless to expose the list).
CREATE POLICY "release_cohorts_read_authenticated"
  ON public.release_cohorts FOR SELECT
  TO authenticated
  USING (true);

CREATE UNIQUE INDEX release_cohorts_one_active_idx
  ON public.release_cohorts ((is_active)) WHERE is_active;
CREATE INDEX release_cohorts_started_at_idx ON public.release_cohorts (started_at DESC);

-- 2. Seed baseline cohort (must exist before backfill)
INSERT INTO public.release_cohorts (name, description, started_at, ended_at, is_active)
VALUES (
  'v0.8 – Baseline',
  'All sessions recorded before versioned analytics shipped.',
  '2020-01-01T00:00:00Z',
  now(),
  false
);

-- 3. Active cohort: the current product version
INSERT INTO public.release_cohorts (name, description, started_at, is_active)
VALUES (
  'v0.12 – Versioned analytics',
  'First cohort scoped by release. Faster transcripts, sticky sentence, refined onboarding.',
  now(),
  true
);

-- 4. Add cohort_id + acquisition columns to analytics tables
DO $$
DECLARE
  baseline_id uuid;
  t text;
  tables text[] := ARRAY[
    'page_views',
    'video_sessions',
    'library_events',
    'saved_expressions',
    'saved_videos',
    'tester_events'
  ];
BEGIN
  SELECT id INTO baseline_id FROM public.release_cohorts WHERE name = 'v0.8 – Baseline' LIMIT 1;

  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS release_cohort_id uuid REFERENCES public.release_cohorts(id)', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS acquisition_source text', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS utm_source text', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS utm_medium text', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS utm_campaign text', t);
    -- backfill historical rows to baseline
    EXECUTE format('UPDATE public.%I SET release_cohort_id = %L WHERE release_cohort_id IS NULL', t, baseline_id);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (release_cohort_id, created_at DESC)', t || '_cohort_idx', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (acquisition_source)', t || '_acq_idx', t);
  END LOOP;
END$$;

-- video_sessions uses started_at, not created_at — add a more useful index variant
CREATE INDEX IF NOT EXISTS video_sessions_cohort_started_idx
  ON public.video_sessions (release_cohort_id, started_at DESC);
