
-- Add provenance + cache-key columns to youtube_transcript_cache so different
-- providers and requested languages don't overwrite each other.
ALTER TABLE public.youtube_transcript_cache
  ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS requested_language TEXT NOT NULL DEFAULT '_any_',
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS provider_response_language TEXT,
  ADD COLUMN IF NOT EXISTS source_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS transcript_length_chars INT,
  ADD COLUMN IF NOT EXISTS cache_key TEXT;

-- Backfill provider from legacy `source`, language from legacy `language`.
UPDATE public.youtube_transcript_cache
   SET provider = COALESCE(NULLIF(provider, 'unknown'), source, 'unknown'),
       provider_response_language = COALESCE(provider_response_language, language),
       transcript_length_chars = COALESCE(transcript_length_chars, LENGTH(transcript_json::text)),
       cache_key = COALESCE(
         cache_key,
         video_id || '|' || requested_language || '|' ||
           COALESCE(NULLIF(provider, 'unknown'), source, 'unknown') || '|' || source_version
       );

ALTER TABLE public.youtube_transcript_cache ALTER COLUMN cache_key SET NOT NULL;

-- Swap primary key from video_id to surrogate id so multiple
-- (video_id, language, provider, version) rows can coexist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'youtube_transcript_cache_pkey'
      AND conrelid = 'public.youtube_transcript_cache'::regclass
  ) THEN
    ALTER TABLE public.youtube_transcript_cache DROP CONSTRAINT youtube_transcript_cache_pkey;
  END IF;
END $$;

ALTER TABLE public.youtube_transcript_cache ADD PRIMARY KEY (id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'youtube_transcript_cache_key_unique'
  ) THEN
    ALTER TABLE public.youtube_transcript_cache
      ADD CONSTRAINT youtube_transcript_cache_key_unique
      UNIQUE (video_id, requested_language, provider, source_version);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_youtube_transcript_cache_video_id
  ON public.youtube_transcript_cache(video_id);
