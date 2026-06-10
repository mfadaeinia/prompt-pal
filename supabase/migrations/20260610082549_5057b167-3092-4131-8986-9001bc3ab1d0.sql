DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback_responses;
REVOKE INSERT, SELECT, UPDATE, DELETE ON public.feedback_responses FROM anon, authenticated;
GRANT ALL ON public.feedback_responses TO service_role;