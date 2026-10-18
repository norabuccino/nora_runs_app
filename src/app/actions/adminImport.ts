"use server";

// Admin-only bulk imports from plain text (/admin/import). Each one re-checks
// the admin role, then reuses the regular create actions.

import { revalidatePath } from "next/cache";
import { getIsAdmin } from "@/lib/profile";
import { createLibraryWorkout, type LibraryWorkoutData } from "./workoutLibrary";
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
