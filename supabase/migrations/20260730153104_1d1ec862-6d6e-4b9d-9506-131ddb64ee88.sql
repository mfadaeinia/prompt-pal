UPDATE public.curated_videos
SET status='inactive', is_embeddable=false, validation_status='failed',
    validation_reason='wrong_language: German audio (Easy German) mislabelled as Dutch',
    validated_at=now(), updated_at=now()
WHERE external_id='omfb5tjFSIM';

INSERT INTO public.curated_videos
 (provider, external_id, url, title, channel, thumbnail_url, duration_sec, language, cefr_level, speaking_speed, words_per_minute, category, topics, summary, has_subtitles, quality_score, popularity, is_evergreen, status, is_embeddable, validation_status, validation_reason, validated_at)
VALUES
 ('youtube','y4PBHN-t__0','https://www.youtube.com/watch?v=y4PBHN-t__0','Hoe voel je je vandaag? | Easy Dutch 28','Easy Dutch','https://i.ytimg.com/vi/y4PBHN-t__0/hqdefault.jpg',505,'nl','A2','normal',158,'Daily Life',ARRAY['gevoelens','straatinterview','dagelijks leven'],'Straatinterviews in Nederland over hoe mensen zich vandaag voelen, met Nederlandse ondertiteling.',true,0.9,0,true,'active',true,'passed','ok',now()),
 ('youtube','YLgEHHQJlVQ','https://www.youtube.com/watch?v=YLgEHHQJlVQ','Wat is je favoriete vakantiebestemming? | Easy Dutch 35','Easy Dutch','https://i.ytimg.com/vi/YLgEHHQJlVQ/hqdefault.jpg',514,'nl','A2','normal',151,'Daily Life',ARRAY['vakantie','reizen','straatinterview'],'Nederlanders vertellen over hun favoriete vakantiebestemming, met Nederlandse ondertiteling.',true,0.9,0,true,'active',true,'passed','ok',now()),
 ('youtube','zVm2EV9cUVw','https://www.youtube.com/watch?v=zVm2EV9cUVw','Verstaan Nederlanders Vlaams? | Easy Dutch 58','Easy Dutch','https://i.ytimg.com/vi/zVm2EV9cUVw/hqdefault.jpg',826,'nl','B1','normal',165,'Daily Life',ARRAY['vlaams','dialect','straatinterview'],'Straatinterviews over of Nederlanders Vlaams verstaan, volledig in het Nederlands met ondertiteling.',true,0.88,0,true,'active',true,'passed','ok',now())
ON CONFLICT (provider, external_id) DO UPDATE SET status='active', category=EXCLUDED.category, cefr_level=EXCLUDED.cefr_level, title=EXCLUDED.title, updated_at=now();