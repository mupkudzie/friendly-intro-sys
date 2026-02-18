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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          activity_data_json: Json | null
          created_at: string
          end_time: string | null
          final_photos: Json | null
          id: string
          initial_photos: Json | null
          start_time: string | null
          status: string | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_data_json?: Json | null
          created_at?: string
          end_time?: string | null
          final_photos?: Json | null
          id?: string
          initial_photos?: Json | null
          start_time?: string | null
          status?: string | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_data_json?: Json | null
          created_at?: string
          end_time?: string | null
          final_photos?: Json | null
          id?: string
          initial_photos?: Json | null
          start_time?: string | null
          status?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          created_at: string | null
          created_by: string
          expires_at: string | null
          id: string
          message: string
          target_roles: string[] | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          id?: string
          message: string
          target_roles?: string[] | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          id?: string
          message?: string
          target_roles?: string[] | null
          title?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      farm_zones: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string
          description: string | null
          gps_coordinates: Json
          id: string
          name: string
          supervisor_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by: string
          description?: string | null
          gps_coordinates: Json
          id?: string
          name: string
          supervisor_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          gps_coordinates?: Json
          id?: string
          name?: string
          supervisor_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      function_backups: {
        Row: {
          created_at: string | null
          definition: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          definition: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          definition?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          recipient_id: string
          sender_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          recipient_id: string
          sender_id?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          recipient_id?: string
          sender_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      performance_evaluations: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          score: number
          supervisor_id: string
          task_id: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          score: number
          supervisor_id: string
          task_id: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          score?: number
          supervisor_id?: string
          task_id?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          contact_number: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string
          id: string
          is_deleted: boolean | null
          rejection_reason: string | null
          role: Database["public"]["Enums"]["user_role"]
          student_id: string | null
          task_target: number | null
          updated_at: string
          user_id: string
          user_role: string | null
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          contact_number?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_deleted?: boolean | null
          rejection_reason?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          student_id?: string | null
          task_target?: number | null
          updated_at?: string
          user_id: string
          user_role?: string | null
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          contact_number?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_deleted?: boolean | null
          rejection_reason?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          student_id?: string | null
          task_target?: number | null
          updated_at?: string
          user_id?: string
          user_role?: string | null
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_history: {
        Row: {
          action: string
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["task_status"] | null
          notes: string | null
          old_status: Database["public"]["Enums"]["task_status"] | null
          task_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["task_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["task_status"] | null
          task_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["task_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["task_status"] | null
          task_id?: string
          user_id?: string
        }
        Relationships: []
      }
      task_reports: {
        Row: {
          ai_feedback: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          original_report: string
          refined_report: string | null
          rejection_reason: string | null
          submitted_at: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_feedback?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          original_report: string
          refined_report?: string | null
          rejection_reason?: string | null
          submitted_at?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_feedback?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          original_report?: string
          refined_report?: string | null
          rejection_reason?: string | null
          submitted_at?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "task_reports_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      task_requests: {
        Row: {
          created_at: string
          description: string
          id: string
          justification: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          requested_at: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          justification?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          requested_at?: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          justification?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          requested_at?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "task_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      task_templates: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          created_by: string
          description: string
          estimated_hours: number | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          requirements: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by: string
          description: string
          estimated_hours?: number | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          requirements?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string
          estimated_hours?: number | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          requirements?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_by: string
          assigned_to: string
          created_at: string
          description: string
          due_date: string | null
          estimated_hours: number | null
          geofence_lat: number | null
          geofence_lon: number | null
          geofence_radius: number | null
          id: string
          instructions: string | null
          location: string | null
          location_type: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          created_at?: string
          description: string
          due_date?: string | null
          estimated_hours?: number | null
          geofence_lat?: number | null
          geofence_lon?: number | null
          geofence_radius?: number | null
          id?: string
          instructions?: string | null
          location?: string | null
          location_type?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          created_at?: string
          description?: string
          due_date?: string | null
          estimated_hours?: number | null
          geofence_lat?: number | null
          geofence_lon?: number | null
          geofence_radius?: number | null
          id?: string
          instructions?: string | null
          location?: string | null
          location_type?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      time_logs: {
        Row: {
          break_time: number | null
          created_at: string
          end_time: string | null
          id: string
          start_time: string
          task_id: string
          total_hours: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          break_time?: number | null
          created_at?: string
          end_time?: string | null
          id?: string
          start_time: string
          task_id: string
          total_hours?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          break_time?: number | null
          created_at?: string
          end_time?: string | null
          id?: string
          start_time?: string
          task_id?: string
          total_hours?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      worker_activities: {
        Row: {
          activity: string | null
          confidence: number | null
          detected_at: string | null
          id: string
          image_url: string | null
          location: Json | null
          worker_id: string | null
        }
        Insert: {
          activity?: string | null
          confidence?: number | null
          detected_at?: string | null
          id?: string
          image_url?: string | null
          location?: Json | null
          worker_id?: string | null
        }
        Update: {
          activity?: string | null
          confidence?: number | null
          detected_at?: string | null
          id?: string
          image_url?: string | null
          location?: Json | null
          worker_id?: string | null
        }
        Relationships: []
      }
      worker_analytics: {
        Row: {
          created_at: string
          hours_accumulated: number
          id: string
          productivity_score: number | null
          tasks_completed: number
          updated_at: string
          week_start: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          hours_accumulated?: number
          id?: string
          productivity_score?: number | null
          tasks_completed?: number
          updated_at?: string
          week_start: string
          worker_id: string
        }
        Update: {
          created_at?: string
          hours_accumulated?: number
          id?: string
          productivity_score?: number | null
          tasks_completed?: number
          updated_at?: string
          week_start?: string
          worker_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_video_feed: {
        Args: never
        Returns: {
          id: string
          url: string
        }[]
      }
      get_video_feed_v2: {
        Args: { p_limit?: number; p_offset?: number; p_user_id?: string }
        Returns: Json
      }
      get_video_feed_wrapper: {
        Args: { p_limit?: number; p_offset?: number; p_user_id?: string }
        Returns: Json
      }
      get_worker_total_hours: {
        Args: { total_hours_threshold: number }
        Returns: {
          department: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          total_hours: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "student" | "garden_worker"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "approved"
        | "rejected"
        | "pending_approval"
      user_role: "admin" | "supervisor" | "student" | "garden_worker"
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
      app_role: ["admin", "supervisor", "student", "garden_worker"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: [
        "pending",
        "in_progress",
        "completed",
        "approved",
        "rejected",
        "pending_approval",
      ],
      user_role: ["admin", "supervisor", "student", "garden_worker"],
    },
  },
} as const
