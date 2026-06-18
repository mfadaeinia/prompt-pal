DROP POLICY IF EXISTS "authenticated can read transcript jobs" ON public.transcript_jobs;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.transcript_jobs FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.transcript_jobs FROM anon;