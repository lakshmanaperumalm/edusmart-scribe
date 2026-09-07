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
      ai_call_log: {
        Row: {
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          metadata: Json | null
          table_name: string
          target_row_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          table_name: string
          target_row_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          table_name?: string
          target_row_id?: string | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          code: string
          description: string | null
          emoji: string
          id: string
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          emoji?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          emoji?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          subject: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subject?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          cover_emoji: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          owner_id: string
          subject: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_emoji?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          owner_id: string
          subject: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_emoji?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          owner_id?: string
          subject?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          id: string
          progress: number
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          progress?: number
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: string | null
          course_id: string
          created_at: string
          id: string
          position: number
          resource_url: string | null
          title: string
        }
        Insert: {
          content?: string | null
          course_id: string
          created_at?: string
          id?: string
          position?: number
          resource_url?: string | null
          title: string
        }
        Update: {
          content?: string | null
          course_id?: string
          created_at?: string
          id?: string
          position?: number
          resource_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          chapters: Json
          content: string | null
          created_at: string
          flashcards: Json
          graph: Json
          id: string
          key_points: Json
          language: string
          level: string
          meta: Json
          summary: string | null
          toc: Json
          topic: string
          user_id: string
        }
        Insert: {
          chapters?: Json
          content?: string | null
          created_at?: string
          flashcards?: Json
          graph?: Json
          id?: string
          key_points?: Json
          language?: string
          level?: string
          meta?: Json
          summary?: string | null
          toc?: Json
          topic: string
          user_id: string
        }
        Update: {
          chapters?: Json
          content?: string | null
          created_at?: string
          flashcards?: Json
          graph?: Json
          id?: string
          key_points?: Json
          language?: string
          level?: string
          meta?: Json
          summary?: string | null
          toc?: Json
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_events: {
        Row: {
          accuracy: number | null
          created_at: string
          duration_seconds: number | null
          event_type: string
          id: string
          subject: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          duration_seconds?: number | null
          event_type: string
          id?: string
          subject?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          duration_seconds?: number | null
          event_type?: string
          id?: string
          subject?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          goals: string[]
          id: string
          interests: string[]
          last_active: string | null
          learning_style: Database["public"]["Enums"]["learning_style"] | null
          onboarded: boolean
          streak: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          goals?: string[]
          id?: string
          interests?: string[]
          last_active?: string | null
          learning_style?: Database["public"]["Enums"]["learning_style"] | null
          onboarded?: boolean
          streak?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          goals?: string[]
          id?: string
          interests?: string[]
          last_active?: string | null
          learning_style?: Database["public"]["Enums"]["learning_style"] | null
          onboarded?: boolean
          streak?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json
          created_at: string
          duration_seconds: number | null
          feedback: string | null
          id: string
          quiz_id: string
          score: number
          total: number
          user_id: string
          weak_topics: Json
        }
        Insert: {
          answers?: Json
          created_at?: string
          duration_seconds?: number | null
          feedback?: string | null
          id?: string
          quiz_id: string
          score: number
          total: number
          user_id: string
          weak_topics?: Json
        }
        Update: {
          answers?: Json
          created_at?: string
          duration_seconds?: number | null
          feedback?: string | null
          id?: string
          quiz_id?: string
          score?: number
          total?: number
          user_id?: string
          weak_topics?: Json
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          course_id: string | null
          created_at: string
          difficulty: string
          id: string
          is_ai_generated: boolean
          owner_id: string
          questions: Json
          subject: string
          title: string
          topic: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          difficulty?: string
          id?: string
          is_ai_generated?: boolean
          owner_id: string
          questions?: Json
          subject: string
          title: string
          topic: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          difficulty?: string
          id?: string
          is_ai_generated?: boolean
          owner_id?: string
          questions?: Json
          subject?: string
          title?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plans: {
        Row: {
          created_at: string
          days: Json
          goal: string | null
          id: string
          is_active: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days?: Json
          goal?: string | null
          id?: string
          is_active?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          days?: Json
          goal?: string | null
          id?: string
          is_active?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
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
      app_role: "student" | "teacher" | "admin"
      learning_style: "visual" | "audio" | "reading_writing" | "practical"
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
      app_role: ["student", "teacher", "admin"],
      learning_style: ["visual", "audio", "reading_writing", "practical"],
    },
  },
} as const
