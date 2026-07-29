UPDATE public.curated_videos
SET status = 'inactive',
    validation_status = 'failed',
    validation_reason = 'wrong_language: German audio mislabelled as Dutch',
    validated_at = now(),
    updated_at = now()
WHERE external_id IN ('gUfp0TQd8Ac','f_ggObaoQD8');