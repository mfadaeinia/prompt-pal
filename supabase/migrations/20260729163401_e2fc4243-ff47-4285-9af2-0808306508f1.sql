ALTER TABLE public.curated_videos
  ADD COLUMN IF NOT EXISTS is_embeddable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS validation_reason text,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_curated_videos_validation ON public.curated_videos (validation_status, is_embeddable);

DROP POLICY IF EXISTS "curated_videos_public_read" ON public.curated_videos;
CREATE POLICY "curated_videos_public_read" ON public.curated_videos
  FOR SELECT USING (status = 'active' AND is_embeddable = true);