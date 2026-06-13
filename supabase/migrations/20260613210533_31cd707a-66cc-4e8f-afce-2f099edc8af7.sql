DROP POLICY IF EXISTS "Anyone can delete saved expressions" ON public.saved_expressions;
DROP POLICY IF EXISTS "Anyone can insert saved expressions" ON public.saved_expressions;
DROP POLICY IF EXISTS "Anyone can read saved expressions" ON public.saved_expressions;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.saved_expressions FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.saved_expressions FROM authenticated;
GRANT ALL ON public.saved_expressions TO service_role;