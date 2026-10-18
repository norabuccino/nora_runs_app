"use server";

// Admin-only bulk imports from plain text (/admin/import). Each one re-checks
// the admin role, then reuses the regular create actions.

import { revalidatePath } from "next/cache";
import { getIsAdmin } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { createLibraryWorkout, type LibraryWorkoutData } from "./workoutLibrary";
import { addPlanWorkoutsFromText, type PlanTextImportItem } from "./planTextImport";
import { importExercises, type ExerciseImportRow } from "./exercises";
import type { PlanType, DifficultyType } from "@/types/database";
import type { WorkoutPayload } from "@/lib/workoutTextBlock";

async function requireAdmin() {
  if (!(await getIsAdmin())) throw new Error("Admin access required");
}

/** Saves each workout (with its steps) to the admin's workout library, in order. */
export async function adminImportLibraryWorkouts(workouts: WorkoutPayload[]): Promise<{ count: number }> {
  await requireAdmin();
  for (const w of workouts) {
    await createLibraryWorkout(w as LibraryWorkoutData);
  }
  revalidatePath("/workouts");
  return { count: workouts.length };
}

/** Creates a plan, then fills it with the pasted weeks/days (library copies or new workouts). */
export async function adminImportPlan(
  plan: {
    name: string;
    type: PlanType;
    difficulty: DifficultyType | null;
    days_per_week: number | null;
    description: string;
    total_weeks: number;
    source: string | null;
  },
  items: PlanTextImportItem[]
): Promise<{ planId: string; added: number }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: created, error } = await supabase
    .from("training_plans")
    .insert({ ...plan, user_id: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { added } = await addPlanWorkoutsFromText(created.id, items);
  revalidatePath("/plans");
  return { planId: created.id, added };
}

/** Adds new exercises to the library (the regular import, admin-gated here). */
export async function adminImportExercises(rows: ExerciseImportRow[]): Promise<{ count: number }> {
  await requireAdmin();
  return importExercises(rows);
}
