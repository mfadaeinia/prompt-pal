CREATE TABLE public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id text,
  feedback_type text NOT NULL CHECK (feedback_type IN ('positive','negative')),
  feedback_text text,
  would_use_again text CHECK (would_use_again IN ('definitely','maybe','probably_not')),
  email text,
  page_url text,
  total_sentence_clicks integer DEFAULT 0,
  time_on_page_seconds integer DEFAULT 0,
  demo_started boolean DEFAULT false,
  trigger_reason text
);

GRANT ALL ON public.user_feedback TO service_role;

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
