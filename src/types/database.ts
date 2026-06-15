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
          type: "marathon" | "half_marathon" | "strength" | "custom" | "5k_10k" | "base_building";
          description: string | null;
          total_weeks: number;
          created_at: string;
          source_plan_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: "marathon" | "half_marathon" | "strength" | "custom" | "5k_10k" | "base_building";
          description?: string | null;
          total_weeks: number;
          created_at?: string;
          source_plan_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: "marathon" | "half_marathon" | "strength" | "custom" | "5k_10k" | "base_building";
          description?: string | null;
          total_weeks?: number;
          created_at?: string;
          source_plan_id?: string | null;
        };
      };
      plan_workouts: {
        Row: {
          id: string;
          plan_id: string;
          week_number: number;
          day_of_week: number;
          type: "run" | "strength" | "rest" | "cross_train" | "bike" | "swim" | "yoga" | "elliptical";
          run_type: "easy_run" | "tempo_run" | "interval_run" | "threshold_run" | "recovery_run" | "race" | "long_run" | null;
          title: string;
          description: string | null;
          distance_miles: number | null;
          distance_unit: string;
          pace_type: string | null;
          duration_minutes: number | null;
          notes: string | null;
          sort_order: number;
          day_logic: "and" | "or";
        };
        Insert: {
          id?: string;
          plan_id: string;
          week_number: number;
          day_of_week: number;
          type: "run" | "strength" | "rest" | "cross_train" | "bike" | "swim" | "yoga" | "elliptical";
          run_type?: "easy_run" | "tempo_run" | "interval_run" | "threshold_run" | "recovery_run" | "race" | "long_run" | null;
          title: string;
          description?: string | null;
          distance_miles?: number | null;
          distance_unit?: string;
          pace_type?: string | null;
          duration_minutes?: number | null;
          notes?: string | null;
          sort_order?: number;
          day_logic?: "and" | "or";
        };
        Update: {
          id?: string;
          plan_id?: string;
          week_number?: number;
          day_of_week?: number;
          type?: "run" | "strength" | "rest" | "cross_train" | "bike" | "swim" | "yoga" | "elliptical";
          run_type?: "easy_run" | "tempo_run" | "interval_run" | "threshold_run" | "recovery_run" | "race" | "long_run" | null;
          title?: string;
          description?: string | null;
          distance_miles?: number | null;
          distance_unit?: string;
          pace_type?: string | null;
          duration_minutes?: number | null;
          notes?: string | null;
          sort_order?: number;
          day_logic?: "and" | "or";
        };
      };
      workout_steps: {
        Row: {
          id: string;
          plan_workout_id: string | null;
          workout_id: string | null;
          step_order: number;
          step_type: string;
          label: string | null;
          pace_type: string | null;
          duration_minutes: number | null;
          distance_miles: number | null;
          distance_unit: string;
          notes: string | null;
          repeat_group_id: number | null;
          repeat_count: number;
        };
        Insert: {
          id?: string;
          plan_workout_id?: string | null;
          workout_id?: string | null;
          step_order?: number;
          step_type?: string;
          label?: string | null;
          pace_type?: string | null;
          duration_minutes?: number | null;
          distance_miles?: number | null;
          distance_unit?: string;
          notes?: string | null;
          repeat_group_id?: number | null;
          repeat_count?: number;
        };
        Update: {
          id?: string;
          plan_workout_id?: string | null;
          workout_id?: string | null;
          step_order?: number;
          step_type?: string;
          label?: string | null;
          pace_type?: string | null;
          duration_minutes?: number | null;
          distance_miles?: number | null;
          distance_unit?: string;
          notes?: string | null;
          repeat_group_id?: number | null;
          repeat_count?: number;
        };
      };
      workouts: {
        Row: {
          id: string;
          user_id: string;
          type: "run" | "strength" | "rest" | "cross_train" | "bike" | "swim" | "yoga" | "elliptical";
          run_type: "easy_run" | "tempo_run" | "interval_run" | "threshold_run" | "recovery_run" | "race" | "long_run" | null;
          title: string;
          description: string | null;
          distance_miles: number | null;
          distance_unit: string;
          pace_type: string | null;
          duration_minutes: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "run" | "strength" | "rest" | "cross_train" | "bike" | "swim" | "yoga" | "elliptical";
          run_type?: "easy_run" | "tempo_run" | "interval_run" | "threshold_run" | "recovery_run" | "race" | "long_run" | null;
          title: string;
          description?: string | null;
          distance_miles?: number | null;
          distance_unit?: string;
          pace_type?: string | null;
          duration_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: "run" | "strength" | "rest" | "cross_train" | "bike" | "swim" | "yoga" | "elliptical";
          run_type?: "easy_run" | "tempo_run" | "interval_run" | "threshold_run" | "recovery_run" | "race" | "long_run" | null;
          title?: string;
          description?: string | null;
          distance_miles?: number | null;
          distance_unit?: string;
          pace_type?: string | null;
          duration_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
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
export type WorkoutStep = Database["public"]["Tables"]["workout_steps"]["Row"];
export type LibraryWorkout = Database["public"]["Tables"]["workouts"]["Row"];

// Domain-specific union types
export type WorkoutType = PlanWorkout["type"];
export type RunType = NonNullable<PlanWorkout["run_type"]>;
export type PlanType = TrainingPlan["type"];
export type PaceType = NonNullable<PlanWorkout["pace_type"]>;
export type UserPlanStatus = UserPlan["status"];

// Extended types with steps loaded
export type WorkoutWithSteps = PlanWorkout & { workout_steps: WorkoutStep[] };
export type LibraryWorkoutWithSteps = LibraryWorkout & { workout_steps: WorkoutStep[] };
