CREATE TABLE public.early_access_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL UNIQUE,
  page_url text,
  source text,
  session_id text,
  target_language text,
  current_dutch_level text
);

GRANT ALL ON public.early_access_signups TO service_role;

ALTER TABLE public.early_access_signups ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated — all writes go through a server function
-- using the service role key, which bypasses RLS. To view signups manually:
-- Supabase → Table Editor → early_access_signups.