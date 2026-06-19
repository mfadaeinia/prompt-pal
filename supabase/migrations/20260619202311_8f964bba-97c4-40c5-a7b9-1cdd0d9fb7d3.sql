-- Restrict youtube_transcript_cache to service role only
DROP POLICY IF EXISTS "Public read transcript cache" ON public.youtube_transcript_cache;
DROP POLICY IF EXISTS "Allow public read access" ON public.youtube_transcript_cache;
DROP POLICY IF EXISTS "Anyone can read transcript cache" ON public.youtube_transcript_cache;

-- Drop any remaining permissive SELECT policies for anon/authenticated
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.youtube_transcript_cache'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.youtube_transcript_cache', r.polname);
  END LOOP;
END $$;

REVOKE ALL ON public.youtube_transcript_cache FROM anon, authenticated;
GRANT ALL ON public.youtube_transcript_cache TO service_role;
