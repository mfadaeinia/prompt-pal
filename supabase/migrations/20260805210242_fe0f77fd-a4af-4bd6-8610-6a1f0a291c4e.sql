DELETE FROM public.youtube_transcript_cache
WHERE requested_language = '_any_'
  AND language IS NULL
  AND transcript_json::text ~ '[\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF]';