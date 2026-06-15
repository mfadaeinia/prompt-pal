
-- benchmark_videos
CREATE TABLE public.benchmark_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_url TEXT NOT NULL,
  video_id TEXT NOT NULL UNIQUE,
  title TEXT,
  category TEXT NOT NULL CHECK (category IN ('TED','Podcast','Interview','Educational','News')),
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  language TEXT NOT NULL DEFAULT 'en',
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.benchmark_videos TO service_role;
ALTER TABLE public.benchmark_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only - benchmark_videos"
  ON public.benchmark_videos FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_benchmark_videos_updated BEFORE UPDATE ON public.benchmark_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- benchmark_runs
CREATE TABLE public.benchmark_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  release_version TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('quick','full')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  total_videos INT NOT NULL DEFAULT 0,
  transcript_success_count INT NOT NULL DEFAULT 0,
  sentence_success_count INT NOT NULL DEFAULT 0,
  translation_success_count INT NOT NULL DEFAULT 0,
  pipeline_success_count INT NOT NULL DEFAULT 0,
  transcript_success_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  sentence_success_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  translation_success_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  pipeline_success_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.benchmark_runs TO service_role;
ALTER TABLE public.benchmark_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only - benchmark_runs"
  ON public.benchmark_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_benchmark_runs_updated BEFORE UPDATE ON public.benchmark_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX benchmark_runs_run_date_idx ON public.benchmark_runs(run_date DESC);

-- benchmark_video_results
CREATE TABLE public.benchmark_video_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.benchmark_runs(id) ON DELETE CASCADE,
  benchmark_video_id UUID NOT NULL REFERENCES public.benchmark_videos(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  transcript_found BOOLEAN NOT NULL DEFAULT false,
  transcript_source TEXT,
  transcript_word_count INT NOT NULL DEFAULT 0,
  sentence_count INT NOT NULL DEFAULT 0,
  avg_sentence_length NUMERIC(6,2) NOT NULL DEFAULT 0,
  longest_sentence_words INT NOT NULL DEFAULT 0,
  coverage_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  translation_success BOOLEAN NOT NULL DEFAULT false,
  quality_rating TEXT NOT NULL DEFAULT 'low' CHECK (quality_rating IN ('high','medium','low')),
  quality_reason TEXT,
  failure_code TEXT,
  processing_time_ms INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.benchmark_video_results TO service_role;
ALTER TABLE public.benchmark_video_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only - benchmark_video_results"
  ON public.benchmark_video_results FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX benchmark_video_results_run_idx ON public.benchmark_video_results(run_id);

-- Seed 10 curated TED Talks (Quick benchmark default set)
INSERT INTO public.benchmark_videos (youtube_url, video_id, title, category, difficulty, language) VALUES
  ('https://www.youtube.com/watch?v=iCvmsMzlF7o','iCvmsMzlF7o','Brené Brown: The power of vulnerability','TED','medium','en'),
  ('https://www.youtube.com/watch?v=qp0HIF3SfI4','qp0HIF3SfI4','Simon Sinek: How great leaders inspire action','TED','medium','en'),
  ('https://www.youtube.com/watch?v=arj7oStGLkU','arj7oStGLkU','Tim Urban: Inside the mind of a master procrastinator','TED','easy','en'),
  ('https://www.youtube.com/watch?v=c0KYU2j0TM4','c0KYU2j0TM4','Mary Roach: 10 things you didn''t know about orgasm','TED','medium','en'),
  ('https://www.youtube.com/watch?v=c0bsKc4tiuY','c0bsKc4tiuY','Susan Cain: The power of introverts','TED','medium','en'),
  ('https://www.youtube.com/watch?v=Ks-_Mh1QhMc','Ks-_Mh1QhMc','Your body language may shape who you are — Amy Cuddy','TED','medium','en'),
  ('https://www.youtube.com/watch?v=8jPQjjsBbIc','8jPQjjsBbIc','Sir Ken Robinson: Do schools kill creativity?','TED','easy','en'),
  ('https://www.youtube.com/watch?v=eIho2S0ZahI','eIho2S0ZahI','How to speak so that people want to listen — Julian Treasure','TED','medium','en'),
  ('https://www.youtube.com/watch?v=ZSHk0I9aBfM','ZSHk0I9aBfM','Brian Little: Who are you, really? The puzzle of personality','TED','medium','en'),
  ('https://www.youtube.com/watch?v=H14bBuluwB8','H14bBuluwB8','Grit: the power of passion and perseverance — Angela Lee Duckworth','TED','easy','en');

-- Seed placeholder slots for the other 4 categories (Founder can swap URLs later)
INSERT INTO public.benchmark_videos (youtube_url, video_id, title, category, difficulty, language, active, notes) VALUES
  ('https://www.youtube.com/watch?v=PLACEHOLD_P1','PLACEHOLD_P1','Podcast placeholder 1','Podcast','medium','en',false,'Replace video_id and url with real benchmark podcast clip'),
  ('https://www.youtube.com/watch?v=PLACEHOLD_P2','PLACEHOLD_P2','Podcast placeholder 2','Podcast','medium','en',false,'Replace video_id and url with real benchmark podcast clip'),
  ('https://www.youtube.com/watch?v=PLACEHOLD_I1','PLACEHOLD_I1','Interview placeholder 1','Interview','medium','en',false,'Replace video_id and url with real benchmark interview'),
  ('https://www.youtube.com/watch?v=PLACEHOLD_I2','PLACEHOLD_I2','Interview placeholder 2','Interview','medium','en',false,'Replace video_id and url with real benchmark interview'),
  ('https://www.youtube.com/watch?v=PLACEHOLD_E1','PLACEHOLD_E1','Educational placeholder 1','Educational','medium','en',false,'Replace video_id and url with real educational video'),
  ('https://www.youtube.com/watch?v=PLACEHOLD_E2','PLACEHOLD_E2','Educational placeholder 2','Educational','medium','en',false,'Replace video_id and url with real educational video'),
  ('https://www.youtube.com/watch?v=PLACEHOLD_N1','PLACEHOLD_N1','News placeholder 1','News','medium','en',false,'Replace video_id and url with real news clip'),
  ('https://www.youtube.com/watch?v=PLACEHOLD_N2','PLACEHOLD_N2','News placeholder 2','News','medium','en',false,'Replace video_id and url with real news clip');
