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
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      aptitude_attempts: {
        Row: {
          answers: Json
          correct_count: number
          created_at: string
          duration_seconds: number
          id: string
          test_id: string | null
          topic_id: string | null
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json
          correct_count?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          test_id?: string | null
          topic_id?: string | null
          total_questions: number
          user_id: string
        }
        Update: {
          answers?: Json
          correct_count?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          test_id?: string | null
          topic_id?: string | null
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aptitude_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "aptitude_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aptitude_attempts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "aptitude_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      aptitude_questions: {
        Row: {
          correct_index: number
          created_at: string
          created_by: string | null
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          explanation: string | null
          id: string
          options: Json
          question: string
          source: string | null
          status: Database["public"]["Enums"]["content_status"]
          tags: string[]
          time_limit_seconds: number | null
          topic_id: string
          updated_at: string
        }
        Insert: {
          correct_index: number
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          explanation?: string | null
          id?: string
          options: Json
          question: string
          source?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          time_limit_seconds?: number | null
          topic_id: string
          updated_at?: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          explanation?: string | null
          id?: string
          options?: Json
          question?: string
          source?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          time_limit_seconds?: number | null
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aptitude_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "aptitude_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      aptitude_test_questions: {
        Row: {
          id: string
          order_index: number
          question_id: string
          test_id: string
        }
        Insert: {
          id?: string
          order_index?: number
          question_id: string
          test_id: string
        }
        Update: {
          id?: string
          order_index?: number
          question_id?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aptitude_test_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "aptitude_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aptitude_test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "aptitude_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      aptitude_tests: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number
          id: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number
          id?: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number
          id?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      aptitude_topics: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["bookmark_entity"]
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["bookmark_entity"]
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["bookmark_entity"]
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          handled: boolean
          id: string
          message: string
          name: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          handled?: boolean
          id?: string
          message: string
          name: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          handled?: boolean
          id?: string
          message?: string
          name?: string
          subject?: string | null
        }
        Relationships: []
      }
      daily_challenge_attempts: {
        Row: {
          challenge_id: string
          created_at: string
          id: string
          is_correct: boolean
          question_id: string | null
          selected_index: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string | null
          selected_index: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string | null
          selected_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_challenge_attempts_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_challenge_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "aptitude_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_challenges: {
        Row: {
          aptitude_question_id: string | null
          challenge_date: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          problem_id: string | null
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          aptitude_question_id?: string | null
          challenge_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          problem_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          aptitude_question_id?: string | null
          challenge_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          problem_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_challenges_aptitude_question_id_fkey"
            columns: ["aptitude_question_id"]
            isOneToOne: false
            referencedRelation: "aptitude_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_challenges_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_reports: {
        Row: {
          created_at: string
          experience_id: string
          handled: boolean
          id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          experience_id: string
          handled?: boolean
          id?: string
          reason: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          experience_id?: string
          handled?: boolean
          id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_reports_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "interview_experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_experiences: {
        Row: {
          author_id: string
          college: string | null
          company: string
          created_at: string
          featured: boolean
          id: string
          interview_date: string | null
          is_anonymous: boolean
          moderation_note: string | null
          outcome: Database["public"]["Enums"]["interview_outcome"]
          questions: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role_title: string
          rounds: Json
          status: Database["public"]["Enums"]["submission_status"]
          tips: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          author_id: string
          college?: string | null
          company: string
          created_at?: string
          featured?: boolean
          id?: string
          interview_date?: string | null
          is_anonymous?: boolean
          moderation_note?: string | null
          outcome?: Database["public"]["Enums"]["interview_outcome"]
          questions?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_title: string
          rounds?: Json
          status?: Database["public"]["Enums"]["submission_status"]
          tips?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          author_id?: string
          college?: string | null
          company?: string
          created_at?: string
          featured?: boolean
          id?: string
          interview_date?: string | null
          is_anonymous?: boolean
          moderation_note?: string | null
          outcome?: Database["public"]["Enums"]["interview_outcome"]
          questions?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_title?: string
          rounds?: Json
          status?: Database["public"]["Enums"]["submission_status"]
          tips?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      modules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          order_index: number
          roadmap_id: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          order_index?: number
          roadmap_id: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          order_index?: number
          roadmap_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmaps"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      problems: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          gfg_url: string | null
          id: string
          leetcode_url: string | null
          order_index: number
          resource_url: string | null
          status: Database["public"]["Enums"]["content_status"]
          tags: string[]
          title: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          gfg_url?: string | null
          id?: string
          leetcode_url?: string | null
          order_index?: number
          resource_url?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          gfg_url?: string | null
          id?: string
          leetcode_url?: string | null
          order_index?: number
          resource_url?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "problems_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          branch: string | null
          college: string | null
          created_at: string
          email: string | null
          full_name: string
          graduation_year: number | null
          id: string
          phone: string | null
          resume_url: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          branch?: string | null
          college?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          graduation_year?: number | null
          id: string
          phone?: string | null
          resume_url?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          branch?: string | null
          college?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          graduation_year?: number | null
          id?: string
          phone?: string | null
          resume_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          hits: number
          id: string
          identifier: string
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          id?: string
          identifier: string
          window_start?: string
        }
        Update: {
          bucket?: string
          hits?: number
          id?: string
          identifier?: string
          window_start?: string
        }
        Relationships: []
      }
      roadmaps: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          order_index: number
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          order_index?: number
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          order_index?: number
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_problem_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          deadline: string | null
          id: string
          notes: string | null
          problem_id: string
          status: Database["public"]["Enums"]["progress_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          notes?: string | null
          problem_id: string
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          notes?: string | null
          problem_id?: string
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_problem_progress_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          module_id: string
          order_index: number
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          module_id: string
          order_index?: number
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          module_id?: string
          order_index?: number
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_progress: {
        Row: {
          completed: boolean
          duration_seconds: number | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["video_entity"]
          id: string
          last_watched_at: string
          position_seconds: number
          user_id: string
          video_resource_id: string
        }
        Insert: {
          completed?: boolean
          duration_seconds?: number | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["video_entity"]
          id?: string
          last_watched_at?: string
          position_seconds?: number
          user_id: string
          video_resource_id: string
        }
        Update: {
          completed?: boolean
          duration_seconds?: number | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["video_entity"]
          id?: string
          last_watched_at?: string
          position_seconds?: number
          user_id?: string
          video_resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_progress_video_resource_id_fkey"
            columns: ["video_resource_id"]
            isOneToOne: false
            referencedRelation: "video_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      video_resources: {
        Row: {
          channel: string | null
          created_at: string
          created_by: string | null
          difficulty: Database["public"]["Enums"]["difficulty_level"] | null
          duration_seconds: number | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["video_entity"]
          featured: boolean
          id: string
          language: string
          notes: string | null
          priority: number
          resource_type: Database["public"]["Enums"]["video_resource_type"]
          status: Database["public"]["Enums"]["content_status"]
          title: string
          tutor_name: string
          updated_at: string
          verified: boolean
          video_id: string
          video_url: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          duration_seconds?: number | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["video_entity"]
          featured?: boolean
          id?: string
          language?: string
          notes?: string | null
          priority?: number
          resource_type?: Database["public"]["Enums"]["video_resource_type"]
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          tutor_name: string
          updated_at?: string
          verified?: boolean
          video_id: string
          video_url: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          duration_seconds?: number | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["video_entity"]
          featured?: boolean
          id?: string
          language?: string
          notes?: string | null
          priority?: number
          resource_type?: Database["public"]["Enums"]["video_resource_type"]
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          tutor_name?: string
          updated_at?: string
          verified?: boolean
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
      bookmark_entity:
        | "problem"
        | "topic"
        | "module"
        | "aptitude_question"
        | "interview_experience"
      content_status: "draft" | "published" | "archived" | "pending_review"
      difficulty_level: "easy" | "medium" | "hard"
      interview_outcome: "selected" | "rejected" | "in_process" | "withdrawn"
      progress_status: "not_started" | "in_progress" | "completed"
      submission_status: "pending" | "approved" | "rejected" | "archived"
      video_entity: "topic" | "problem"
      video_resource_type:
        | "concept"
        | "approach"
        | "dry_run"
        | "solution"
        | "revision"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "student"],
      bookmark_entity: [
        "problem",
        "topic",
        "module",
        "aptitude_question",
        "interview_experience",
      ],
      content_status: ["draft", "published", "archived", "pending_review"],
      difficulty_level: ["easy", "medium", "hard"],
      interview_outcome: ["selected", "rejected", "in_process", "withdrawn"],
      progress_status: ["not_started", "in_progress", "completed"],
      submission_status: ["pending", "approved", "rejected", "archived"],
      video_entity: ["topic", "problem"],
      video_resource_type: [
        "concept",
        "approach",
        "dry_run",
        "solution",
        "revision",
      ],
    },
  },
} as const
