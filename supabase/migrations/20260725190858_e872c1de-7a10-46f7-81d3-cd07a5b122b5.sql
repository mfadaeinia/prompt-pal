
CREATE TABLE public.dutch_media_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  video_id TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  source TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('top_story','trending','culture','expat')),
  duration_sec INTEGER,
  difficulty TEXT CHECK (difficulty IN ('A1','A2','B1','B2','C1','C2')),
  short_english_summary TEXT,
  why_it_matters TEXT,
  language TEXT NOT NULL DEFAULT 'nl',
  published_at TIMESTAMPTZ,
  featured_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dutch_media_items_feed ON public.dutch_media_items (featured_date DESC, category, sort_order);

GRANT SELECT ON public.dutch_media_items TO anon;
GRANT SELECT ON public.dutch_media_items TO authenticated;
GRANT ALL ON public.dutch_media_items TO service_role;

ALTER TABLE public.dutch_media_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published items"
ON public.dutch_media_items
FOR SELECT
USING (status = 'published');

CREATE TRIGGER dutch_media_items_set_updated_at
BEFORE UPDATE ON public.dutch_media_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed today's feed with curated content
INSERT INTO public.dutch_media_items
(title, source_url, video_id, thumbnail_url, source, category, duration_sec, difficulty, short_english_summary, why_it_matters, sort_order)
VALUES
-- TOP STORY
('Onderzoekers weten het: ''Deze man verraadde Anne Frank''',
 'https://www.youtube.com/watch?v=yKKSoD9beaQ', 'yKKSoD9beaQ',
 'https://i.ytimg.com/vi/yKKSoD9beaQ/hqdefault.jpg', 'NOS Jeugdjournaal', 'top_story', 283, 'B1',
 'A cold-case team believes they have identified who betrayed Anne Frank''s hiding place during WWII.',
 'A story every resident in the Netherlands will hear referenced — Anne Frank is central to Dutch history and identity.', 0),

-- TRENDING
('Joost Klein over zijn wereldtour, The Voice en Europapa',
 'https://www.youtube.com/watch?v=Bt7J9fJvJ5Y', 'Bt7J9fJvJ5Y',
 'https://i.ytimg.com/vi/Bt7J9fJvJ5Y/hqdefault.jpg', 'NOS Jeugdjournaal', 'trending', 246, 'B1',
 'Interview with Joost Klein about his world tour, The Voice, and the viral Eurovision hit "Europapa".',
 'Joost Klein and "Europapa" dominated Dutch pop culture — locals still quote him.', 0),

('Oeps! Dit is de grappigste taalvout van het jaar',
 'https://www.youtube.com/watch?v=W3Pu2RuTZ8A', 'W3Pu2RuTZ8A',
 'https://i.ytimg.com/vi/W3Pu2RuTZ8A/hqdefault.jpg', 'NOS Jeugdjournaal', 'trending', 99, 'A2',
 'The funniest Dutch language mistake of the year — a lighthearted look at how Dutch words trip people up.',
 'Perfect for learners: real Dutch people also struggle with tricky words.', 1),

-- CULTURE
('Lina is 12 en zit nu al op de universiteit',
 'https://www.youtube.com/watch?v=isimFyR9MnI', 'isimFyR9MnI',
 'https://i.ytimg.com/vi/isimFyR9MnI/hqdefault.jpg', 'NOS Jeugdjournaal', 'culture', 82, 'A2',
 'A 12-year-old girl is already studying at university — a portrait of a young Dutch prodigy.',
 'A glimpse into how the Dutch education system handles exceptional talent.', 0),

('Ninthe (11) is 1,70 meter en wordt nog veel langer',
 'https://www.youtube.com/watch?v=4ngmE-BV5sE', '4ngmE-BV5sE',
 'https://i.ytimg.com/vi/4ngmE-BV5sE/hqdefault.jpg', 'NOS Jeugdjournaal', 'culture', 151, 'A2',
 'An 11-year-old girl is already 1.70m tall — a story about growing up and the famously tall Dutch.',
 'The Dutch are the tallest people in the world — a cultural talking point you''ll hear often.', 1),

-- EXPAT
('Inside the mind of a master procrastinator | Tim Urban',
 'https://www.youtube.com/watch?v=8jPQjjsBbIc', '8jPQjjsBbIc',
 'https://i.ytimg.com/vi/8jPQjjsBbIc/hqdefault.jpg', 'TED', 'expat', 853, 'B2',
 'A funny, sharp TED talk about procrastination — in English, useful for warming up the learning-mode flow.',
 'Everyone in the Netherlands watches TED — a safe on-ramp before you tackle Dutch content.', 0);
