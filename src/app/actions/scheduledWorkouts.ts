"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { WorkoutType, RunType, ScheduledWorkout } from "@/types/database";

export interface ScheduledWorkoutStepData {
  step_type: string;
  label?: string | null;
  pace_type?: string | null;
  duration_minutes?: number | null;
  distance_miles?: number | null;
  distance_unit?: string;
  notes?: string | null;
  repeat_group_id?: number | null;
  repeat_count?: number;
  group_name?: string | null;
  sets?: number | null;
  reps?: number | null;
  weight_suggestion?: string | null;
  video_url?: string | null;
  exercise_id?: string | null;
  both_sides?: boolean;
}

export interface ScheduledWorkoutData {
  scheduled_date: string;
  type: WorkoutType;
  run_type?: RunType | null;
  strength_type?: string | null;
  title: string;
  description?: string | null;
  distance_miles?: number | null;
  distance_unit?: string;
  pace_type?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  library_workout_id?: string | null;
  steps?: ScheduledWorkoutStepData[];
}

export async function createScheduledWorkout(data: ScheduledWorkoutData): Promise<ScheduledWorkout> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { steps, ...workoutRow } = data;
  const { data: workout, error } = await supabase
    .from("scheduled_workouts")
    .insert({ ...workoutRow, user_id: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (steps?.length) {
    const stepsToInsert = steps.map((s, i) => ({
      ...s,
      scheduled_workout_id: workout.id,
      step_order: i,
    }));
    const { error: stepsError } = await supabase.from("workout_steps").insert(stepsToInsert);
    if (stepsError) throw new Error(stepsError.message);
  }

  revalidatePath("/dashboard");
  return workout;
}

export async function createScheduledWorkoutFromLibrary(
  libraryWorkoutId: string,
  scheduledDate: string
): Promise<ScheduledWorkout> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [{ data: source }, { data: sourceSteps }] = await Promise.all([
    supabase.from("workouts").select("*").eq("id", libraryWorkoutId).single(),
    supabase.from("workout_steps").select("*").eq("workout_id", libraryWorkoutId).order("step_order"),
  ]);
  if (!source) throw new Error("Library workout not found");

  const { data: workout, error } = await supabase
    .from("scheduled_workouts")
    .insert({
      user_id: user.id,
      scheduled_date: scheduledDate,
      type: source.type,
      run_type: source.run_type,
      strength_type: source.strength_type,
      title: source.title,
      description: source.description,
      distance_miles: source.distance_miles,
      distance_unit: source.distance_unit ?? "mi",
      pace_type: source.pace_type,
      duration_minutes: source.duration_minutes,
      notes: source.notes,
      library_workout_id: libraryWorkoutId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (sourceSteps?.length) {
    const { error: stepsError } = await supabase.from("workout_steps").insert(
      sourceSteps.map((s) => ({
        scheduled_workout_id: workout.id,
        step_order: s.step_order,
        step_type: s.step_type,
        label: s.label,
        pace_type: s.pace_type,
        duration_minutes: s.duration_minutes,
        distance_miles: s.distance_miles,
        distance_unit: s.distance_unit ?? "mi",
        notes: s.notes,
        repeat_group_id: s.repeat_group_id,
        repeat_count: s.repeat_count ?? 1,
        group_name: s.group_name ?? null,
        sets: s.sets ?? null,
        reps: s.reps ?? null,
        weight_suggestion: s.weight_suggestion ?? null,
        video_url: s.video_url ?? null,
        exercise_id: s.exercise_id ?? null,
        both_sides: s.both_sides ?? false,
      }))
    );
    if (stepsError) throw new Error(stepsError.message);
  }

  revalidatePath("/dashboard");
  return workout;
}

export async function deleteScheduledWorkout(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("scheduled_workouts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export async function markScheduledWorkoutComplete(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("scheduled_workouts")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export async function unmarkScheduledWorkoutComplete(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("scheduled_workouts")
    .update({ completed_at: null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}
