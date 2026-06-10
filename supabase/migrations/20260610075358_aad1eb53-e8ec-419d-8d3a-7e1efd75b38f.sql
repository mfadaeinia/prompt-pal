
CREATE TABLE public.feedback_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT,
  video_id TEXT,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive','negative')),
  useful_text TEXT,
  would_use_again TEXT CHECK (would_use_again IN ('definitely','maybe','probably_not')),
  trigger_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT INSERT ON public.feedback_responses TO anon, authenticated;
GRANT ALL ON public.feedback_responses TO service_role;
ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit feedback" ON public.feedback_responses FOR INSERT TO anon, authenticated WITH CHECK (true);
