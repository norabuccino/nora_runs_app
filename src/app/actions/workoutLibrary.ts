"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { WorkoutType, RunType } from "@/types/database";
import type { WorkoutStepData } from "./workouts";

export interface LibraryWorkoutData {
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
  source?: string | null;
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

  // Cascade edits to all linked plan workouts
  const { data: linked } = await supabase
    .from("plan_workouts")
    .select("id")
    .eq("library_workout_id", id);

  if (linked?.length) {
    await supabase
      .from("plan_workouts")
      .update({
        type: workoutRow.type,
        run_type: workoutRow.run_type ?? null,
        strength_type: workoutRow.strength_type ?? null,
        title: workoutRow.title,
        description: workoutRow.description ?? null,
        distance_miles: workoutRow.distance_miles ?? null,
        distance_unit: workoutRow.distance_unit ?? "mi",
        pace_type: workoutRow.pace_type ?? null,
        duration_minutes: workoutRow.duration_minutes ?? null,
        notes: workoutRow.notes ?? null,
      })
      .eq("library_workout_id", id);

    if (steps !== undefined) {
      for (const pw of linked) {
        await supabase.from("workout_steps").delete().eq("plan_workout_id", pw.id);
        if (steps.length) {
          const stepsToInsert = steps.map((s, i) => ({ ...s, plan_workout_id: pw.id, workout_id: null, step_order: i }));
          await supabase.from("workout_steps").insert(stepsToInsert);
        }
      }
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

export interface ImportStepRow {
  step_type?: string;
  exercise_name?: string | null;
  label?: string | null;
  pace_type?: string | null;
  duration_minutes?: number | null;
  distance_miles?: number | null;
  distance_unit?: string;
  sets?: number | null;
  reps?: number | null;
  weight_suggestion?: string | null;
  both_sides?: boolean;
  notes?: string | null;
  repeat_count?: number;
  repeat_group_id?: number | null;
  group_name?: string | null;
}

export interface LibraryImportRow {
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
  steps?: ImportStepRow[];
}

export async function importLibraryWorkouts(
  rows: LibraryImportRow[]
): Promise<{ imported: number; unmatchedExercises: string[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Admin access required");

  // Build exercise name → id map for step linking
  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, name")
    .eq("user_id", user.id);
  const exerciseByName = new Map(
    (exercises ?? []).map((e) => [e.name.toLowerCase(), e.id])
  );
  const unmatchedSet = new Set<string>();

  let imported = 0;
  for (const row of rows) {
    const { steps, ...fields } = row;
    const { data: workout, error } = await supabase
      .from("workouts")
      .insert({ ...fields, user_id: user.id })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (steps?.length) {
      const stepsToInsert = steps.map((s, i) => {
        let exercise_id: string | null = null;
        let label: string | null = s.label ?? null;

        if (s.exercise_name) {
          const found = exerciseByName.get(s.exercise_name.toLowerCase());
          if (found) {
            exercise_id = found;
            label = s.exercise_name;
          } else {
            unmatchedSet.add(s.exercise_name);
            label = s.exercise_name;
          }
        }

        return {
          workout_id: workout.id,
          step_order: i,
          step_type: s.step_type ?? "main",
          label,
          exercise_id,
          pace_type: s.pace_type ?? null,
          duration_minutes: s.duration_minutes ?? null,
          distance_miles: s.distance_miles ?? null,
          distance_unit: s.distance_unit ?? "mi",
          sets: s.sets ?? null,
          reps: s.reps ?? null,
          weight_suggestion: s.weight_suggestion ?? null,
          both_sides: s.both_sides ?? false,
          notes: s.notes ?? null,
          repeat_count: s.repeat_count ?? 1,
          repeat_group_id: s.repeat_group_id ?? null,
          group_name: s.group_name ?? null,
        };
      });
      const { error: stepsError } = await supabase.from("workout_steps").insert(stepsToInsert);
      if (stepsError) throw new Error(stepsError.message);
    }
    imported++;
  }

  revalidatePath("/workouts");
  return { imported, unmatchedExercises: [...unmatchedSet] };
}

export async function bulkUpdateLibraryWorkouts(
  ids: string[],
  updates: { type?: WorkoutType; run_type?: RunType | null; source?: string | null }
) {
  if (!ids.length) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("workouts")
    .update(updates)
    .in("id", ids)
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

  // Verify ownership of both the library workout and the plan, and fetch
  // existing workouts on the target day to determine sort_order and day_logic.
  const [{ data: workout }, { data: plan }, { data: existingOnDay }] = await Promise.all([
    supabase.from("workouts").select("*").eq("id", workoutId).eq("user_id", user.id).single(),
    supabase.from("training_plans").select("id").eq("id", planId).eq("user_id", user.id).single(),
    supabase
      .from("plan_workouts")
      .select("id, day_logic")
      .eq("plan_id", planId)
      .eq("week_number", weekNumber)
      .eq("day_of_week", dayOfWeek),
  ]);
  if (!workout) throw new Error("Workout not found");
  if (!plan) throw new Error("Plan not found");

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

  // Copy workout into plan_workouts, retaining the library link
  const { data: planWorkout, error } = await supabase
    .from("plan_workouts")
    .insert({
      plan_id: planId,
      week_number: weekNumber,
      day_of_week: dayOfWeek,
      type: workout.type,
      run_type: workout.run_type,
      strength_type: workout.strength_type ?? null,
      title: workout.title,
      description: workout.description,
      distance_miles: workout.distance_miles,
      pace_type: workout.pace_type,
      duration_minutes: workout.duration_minutes,
      notes: workout.notes,
      sort_order: existingCount,
      day_logic: dayLogic,
      library_workout_id: workout.id,
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
      group_name: s.group_name ?? null,
      sets: s.sets ?? null,
      reps: s.reps ?? null,
      weight_suggestion: s.weight_suggestion ?? null,
      video_url: s.video_url ?? null,
      exercise_id: s.exercise_id ?? null,
    }));
    const { error: stepsError } = await supabase.from("workout_steps").insert(stepsToInsert);
    if (stepsError) throw new Error(stepsError.message);
  }

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
}
