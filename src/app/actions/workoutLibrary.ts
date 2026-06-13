"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { WorkoutType, PaceType, RunType } from "@/types/database";
import type { WorkoutStepData } from "./workouts";

export interface LibraryWorkoutData {
  type: WorkoutType;
  run_type?: RunType | null;
  title: string;
  description?: string | null;
  distance_miles?: number | null;
  distance_unit?: string;
  pace_type?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  steps?: WorkoutStepData[];
}

export async function createLibraryWorkout(data: LibraryWorkoutData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { steps, ...workoutRow } = data;
  const { data: workout, error } = await supabase
    .from("workouts")
    .insert({ ...workoutRow, user_id: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (steps?.length) {
    const stepsToInsert = steps.map((s, i) => ({ ...s, workout_id: workout.id, step_order: i }));
    const { error: stepsError } = await supabase.from("workout_steps").insert(stepsToInsert);
    if (stepsError) throw new Error(stepsError.message);
  }

  revalidatePath("/workouts");
}

export async function updateLibraryWorkout(id: string, data: LibraryWorkoutData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { steps, ...workoutRow } = data;
  const { error } = await supabase
    .from("workouts")
    .update(workoutRow)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  if (steps !== undefined) {
    await supabase.from("workout_steps").delete().eq("workout_id", id);
    if (steps.length) {
      const stepsToInsert = steps.map((s, i) => ({ ...s, workout_id: id, step_order: i }));
      const { error: stepsError } = await supabase.from("workout_steps").insert(stepsToInsert);
      if (stepsError) throw new Error(stepsError.message);
    }
  }

  revalidatePath("/workouts");
}

export async function deleteLibraryWorkout(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("workouts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/workouts");
}

export async function duplicateLibraryWorkout(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [{ data: workout }, { data: steps }] = await Promise.all([
    supabase.from("workouts").select("*").eq("id", id).eq("user_id", user.id).single(),
    supabase.from("workout_steps").select("*").eq("workout_id", id).order("step_order"),
  ]);
  if (!workout) throw new Error("Workout not found");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, user_id: _uid, ...rest } = workout;
  const { data: copy, error } = await supabase
    .from("workouts")
    .insert({ ...rest, user_id: user.id, title: `Copy of ${workout.title}` })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (steps?.length) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const stepsToInsert = steps.map(({ id: _sid, workout_id: _wid, ...stepRest }) => ({
      ...stepRest,
      workout_id: copy.id,
    }));
    const { error: stepsError } = await supabase.from("workout_steps").insert(stepsToInsert);
    if (stepsError) throw new Error(stepsError.message);
  }

  revalidatePath("/workouts");
}

export async function addLibraryWorkoutToPlan(
  workoutId: string,
  planId: string,
  weekNumber: number,
  dayOfWeek: number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verify ownership of both the library workout and the plan
  const [{ data: workout }, { data: plan }] = await Promise.all([
    supabase.from("workouts").select("*").eq("id", workoutId).eq("user_id", user.id).single(),
    supabase.from("training_plans").select("id").eq("id", planId).eq("user_id", user.id).single(),
  ]);
  if (!workout) throw new Error("Workout not found");
  if (!plan) throw new Error("Plan not found");

  // Copy workout into plan_workouts
  const { data: planWorkout, error } = await supabase
    .from("plan_workouts")
    .insert({
      plan_id: planId,
      week_number: weekNumber,
      day_of_week: dayOfWeek,
      type: workout.type,
      run_type: workout.run_type,
      title: workout.title,
      description: workout.description,
      distance_miles: workout.distance_miles,
      pace_type: workout.pace_type,
      duration_minutes: workout.duration_minutes,
      notes: workout.notes,
      sort_order: 0,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Copy steps
  const { data: steps } = await supabase
    .from("workout_steps")
    .select("*")
    .eq("workout_id", workoutId)
    .order("step_order");

  if (steps?.length) {
    const stepsToInsert = steps.map((s) => ({
      plan_workout_id: planWorkout.id,
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
    }));
    const { error: stepsError } = await supabase.from("workout_steps").insert(stepsToInsert);
    if (stepsError) throw new Error(stepsError.message);
  }

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
}
