CREATE TABLE public.experiment_markers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiment_markers TO authenticated;
GRANT ALL ON public.experiment_markers TO service_role;

ALTER TABLE public.experiment_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read experiment markers"
  ON public.experiment_markers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can add experiment markers"
  ON public.experiment_markers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update experiment markers"
  ON public.experiment_markers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete experiment markers"
  ON public.experiment_markers FOR DELETE TO authenticated USING (true);

CREATE INDEX experiment_markers_occurred_at_idx ON public.experiment_markers (occurred_at DESC);

CREATE TRIGGER experiment_markers_set_updated_at
  BEFORE UPDATE ON public.experiment_markers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();