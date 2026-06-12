"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { WorkoutType, PaceType, RunType } from "@/types/database";

export interface WorkoutStepData {
  step_type: string;
  label?: string | null;
  pace_type?: string | null;
  duration_minutes?: number | null;
  distance_miles?: number | null;
  notes?: string | null;
  repeat_group_id?: number | null;
  repeat_count?: number;
}

export interface WorkoutData {
  plan_id: string;
  week_number: number;
  day_of_week: number;
  type: WorkoutType;
  run_type?: RunType | null;
  title: string;
  description?: string | null;
  distance_miles?: number | null;
  pace_type?: PaceType | null;
  duration_minutes?: number | null;
  notes?: string | null;
  sort_order?: number;
  steps?: WorkoutStepData[];
}

export interface ImportWorkoutRow {
  week: number;
  day: number;
  type: WorkoutType;
  run_type?: RunType | null;
  title: string;
  description?: string | null;
  distance_miles?: number | null;
  pace_type?: PaceType | null;
  duration_minutes?: number | null;
  notes?: string | null;
  steps?: WorkoutStepData[];
}

export async function createWorkout(data: WorkoutData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("id", data.plan_id)
    .eq("user_id", user.id)
    .single();

  if (!plan) throw new Error("Plan not found");

  const { steps, ...workoutRow } = data;
  const { data: workout, error } = await supabase
    .from("plan_workouts")
    .insert(workoutRow)
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (steps?.length) {
    const stepsToInsert = steps.map((s, i) => ({ ...s, plan_workout_id: workout.id, step_order: i }));
    const { error: stepsError } = await supabase.from("workout_steps").insert(stepsToInsert);
    if (stepsError) throw new Error(stepsError.message);
  }

  revalidatePath(`/plans/${data.plan_id}`);
  revalidatePath(`/plans/${data.plan_id}/edit`);
}

export async function updateWorkout(id: string, data: Partial<WorkoutData>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: workout } = await supabase
    .from("plan_workouts")
    .select("plan_id, training_plans!inner(user_id)")
    .eq("id", id)
    .single();

  if (!workout) throw new Error("Workout not found");

  const { steps, ...workoutRow } = data;
  const { error } = await supabase
    .from("plan_workouts")
    .update(workoutRow)
    .eq("id", id);

  if (error) throw new Error(error.message);

  if (steps !== undefined) {
    await supabase.from("workout_steps").delete().eq("plan_workout_id", id);
    if (steps.length) {
      const stepsToInsert = steps.map((s, i) => ({ ...s, plan_workout_id: id, step_order: i }));
      const { error: stepsError } = await supabase.from("workout_steps").insert(stepsToInsert);
      if (stepsError) throw new Error(stepsError.message);
    }
  }

  revalidatePath(`/plans/${workout.plan_id}`);
  revalidatePath(`/plans/${workout.plan_id}/edit`);
}

export async function deleteWorkout(id: string, planId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("plan_workouts").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
}

export async function importWorkouts(
  planId: string,
  rows: ImportWorkoutRow[]
): Promise<{ imported: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single();

  if (!plan) throw new Error("Plan not found");

  let imported = 0;
  for (const row of rows) {
    const { steps, week, day, ...fields } = row;
    const { data: workout, error } = await supabase
      .from("plan_workouts")
      .insert({ ...fields, plan_id: planId, week_number: week, day_of_week: day, sort_order: 0 })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (steps?.length) {
      const stepsToInsert = steps.map((s, i) => ({ ...s, plan_workout_id: workout.id, step_order: i }));
      const { error: stepsError } = await supabase.from("workout_steps").insert(stepsToInsert);
      if (stepsError) throw new Error(stepsError.message);
    }
    imported++;
  }

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
  return { imported };
}
