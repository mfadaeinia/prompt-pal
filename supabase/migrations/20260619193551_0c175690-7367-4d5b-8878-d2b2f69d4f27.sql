
REVOKE EXECUTE ON FUNCTION public.claim_anonymous_saves(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_anonymous_saves(text) TO authenticated;
