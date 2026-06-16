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
          avg_sentence_length: number
          benchmark_video_id: string
          cache_hit: boolean | null
          category: string
          coverage_percent: number
          created_at: string
          download_size_mb: number | null
          download_status: string | null
          error_message: string | null
          failure_code: string | null
          giant_sentence_pct: number | null
          http_status_code: number | null
          id: string
          longest_sentence_words: number
          median_gap_seconds: number | null
          pipeline_logs: Json | null
          processing_time_ms: number
          punctuation_coverage_pct: number | null
          quality_rating: string
          quality_reason: string | null
          run_id: string
          sentence_count: number
          sentence_preview: Json | null
          sentence_quality_rating: string | null
          sentence_quality_reason: string | null
          short_fragment_pct: number | null
          transcript_found: boolean
          transcript_generated: boolean | null
          transcript_length_chars: number | null
          transcript_source: string | null
          transcript_word_count: number
          translation_generated: boolean | null
          translation_success: boolean
          video_url_status: string | null
        }
        Insert: {
          avg_sentence_length?: number
          benchmark_video_id: string
          cache_hit?: boolean | null
          category: string
          coverage_percent?: number
          created_at?: string
          download_size_mb?: number | null
          download_status?: string | null
          error_message?: string | null
          failure_code?: string | null
          giant_sentence_pct?: number | null
          http_status_code?: number | null
          id?: string
          longest_sentence_words?: number
          median_gap_seconds?: number | null
          pipeline_logs?: Json | null
          processing_time_ms?: number
          punctuation_coverage_pct?: number | null
          quality_rating?: string
          quality_reason?: string | null
          run_id: string
          sentence_count?: number
          sentence_preview?: Json | null
          sentence_quality_rating?: string | null
          sentence_quality_reason?: string | null
          short_fragment_pct?: number | null
          transcript_found?: boolean
          transcript_generated?: boolean | null
          transcript_length_chars?: number | null
          transcript_source?: string | null
          transcript_word_count?: number
          translation_generated?: boolean | null
          translation_success?: boolean
          video_url_status?: string | null
        }
        Update: {
          avg_sentence_length?: number
          benchmark_video_id?: string
          cache_hit?: boolean | null
          category?: string
          coverage_percent?: number
          created_at?: string
          download_size_mb?: number | null
          download_status?: string | null
          error_message?: string | null
          failure_code?: string | null
          giant_sentence_pct?: number | null
          http_status_code?: number | null
          id?: string
          longest_sentence_words?: number
          median_gap_seconds?: number | null
          pipeline_logs?: Json | null
          processing_time_ms?: number
          punctuation_coverage_pct?: number | null
          quality_rating?: string
          quality_reason?: string | null
          run_id?: string
          sentence_count?: number
          sentence_preview?: Json | null
          sentence_quality_rating?: string | null
          sentence_quality_reason?: string | null
          short_fragment_pct?: number | null
          transcript_found?: boolean
          transcript_generated?: boolean | null
          transcript_length_chars?: number | null
          transcript_source?: string | null
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
          created_at: string
          event_name: string
          expression_id: string | null
          id: string
          metadata: Json | null
          session_id: string | null
          video_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          expression_id?: string | null
          id?: string
          metadata?: Json | null
          session_id?: string | null
          video_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          expression_id?: string | null
          id?: string
          metadata?: Json | null
          session_id?: string | null
          video_id?: string | null
        }
        Relationships: []
      }
      saved_expressions: {
        Row: {
          created_at: string
          expression_notes: string | null
          id: string
          meaning: string | null
          sentence_text: string
          session_id: string
          target_language: string | null
          timestamp_seconds: number
          translation: string | null
          video_id: string | null
          video_title: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          expression_notes?: string | null
          id?: string
          meaning?: string | null
          sentence_text: string
          session_id: string
          target_language?: string | null
          timestamp_seconds?: number
          translation?: string | null
          video_id?: string | null
          video_title?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          expression_notes?: string | null
          id?: string
          meaning?: string | null
          sentence_text?: string
          session_id?: string
          target_language?: string | null
          timestamp_seconds?: number
          translation?: string | null
          video_id?: string | null
          video_title?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      tester_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          metadata: Json | null
          session_id: string | null
          tester_id: string
          video_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          tester_id: string
          video_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          tester_id?: string
          video_id?: string | null
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
      video_sessions: {
        Row: {
          created_at: string
          duration_seconds: number
          ended: boolean
          id: string
          ip_address: string | null
          last_seen_at: string
          page_url: string | null
          session_id: string
          started_at: string
          target_language: string | null
          updated_at: string
          user_agent: string | null
          video_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          ended?: boolean
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          page_url?: string | null
          session_id: string
          started_at?: string
          target_language?: string | null
          updated_at?: string
          user_agent?: string | null
          video_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          ended?: boolean
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          page_url?: string | null
          session_id?: string
          started_at?: string
          target_language?: string | null
          updated_at?: string
          user_agent?: string | null
          video_id?: string
          video_url?: string | null
        }
        Relationships: []
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
          created_at: string
          language: string | null
          source: string
          transcript_json: Json
          updated_at: string
          video_id: string
          video_url: string
        }
        Insert: {
          created_at?: string
          language?: string | null
          source?: string
          transcript_json: Json
          updated_at?: string
          video_id: string
          video_url: string
        }
        Update: {
          created_at?: string
          language?: string | null
          source?: string
          transcript_json?: Json
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
