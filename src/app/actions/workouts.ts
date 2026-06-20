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
  distance_unit?: string;
  notes?: string | null;
  repeat_group_id?: number | null;
  repeat_count?: number;
  reps?: number | null;
  weight_suggestion?: string | null;
}

export interface WorkoutData {
  plan_id: string;
  week_number: number;
  day_of_week: number;
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

  // Determine day_logic: default to 'or' for multi-workout days, inherit from
  // existing workouts once the user has already set a preference (3rd+).
  const { data: existingOnDay } = await supabase
    .from("plan_workouts")
    .select("id, day_logic")
    .eq("plan_id", data.plan_id)
    .eq("week_number", data.week_number)
    .eq("day_of_week", data.day_of_week);

  const existingCount = existingOnDay?.length ?? 0;
  let dayLogic: "and" | "or";
  if (existingCount === 0) {
    dayLogic = "or";
  } else if (existingCount === 1) {
    dayLogic = "or";
    await supabase.from("plan_workouts").update({ day_logic: "or" }).eq("id", existingOnDay![0].id);
  } else {
    dayLogic = (existingOnDay![0].day_logic as "and" | "or") ?? "or";
  }

  const { steps, ...workoutRow } = data;
  const { data: workout, error } = await supabase
    .from("plan_workouts")
    .insert({ ...workoutRow, day_logic: dayLogic })
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
    .update({ ...workoutRow, library_workout_id: null })
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

export async function copyWorkoutToDays(
  sourceId: string,
  planId: string,
  targets: { weekNumber: number; dayOfWeek: number }[]
) {
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

  const [{ data: source }, { data: sourceSteps }] = await Promise.all([
    supabase.from("plan_workouts").select("*").eq("id", sourceId).single(),
    supabase.from("workout_steps").select("*").eq("plan_workout_id", sourceId).order("step_order"),
  ]);
  if (!source) throw new Error("Source workout not found");

  for (const { weekNumber, dayOfWeek } of targets) {
    const { data: existingOnDay } = await supabase
      .from("plan_workouts")
      .select("id, day_logic")
      .eq("plan_id", planId)
      .eq("week_number", weekNumber)
      .eq("day_of_week", dayOfWeek);

    const existingCount = existingOnDay?.length ?? 0;
    let dayLogic: "and" | "or";
    if (existingCount === 0) {
      dayLogic = "or";
    } else if (existingCount === 1) {
      dayLogic = "or";
      await supabase.from("plan_workouts").update({ day_logic: "or" }).eq("id", existingOnDay![0].id);
    } else {
      dayLogic = (existingOnDay![0].day_logic as "and" | "or") ?? "or";
    }

    const { data: newWorkout, error } = await supabase
      .from("plan_workouts")
      .insert({
        plan_id: planId,
        week_number: weekNumber,
        day_of_week: dayOfWeek,
        type: source.type,
        run_type: source.run_type,
        strength_type: source.strength_type ?? null,
        title: source.title,
        description: source.description,
        distance_miles: source.distance_miles,
        distance_unit: source.distance_unit ?? "mi",
        pace_type: source.pace_type,
        duration_minutes: source.duration_minutes,
        notes: source.notes,
        sort_order: existingCount,
        day_logic: dayLogic,
        library_workout_id: source.library_workout_id ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (sourceSteps?.length) {
      await supabase.from("workout_steps").insert(
        sourceSteps.map((s) => ({
          plan_workout_id: newWorkout.id,
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
          reps: s.reps ?? null,
          weight_suggestion: s.weight_suggestion ?? null,
        }))
      );
    }
  }

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
}

export async function batchUpdateWorkoutPositions(
  planId: string,
  updates: { id: string; week_number: number; day_of_week: number; sort_order: number }[]
) {
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

  await Promise.all(
    updates.map(({ id, week_number, day_of_week, sort_order }) =>
      supabase
        .from("plan_workouts")
        .update({ week_number, day_of_week, sort_order })
        .eq("id", id)
    )
  );

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
}

export async function updateDayLogic(
  planId: string,
  weekNumber: number,
  dayOfWeek: number,
  logic: "and" | "or"
) {
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

  const { error } = await supabase
    .from("plan_workouts")
    .update({ day_logic: logic })
    .eq("plan_id", planId)
    .eq("week_number", weekNumber)
    .eq("day_of_week", dayOfWeek);
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
