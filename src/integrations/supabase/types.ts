export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      benchmark_runs: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          mode: string
          notes: string | null
          pipeline_mode: string
          pipeline_success_count: number
          pipeline_success_rate: number
          release_version: string | null
          run_date: string
          sentence_success_count: number
          sentence_success_rate: number
          started_at: string
          status: string
          total_videos: number
          transcript_success_count: number
          transcript_success_rate: number
          translation_success_count: number
          translation_success_rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          mode: string
          notes?: string | null
          pipeline_mode?: string
          pipeline_success_count?: number
          pipeline_success_rate?: number
          release_version?: string | null
          run_date?: string
          sentence_success_count?: number
          sentence_success_rate?: number
          started_at?: string
          status?: string
          total_videos?: number
          transcript_success_count?: number
          transcript_success_rate?: number
          translation_success_count?: number
          translation_success_rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          mode?: string
          notes?: string | null
          pipeline_mode?: string
          pipeline_success_count?: number
          pipeline_success_rate?: number
          release_version?: string | null
          run_date?: string
          sentence_success_count?: number
          sentence_success_rate?: number
          started_at?: string
          status?: string
          total_videos?: number
          transcript_success_count?: number
          transcript_success_rate?: number
          translation_success_count?: number
          translation_success_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      benchmark_video_results: {
        Row: {
          ai_repair_success: boolean | null
          ai_repair_used: boolean | null
          asr_duration_ms: number | null
          asr_error_body: string | null
          asr_failure_code: string | null
          asr_http_status: number | null
          asr_language: string | null
          asr_model: string | null
          asr_provider: string | null
          asr_segments_count: number | null
          avg_sentence_length: number
          benchmark_video_id: string
          cache_hit: boolean | null
          cache_key: string | null
          cache_row_id: string | null
          cache_validation_status: string
          category: string
          coverage_percent: number
          created_at: string
          deterministic_quality: string | null
          download_size_mb: number | null
          download_status: string | null
          error_message: string | null
          extractor_audio_url: string | null
          extractor_audio_url_found: boolean | null
          extractor_failure_reason: string | null
          extractor_http_status: number | null
          extractor_latency_ms: number | null
          extractor_provider: string | null
          extractor_response_body: string | null
          extractor_response_status: string | null
          failure_code: string | null
          final_sentence_quality: string | null
          giant_sentence_pct: number | null
          http_status_code: number | null
          id: string
          longest_sentence_words: number
          median_gap_seconds: number | null
          openai_invoked: boolean | null
          pipeline_logs: Json | null
          pipeline_mode: string
          processing_time_ms: number
          provider_error: string | null
          punctuation_coverage_pct: number | null
          quality_rating: string
          quality_reason: string | null
          repair_diagnostics: Json | null
          repair_reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_founder: boolean
          run_id: string
          sampling_bucket: string | null
          sentence_count: number
          sentence_preview: Json | null
          sentence_quality_rating: string | null
          sentence_quality_reason: string | null
          short_fragment_pct: number | null
          transcribr_duration_ms: number | null
          transcribr_error: string | null
          transcribr_invoked: boolean | null
          transcribr_segments_count: number | null
          transcribr_status: number | null
          transcript_found: boolean
          transcript_generated: boolean | null
          transcript_length_chars: number | null
          transcript_preview: string | null
          transcript_source: string | null
          transcript_text: string | null
          transcript_truth_label: string
          transcript_word_count: number
          translation_generated: boolean | null
          translation_success: boolean
          video_url_status: string | null
        }
        Insert: {
          ai_repair_success?: boolean | null
          ai_repair_used?: boolean | null
          asr_duration_ms?: number | null
          asr_error_body?: string | null
          asr_failure_code?: string | null
          asr_http_status?: number | null
          asr_language?: string | null
          asr_model?: string | null
          asr_provider?: string | null
          asr_segments_count?: number | null
          avg_sentence_length?: number
          benchmark_video_id: string
          cache_hit?: boolean | null
          cache_key?: string | null
          cache_row_id?: string | null
          cache_validation_status?: string
          category: string
          coverage_percent?: number
          created_at?: string
          deterministic_quality?: string | null
          download_size_mb?: number | null
          download_status?: string | null
          error_message?: string | null
          extractor_audio_url?: string | null
          extractor_audio_url_found?: boolean | null
          extractor_failure_reason?: string | null
          extractor_http_status?: number | null
          extractor_latency_ms?: number | null
          extractor_provider?: string | null
          extractor_response_body?: string | null
          extractor_response_status?: string | null
          failure_code?: string | null
          final_sentence_quality?: string | null
          giant_sentence_pct?: number | null
          http_status_code?: number | null
          id?: string
          longest_sentence_words?: number
          median_gap_seconds?: number | null
          openai_invoked?: boolean | null
          pipeline_logs?: Json | null
          pipeline_mode?: string
          processing_time_ms?: number
          provider_error?: string | null
          punctuation_coverage_pct?: number | null
          quality_rating?: string
          quality_reason?: string | null
          repair_diagnostics?: Json | null
          repair_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_founder?: boolean
          run_id: string
          sampling_bucket?: string | null
          sentence_count?: number
          sentence_preview?: Json | null
          sentence_quality_rating?: string | null
          sentence_quality_reason?: string | null
          short_fragment_pct?: number | null
          transcribr_duration_ms?: number | null
          transcribr_error?: string | null
          transcribr_invoked?: boolean | null
          transcribr_segments_count?: number | null
          transcribr_status?: number | null
          transcript_found?: boolean
          transcript_generated?: boolean | null
          transcript_length_chars?: number | null
          transcript_preview?: string | null
          transcript_source?: string | null
          transcript_text?: string | null
          transcript_truth_label?: string
          transcript_word_count?: number
          translation_generated?: boolean | null
          translation_success?: boolean
          video_url_status?: string | null
        }
        Update: {
          ai_repair_success?: boolean | null
          ai_repair_used?: boolean | null
          asr_duration_ms?: number | null
          asr_error_body?: string | null
          asr_failure_code?: string | null
          asr_http_status?: number | null
          asr_language?: string | null
          asr_model?: string | null
          asr_provider?: string | null
          asr_segments_count?: number | null
          avg_sentence_length?: number
          benchmark_video_id?: string
          cache_hit?: boolean | null
          cache_key?: string | null
          cache_row_id?: string | null
          cache_validation_status?: string
          category?: string
          coverage_percent?: number
          created_at?: string
          deterministic_quality?: string | null
          download_size_mb?: number | null
          download_status?: string | null
          error_message?: string | null
          extractor_audio_url?: string | null
          extractor_audio_url_found?: boolean | null
          extractor_failure_reason?: string | null
          extractor_http_status?: number | null
          extractor_latency_ms?: number | null
          extractor_provider?: string | null
          extractor_response_body?: string | null
          extractor_response_status?: string | null
          failure_code?: string | null
          final_sentence_quality?: string | null
          giant_sentence_pct?: number | null
          http_status_code?: number | null
          id?: string
          longest_sentence_words?: number
          median_gap_seconds?: number | null
          openai_invoked?: boolean | null
          pipeline_logs?: Json | null
          pipeline_mode?: string
          processing_time_ms?: number
          provider_error?: string | null
          punctuation_coverage_pct?: number | null
          quality_rating?: string
          quality_reason?: string | null
          repair_diagnostics?: Json | null
          repair_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_founder?: boolean
          run_id?: string
          sampling_bucket?: string | null
          sentence_count?: number
          sentence_preview?: Json | null
          sentence_quality_rating?: string | null
          sentence_quality_reason?: string | null
          short_fragment_pct?: number | null
          transcribr_duration_ms?: number | null
          transcribr_error?: string | null
          transcribr_invoked?: boolean | null
          transcribr_segments_count?: number | null
          transcribr_status?: number | null
          transcript_found?: boolean
          transcript_generated?: boolean | null
          transcript_length_chars?: number | null
          transcript_preview?: string | null
          transcript_source?: string | null
          transcript_text?: string | null
          transcript_truth_label?: string
          transcript_word_count?: number
          translation_generated?: boolean | null
          translation_success?: boolean
          video_url_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "benchmark_video_results_benchmark_video_id_fkey"
            columns: ["benchmark_video_id"]
            isOneToOne: false
            referencedRelation: "benchmark_videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benchmark_video_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "benchmark_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmark_videos: {
        Row: {
          active: boolean
          category: string
          created_at: string
          difficulty: string
          id: string
          language: string
          notes: string | null
          title: string | null
          updated_at: string
          video_id: string
          youtube_url: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          difficulty?: string
          id?: string
          language?: string
          notes?: string | null
          title?: string | null
          updated_at?: string
          video_id: string
          youtube_url: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          difficulty?: string
          id?: string
          language?: string
          notes?: string | null
          title?: string | null
          updated_at?: string
          video_id?: string
          youtube_url?: string
        }
        Relationships: []
      }
      curated_sources: {
        Row: {
          created_at: string
          default_category: string | null
          external_id: string
          id: string
          is_active: boolean
          language: string
          name: string
          notes: string | null
          provider: string
          quality_rating: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_category?: string | null
          external_id: string
          id?: string
          is_active?: boolean
          language?: string
          name: string
          notes?: string | null
          provider?: string
          quality_rating?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_category?: string | null
          external_id?: string
          id?: string
          is_active?: boolean
          language?: string
          name?: string
          notes?: string | null
          provider?: string
          quality_rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      curated_videos: {
        Row: {
          added_at: string
          category: string | null
          cefr_level: Database["public"]["Enums"]["cefr_level"] | null
          channel: string
          channel_external_id: string | null
          created_at: string
          difficulty_score: number | null
          duration_sec: number | null
          external_id: string
          featured_week: string | null
          has_subtitles: boolean
          id: string
          is_embeddable: boolean
          is_evergreen: boolean
          language: string
          popularity: number
          provider: string
          published_at: string | null
          quality_score: number
          refreshed_at: string
          speaking_speed: Database["public"]["Enums"]["speaking_speed"] | null
          status: string
          summary: string | null
          thumbnail_url: string | null
          title: string
          topics: string[]
          updated_at: string
          url: string
          validated_at: string | null
          validation_reason: string | null
          validation_status: string
          words_per_minute: number | null
        }
        Insert: {
          added_at?: string
          category?: string | null
          cefr_level?: Database["public"]["Enums"]["cefr_level"] | null
          channel: string
          channel_external_id?: string | null
          created_at?: string
          difficulty_score?: number | null
          duration_sec?: number | null
          external_id: string
          featured_week?: string | null
          has_subtitles?: boolean
          id?: string
          is_embeddable?: boolean
          is_evergreen?: boolean
          language?: string
          popularity?: number
          provider?: string
          published_at?: string | null
          quality_score?: number
          refreshed_at?: string
          speaking_speed?: Database["public"]["Enums"]["speaking_speed"] | null
          status?: string
          summary?: string | null
          thumbnail_url?: string | null
          title: string
          topics?: string[]
          updated_at?: string
          url: string
          validated_at?: string | null
          validation_reason?: string | null
          validation_status?: string
          words_per_minute?: number | null
        }
        Update: {
          added_at?: string
          category?: string | null
          cefr_level?: Database["public"]["Enums"]["cefr_level"] | null
          channel?: string
          channel_external_id?: string | null
          created_at?: string
          difficulty_score?: number | null
          duration_sec?: number | null
          external_id?: string
          featured_week?: string | null
          has_subtitles?: boolean
          id?: string
          is_embeddable?: boolean
          is_evergreen?: boolean
          language?: string
          popularity?: number
          provider?: string
          published_at?: string | null
          quality_score?: number
          refreshed_at?: string
          speaking_speed?: Database["public"]["Enums"]["speaking_speed"] | null
          status?: string
          summary?: string | null
          thumbnail_url?: string | null
          title?: string
          topics?: string[]
          updated_at?: string
          url?: string
          validated_at?: string | null
          validation_reason?: string | null
          validation_status?: string
          words_per_minute?: number | null
        }
        Relationships: []
      }
      dutch_media_items: {
        Row: {
          category: string
          created_at: string
          difficulty: string | null
          duration_sec: number | null
          featured_date: string
          id: string
          language: string
          published_at: string | null
          short_english_summary: string | null
          sort_order: number
          source: string
          source_url: string
          status: string
          thumbnail_url: string
          title: string
          updated_at: string
          video_id: string
          why_it_matters: string | null
        }
        Insert: {
          category: string
          created_at?: string
          difficulty?: string | null
          duration_sec?: number | null
          featured_date?: string
          id?: string
          language?: string
          published_at?: string | null
          short_english_summary?: string | null
          sort_order?: number
          source: string
          source_url: string
          status?: string
          thumbnail_url: string
          title: string
          updated_at?: string
          video_id: string
          why_it_matters?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          difficulty?: string | null
          duration_sec?: number | null
          featured_date?: string
          id?: string
          language?: string
          published_at?: string | null
          short_english_summary?: string | null
          sort_order?: number
          source?: string
          source_url?: string
          status?: string
          thumbnail_url?: string
          title?: string
          updated_at?: string
          video_id?: string
          why_it_matters?: string | null
        }
        Relationships: []
      }
      early_access_signups: {
        Row: {
          created_at: string
          current_dutch_level: string | null
          email: string
          id: string
          page_url: string | null
          session_id: string | null
          source: string | null
          target_language: string | null
        }
        Insert: {
          created_at?: string
          current_dutch_level?: string | null
          email: string
          id?: string
          page_url?: string | null
          session_id?: string | null
          source?: string | null
          target_language?: string | null
        }
        Update: {
          created_at?: string
          current_dutch_level?: string | null
          email?: string
          id?: string
          page_url?: string | null
          session_id?: string | null
          source?: string | null
          target_language?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feedback_responses: {
        Row: {
          created_at: string
          id: string
          sentiment: string
          session_id: string | null
          trigger_reason: string | null
          useful_text: string | null
          video_id: string | null
          would_use_again: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          sentiment: string
          session_id?: string | null
          trigger_reason?: string | null
          useful_text?: string | null
          video_id?: string | null
          would_use_again?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          sentiment?: string
          session_id?: string | null
          trigger_reason?: string | null
          useful_text?: string | null
          video_id?: string | null
          would_use_again?: string | null
        }
        Relationships: []
      }
      library_events: {
        Row: {
          acquisition_source: string | null
          anonymous_id: string | null
          created_at: string
          event_name: string
          expression_id: string | null
          id: string
          metadata: Json | null
          release_cohort_id: string | null
          session_id: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          video_id: string | null
        }
        Insert: {
          acquisition_source?: string | null
          anonymous_id?: string | null
          created_at?: string
          event_name: string
          expression_id?: string | null
          id?: string
          metadata?: Json | null
          release_cohort_id?: string | null
          session_id?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          video_id?: string | null
        }
        Update: {
          acquisition_source?: string | null
          anonymous_id?: string | null
          created_at?: string
          event_name?: string
          expression_id?: string | null
          id?: string
          metadata?: Json | null
          release_cohort_id?: string | null
          session_id?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_events_release_cohort_id_fkey"
            columns: ["release_cohort_id"]
            isOneToOne: false
            referencedRelation: "release_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          acquisition_source: string | null
          anonymous_id: string | null
          created_at: string
          id: string
          path: string | null
          release_cohort_id: string | null
          session_id: string
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          acquisition_source?: string | null
          anonymous_id?: string | null
          created_at?: string
          id?: string
          path?: string | null
          release_cohort_id?: string | null
          session_id: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          acquisition_source?: string | null
          anonymous_id?: string | null
          created_at?: string
          id?: string
          path?: string | null
          release_cohort_id?: string | null
          session_id?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_views_release_cohort_id_fkey"
            columns: ["release_cohort_id"]
            isOneToOne: false
            referencedRelation: "release_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      release_cohorts: {
        Row: {
          created_at: string
          description: string | null
          ended_at: string | null
          id: string
          is_active: boolean
          name: string
          started_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          started_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          started_at?: string
        }
        Relationships: []
      }
      saved_expressions: {
        Row: {
          acquisition_source: string | null
          created_at: string
          expression_notes: string | null
          id: string
          meaning: string | null
          release_cohort_id: string | null
          sentence_text: string
          session_id: string
          target_language: string | null
          timestamp_seconds: number
          translation: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          video_id: string | null
          video_title: string | null
          video_url: string | null
        }
        Insert: {
          acquisition_source?: string | null
          created_at?: string
          expression_notes?: string | null
          id?: string
          meaning?: string | null
          release_cohort_id?: string | null
          sentence_text: string
          session_id: string
          target_language?: string | null
          timestamp_seconds?: number
          translation?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          video_id?: string | null
          video_title?: string | null
          video_url?: string | null
        }
        Update: {
          acquisition_source?: string | null
          created_at?: string
          expression_notes?: string | null
          id?: string
          meaning?: string | null
          release_cohort_id?: string | null
          sentence_text?: string
          session_id?: string
          target_language?: string | null
          timestamp_seconds?: number
          translation?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          video_id?: string | null
          video_title?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_expressions_release_cohort_id_fkey"
            columns: ["release_cohort_id"]
            isOneToOne: false
            referencedRelation: "release_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_videos: {
        Row: {
          acquisition_source: string | null
          created_at: string
          id: string
          release_cohort_id: string | null
          session_id: string | null
          target_language: string | null
          thumbnail_url: string | null
          user_id: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          video_id: string
          video_title: string | null
          video_url: string
        }
        Insert: {
          acquisition_source?: string | null
          created_at?: string
          id?: string
          release_cohort_id?: string | null
          session_id?: string | null
          target_language?: string | null
          thumbnail_url?: string | null
          user_id: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          video_id: string
          video_title?: string | null
          video_url: string
        }
        Update: {
          acquisition_source?: string | null
          created_at?: string
          id?: string
          release_cohort_id?: string | null
          session_id?: string | null
          target_language?: string | null
          thumbnail_url?: string | null
          user_id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          video_id?: string
          video_title?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_videos_release_cohort_id_fkey"
            columns: ["release_cohort_id"]
            isOneToOne: false
            referencedRelation: "release_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tester_events: {
        Row: {
          acquisition_source: string | null
          created_at: string
          event_name: string
          id: string
          metadata: Json | null
          release_cohort_id: string | null
          session_id: string | null
          tester_id: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          video_id: string | null
        }
        Insert: {
          acquisition_source?: string | null
          created_at?: string
          event_name: string
          id?: string
          metadata?: Json | null
          release_cohort_id?: string | null
          session_id?: string | null
          tester_id: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          video_id?: string | null
        }
        Update: {
          acquisition_source?: string | null
          created_at?: string
          event_name?: string
          id?: string
          metadata?: Json | null
          release_cohort_id?: string | null
          session_id?: string | null
          tester_id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tester_events_release_cohort_id_fkey"
            columns: ["release_cohort_id"]
            isOneToOne: false
            referencedRelation: "release_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_jobs: {
        Row: {
          assumed_kbps: number
          audio_url: string | null
          audio_url_fetched_at: string | null
          chunk_seconds: number
          chunks: Json
          completed_at: string | null
          completed_chunks: number
          created_at: string
          detected_language: string | null
          error: string | null
          expected_language: string | null
          first_chunk_at: string | null
          id: string
          started_at: string | null
          status: string
          time_to_first_clickable_sentence_ms: number | null
          time_to_full_transcript_ms: number | null
          total_chunks: number | null
          updated_at: string
          video_id: string
          whisper_reported_duration_s: number | null
        }
        Insert: {
          assumed_kbps?: number
          audio_url?: string | null
          audio_url_fetched_at?: string | null
          chunk_seconds?: number
          chunks?: Json
          completed_at?: string | null
          completed_chunks?: number
          created_at?: string
          detected_language?: string | null
          error?: string | null
          expected_language?: string | null
          first_chunk_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          time_to_first_clickable_sentence_ms?: number | null
          time_to_full_transcript_ms?: number | null
          total_chunks?: number | null
          updated_at?: string
          video_id: string
          whisper_reported_duration_s?: number | null
        }
        Update: {
          assumed_kbps?: number
          audio_url?: string | null
          audio_url_fetched_at?: string | null
          chunk_seconds?: number
          chunks?: Json
          completed_at?: string | null
          completed_chunks?: number
          created_at?: string
          detected_language?: string | null
          error?: string | null
          expected_language?: string | null
          first_chunk_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          time_to_first_clickable_sentence_ms?: number | null
          time_to_full_transcript_ms?: number | null
          total_chunks?: number | null
          updated_at?: string
          video_id?: string
          whisper_reported_duration_s?: number | null
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          comprehension_helpful: string | null
          created_at: string
          demo_started: boolean | null
          email: string | null
          explanations_opened: number | null
          failure_reason: string | null
          feedback_text: string | null
          feedback_type: string
          id: string
          ip_address: string | null
          is_own_video: boolean | null
          page_url: string | null
          seconds_watched: number | null
          session_id: string | null
          target_language: string | null
          time_on_page_seconds: number | null
          total_sentence_clicks: number | null
          trigger_reason: string | null
          unique_segments_clicked: number | null
          user_agent: string | null
          vs_current_workflow: string | null
          would_use_again: string | null
        }
        Insert: {
          comprehension_helpful?: string | null
          created_at?: string
          demo_started?: boolean | null
          email?: string | null
          explanations_opened?: number | null
          failure_reason?: string | null
          feedback_text?: string | null
          feedback_type: string
          id?: string
          ip_address?: string | null
          is_own_video?: boolean | null
          page_url?: string | null
          seconds_watched?: number | null
          session_id?: string | null
          target_language?: string | null
          time_on_page_seconds?: number | null
          total_sentence_clicks?: number | null
          trigger_reason?: string | null
          unique_segments_clicked?: number | null
          user_agent?: string | null
          vs_current_workflow?: string | null
          would_use_again?: string | null
        }
        Update: {
          comprehension_helpful?: string | null
          created_at?: string
          demo_started?: boolean | null
          email?: string | null
          explanations_opened?: number | null
          failure_reason?: string | null
          feedback_text?: string | null
          feedback_type?: string
          id?: string
          ip_address?: string | null
          is_own_video?: boolean | null
          page_url?: string | null
          seconds_watched?: number | null
          session_id?: string | null
          target_language?: string | null
          time_on_page_seconds?: number | null
          total_sentence_clicks?: number | null
          trigger_reason?: string | null
          unique_segments_clicked?: number | null
          user_agent?: string | null
          vs_current_workflow?: string | null
          would_use_again?: string | null
        }
        Relationships: []
      }
      user_learning_prefs: {
        Row: {
          created_at: string
          preferred_categories: string[]
          target_level: Database["public"]["Enums"]["cefr_level"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          preferred_categories?: string[]
          target_level?: Database["public"]["Enums"]["cefr_level"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          preferred_categories?: string[]
          target_level?: Database["public"]["Enums"]["cefr_level"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_interactions: {
        Row: {
          created_at: string
          curated_video_id: string
          id: string
          kind: Database["public"]["Enums"]["interaction_kind"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          curated_video_id: string
          id?: string
          kind: Database["public"]["Enums"]["interaction_kind"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          curated_video_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["interaction_kind"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_interactions_curated_video_id_fkey"
            columns: ["curated_video_id"]
            isOneToOne: false
            referencedRelation: "curated_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_sessions: {
        Row: {
          acquisition_source: string | null
          anonymous_id: string | null
          created_at: string
          duration_seconds: number
          ended: boolean
          id: string
          ip_address: string | null
          last_seen_at: string
          page_url: string | null
          release_cohort_id: string | null
          session_id: string
          started_at: string
          target_language: string | null
          updated_at: string
          user_agent: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          video_id: string
          video_url: string | null
        }
        Insert: {
          acquisition_source?: string | null
          anonymous_id?: string | null
          created_at?: string
          duration_seconds?: number
          ended?: boolean
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          page_url?: string | null
          release_cohort_id?: string | null
          session_id: string
          started_at?: string
          target_language?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          video_id: string
          video_url?: string | null
        }
        Update: {
          acquisition_source?: string | null
          anonymous_id?: string | null
          created_at?: string
          duration_seconds?: number
          ended?: boolean
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          page_url?: string | null
          release_cohort_id?: string | null
          session_id?: string
          started_at?: string
          target_language?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          video_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_sessions_release_cohort_id_fkey"
            columns: ["release_cohort_id"]
            isOneToOne: false
            referencedRelation: "release_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      video_transcript_reports: {
        Row: {
          avg_sentence_length: number
          created_at: string
          explanation_generation_enabled: boolean
          full_learning_enabled: boolean
          id: string
          language: string | null
          limited_mode_enabled: boolean
          quality_reasons: string[]
          quality_score: string
          sentence_count: number
          transcript_source: string
          video_id: string
          video_title: string | null
          video_url: string | null
        }
        Insert: {
          avg_sentence_length?: number
          created_at?: string
          explanation_generation_enabled?: boolean
          full_learning_enabled?: boolean
          id?: string
          language?: string | null
          limited_mode_enabled?: boolean
          quality_reasons?: string[]
          quality_score: string
          sentence_count?: number
          transcript_source: string
          video_id: string
          video_title?: string | null
          video_url?: string | null
        }
        Update: {
          avg_sentence_length?: number
          created_at?: string
          explanation_generation_enabled?: boolean
          full_learning_enabled?: boolean
          id?: string
          language?: string | null
          limited_mode_enabled?: boolean
          quality_reasons?: string[]
          quality_score?: string
          sentence_count?: number
          transcript_source?: string
          video_id?: string
          video_title?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      youtube_transcript_cache: {
        Row: {
          cache_key: string
          created_at: string
          id: string
          language: string | null
          provider: string
          provider_response_language: string | null
          requested_language: string
          source: string
          source_version: number
          transcript_json: Json
          transcript_length_chars: number | null
          updated_at: string
          video_id: string
          video_url: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          id?: string
          language?: string | null
          provider?: string
          provider_response_language?: string | null
          requested_language?: string
          source?: string
          source_version?: number
          transcript_json: Json
          transcript_length_chars?: number | null
          updated_at?: string
          video_id: string
          video_url: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          id?: string
          language?: string | null
          provider?: string
          provider_response_language?: string | null
          requested_language?: string
          source?: string
          source_version?: number
          transcript_json?: Json
          transcript_length_chars?: number | null
          updated_at?: string
          video_id?: string
          video_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_anonymous_saves: { Args: { _session_id: string }; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      cefr_level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
      interaction_kind: "bookmark" | "watched" | "like" | "dislike"
      speaking_speed: "slow" | "normal" | "fast"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cefr_level: ["A1", "A2", "B1", "B2", "C1", "C2"],
      interaction_kind: ["bookmark", "watched", "like", "dislike"],
      speaking_speed: ["slow", "normal", "fast"],
    },
  },
} as const
