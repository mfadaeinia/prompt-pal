CREATE TYPE public.cefr_level AS ENUM ('A1','A2','B1','B2','C1','C2');
CREATE TYPE public.speaking_speed AS ENUM ('slow','normal','fast');
CREATE TYPE public.interaction_kind AS ENUM ('bookmark','watched','like','dislike');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.curated_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'youtube',
  external_id text NOT NULL,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'nl',
  default_category text,
  quality_rating int NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);
GRANT SELECT ON public.curated_sources TO anon;
GRANT SELECT ON public.curated_sources TO authenticated;
GRANT ALL ON public.curated_sources TO service_role;
ALTER TABLE public.curated_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curated_sources_public_read" ON public.curated_sources FOR SELECT USING (is_active);
CREATE TRIGGER trg_curated_sources_updated BEFORE UPDATE ON public.curated_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.curated_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'youtube',
  external_id text NOT NULL,
  url text NOT NULL,
  title text NOT NULL,
  channel text NOT NULL,
  channel_external_id text,
  thumbnail_url text,
  duration_sec int,
  published_at timestamptz,
  language text NOT NULL DEFAULT 'nl',
  cefr_level public.cefr_level,
  difficulty_score numeric,
  speaking_speed public.speaking_speed,
  words_per_minute int,
  category text,
  topics text[] NOT NULL DEFAULT '{}',
  summary text,
  has_subtitles boolean NOT NULL DEFAULT true,
  quality_score numeric NOT NULL DEFAULT 0,
  popularity int NOT NULL DEFAULT 0,
  is_evergreen boolean NOT NULL DEFAULT false,
  featured_week date,
  status text NOT NULL DEFAULT 'active',
  added_at timestamptz NOT NULL DEFAULT now(),
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);
GRANT SELECT ON public.curated_videos TO anon;
GRANT SELECT ON public.curated_videos TO authenticated;
GRANT ALL ON public.curated_videos TO service_role;
ALTER TABLE public.curated_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curated_videos_public_read" ON public.curated_videos FOR SELECT USING (status = 'active');
CREATE INDEX idx_curated_videos_status ON public.curated_videos (status, published_at DESC);
CREATE INDEX idx_curated_videos_level ON public.curated_videos (cefr_level);
CREATE INDEX idx_curated_videos_category ON public.curated_videos (category);
CREATE INDEX idx_curated_videos_featured ON public.curated_videos (featured_week DESC);
CREATE TRIGGER trg_curated_videos_updated BEFORE UPDATE ON public.curated_videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.video_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  curated_video_id uuid NOT NULL REFERENCES public.curated_videos(id) ON DELETE CASCADE,
  kind public.interaction_kind NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, curated_video_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_interactions TO authenticated;
GRANT ALL ON public.video_interactions TO service_role;
ALTER TABLE public.video_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video_interactions_own" ON public.video_interactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_video_interactions_updated BEFORE UPDATE ON public.video_interactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_learning_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  target_level public.cefr_level,
  preferred_categories text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_learning_prefs TO authenticated;
GRANT ALL ON public.user_learning_prefs TO service_role;
ALTER TABLE public.user_learning_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_learning_prefs_own" ON public.user_learning_prefs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_user_learning_prefs_updated BEFORE UPDATE ON public.user_learning_prefs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.curated_sources (external_id, name, default_category, quality_rating, notes) VALUES
 ('UCiJZLpJH1Sc7NgxSqYFvvzA','NOS Jeugdjournaal','News',5,'Clear, slow, well-subtitled Dutch news for young audiences'),
 ('UCTUyoZMfksbNIHfWJjwr5aQ','Easy Dutch','Daily Life',5,'Street interviews with dual subtitles'),
 ('UCS1E8Q3Y8dnLbWyPvLBSTBw','Zondag met Lubach / De Avondshow','Comedy',4,'Satirical news, fast natural Dutch'),
 ('UCqEIQU63mvzB6xWmO0IJ_1w','NOS','News',5,'National broadcaster news'),
 ('UCJHOEeAoGkbn6qbFa5rEC0Q','Universiteit van Nederland','Science',5,'Academic lectures in accessible Dutch'),
 ('UC1kmnKcO9tKmPYXVDoQyBmA','Dutchies to be','Learning Dutch',4,'Dutch learning content'),
 ('UCcv2q3xnEBn3bNSVLmVdWKQ','VPRO Tegenlicht','Culture',4,'Documentaries'),
 ('UCLCoP1e2sIsAcQJRNvYCbXQ','24Kitchen Nederland','Cooking',3,'Cooking shows');