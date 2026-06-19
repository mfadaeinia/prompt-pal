
-- 1) Add user_id to saved_expressions
ALTER TABLE public.saved_expressions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS saved_expressions_user_idx
  ON public.saved_expressions (user_id, created_at DESC);

-- Lock down: only owner can read/write their rows. Anonymous (session-only) rows
-- remain accessible to the service role for claim/migration.
ALTER TABLE public.saved_expressions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_expressions TO authenticated;
GRANT ALL ON public.saved_expressions TO service_role;

DROP POLICY IF EXISTS "Users read own expressions" ON public.saved_expressions;
CREATE POLICY "Users read own expressions" ON public.saved_expressions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own expressions" ON public.saved_expressions;
CREATE POLICY "Users insert own expressions" ON public.saved_expressions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own expressions" ON public.saved_expressions;
CREATE POLICY "Users delete own expressions" ON public.saved_expressions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 2) New saved_videos table
CREATE TABLE IF NOT EXISTS public.saved_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  video_url text NOT NULL,
  video_title text,
  thumbnail_url text,
  target_language text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS saved_videos_user_idx
  ON public.saved_videos (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_videos TO authenticated;
GRANT ALL ON public.saved_videos TO service_role;

ALTER TABLE public.saved_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own videos" ON public.saved_videos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own videos" ON public.saved_videos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own videos" ON public.saved_videos
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 3) Claim anonymous saved expressions for the current user on first login
CREATE OR REPLACE FUNCTION public.claim_anonymous_saves(_session_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  claimed integer := 0;
BEGIN
  IF uid IS NULL OR _session_id IS NULL OR length(_session_id) = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.saved_expressions
     SET user_id = uid
   WHERE session_id = _session_id
     AND user_id IS NULL;

  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_anonymous_saves(text) TO authenticated;
