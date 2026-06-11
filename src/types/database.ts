export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      training_plans: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: "marathon" | "half_marathon" | "strength" | "custom";
          description: string | null;
          total_weeks: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: "marathon" | "half_marathon" | "strength" | "custom";
          description?: string | null;
          total_weeks: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: "marathon" | "half_marathon" | "strength" | "custom";
          description?: string | null;
          total_weeks?: number;
          created_at?: string;
        };
      };
      plan_workouts: {
        Row: {
          id: string;
          plan_id: string;
          week_number: number;
          day_of_week: number;
          type: "run" | "strength" | "rest" | "cross_train";
          title: string;
          description: string | null;
          distance_miles: number | null;
          pace_type: "easy" | "tempo" | "threshold" | "race" | "interval" | null;
          duration_minutes: number | null;
          notes: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          plan_id: string;
          week_number: number;
          day_of_week: number;
          type: "run" | "strength" | "rest" | "cross_train";
          title: string;
          description?: string | null;
          distance_miles?: number | null;
          pace_type?: "easy" | "tempo" | "threshold" | "race" | "interval" | null;
          duration_minutes?: number | null;
          notes?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          plan_id?: string;
          week_number?: number;
          day_of_week?: number;
          type?: "run" | "strength" | "rest" | "cross_train";
          title?: string;
          description?: string | null;
          distance_miles?: number | null;
          pace_type?: "easy" | "tempo" | "threshold" | "race" | "interval" | null;
          duration_minutes?: number | null;
          notes?: string | null;
          sort_order?: number;
        };
      };
      user_plans: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          start_date: string;
          status: "active" | "paused" | "completed";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          start_date: string;
          status?: "active" | "paused" | "completed";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          start_date?: string;
          status?: "active" | "paused" | "completed";
          created_at?: string;
        };
      };
      running_paces: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          pace_seconds_per_mile: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          pace_seconds_per_mile: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          pace_seconds_per_mile?: number;
          created_at?: string;
        };
      };
      workout_logs: {
        Row: {
          id: string;
          user_id: string;
          user_plan_id: string;
          plan_workout_id: string;
          scheduled_date: string;
          completed_at: string | null;
          actual_distance_miles: number | null;
          actual_duration_seconds: number | null;
          strava_activity_id: string | null;
          custom_title: string | null;
          custom_description: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_plan_id: string;
          plan_workout_id: string;
          scheduled_date: string;
          completed_at?: string | null;
          actual_distance_miles?: number | null;
          actual_duration_seconds?: number | null;
          strava_activity_id?: string | null;
          custom_title?: string | null;
          custom_description?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          user_plan_id?: string;
          plan_workout_id?: string;
          scheduled_date?: string;
          completed_at?: string | null;
          actual_distance_miles?: number | null;
          actual_duration_seconds?: number | null;
          strava_activity_id?: string | null;
          custom_title?: string | null;
          custom_description?: string | null;
          notes?: string | null;
        };
      };
      strava_tokens: {
        Row: {
          user_id: string;
          athlete_id: number;
          access_token: string;
          refresh_token: string;
          expires_at: string;
        };
        Insert: {
          user_id: string;
          athlete_id: number;
          access_token: string;
          refresh_token: string;
          expires_at: string;
        };
        Update: {
          user_id?: string;
          athlete_id?: number;
          access_token?: string;
          refresh_token?: string;
          expires_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience row types
export type TrainingPlan = Database["public"]["Tables"]["training_plans"]["Row"];
export type PlanWorkout = Database["public"]["Tables"]["plan_workouts"]["Row"];
export type UserPlan = Database["public"]["Tables"]["user_plans"]["Row"];
export type RunningPace = Database["public"]["Tables"]["running_paces"]["Row"];
export type WorkoutLog = Database["public"]["Tables"]["workout_logs"]["Row"];

// Domain-specific union types
export type WorkoutType = PlanWorkout["type"];
export type PlanType = TrainingPlan["type"];
export type PaceType = NonNullable<PlanWorkout["pace_type"]>;
export type UserPlanStatus = UserPlan["status"];
