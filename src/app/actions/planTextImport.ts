"use server";

import { createClient } from "@/lib/supabase/server";
import { canEditPlan } from "@/lib/contentAccess";
import { revalidatePath } from "next/cache";
import { createWorkout, updateDayLogic, type WorkoutData } from "./workouts";
import { addLibraryWorkoutToPlan } from "./workoutLibrary";

/** A plan workout to create: a quick one guessed from a name, or one written out in full with steps. */
export type PlanWorkoutInput = Omit<WorkoutData, "plan_id" | "week_number" | "day_of_week" | "sort_order">;

export interface PlanTextImportItem {
  week: number;
  /** 0-based plan day. */
  day: number;
  /** Copy this library workout… */
  libraryWorkoutId?: string;
  /** …or create this new one. */
  workout?: PlanWorkoutInput;
  logic: "and" | "or";
}

/**
 * Adds the workouts from a pasted plan, in order, after anything already on each
 * day. Library workouts are copied the same way as "Add to plan". Slots written
 * with "+" get AND day logic.
 */
export async function addPlanWorkoutsFromText(planId: string, items: PlanTextImportItem[]): Promise<{ added: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  if (!(await canEditPlan(supabase, planId))) throw new Error("Plan not found");

  let added = 0;
  const andSlots = new Set<string>();
  for (const item of items) {
    if (item.libraryWorkoutId) {
      await addLibraryWorkoutToPlan(item.libraryWorkoutId, planId, item.week, item.day);
    } else if (item.workout) {
      const { count } = await supabase
        .from("plan_workouts")
        .select("id", { count: "exact", head: true })
        .eq("plan_id", planId)
        .eq("week_number", item.week)
        .eq("day_of_week", item.day);
      await createWorkout({ ...item.workout, plan_id: planId, week_number: item.week, day_of_week: item.day, sort_order: count ?? 0 });
    } else {
      continue;
    }
    added++;
    if (item.logic === "and") andSlots.add(`${item.week}:${item.day}`);
  }
  for (const slot of andSlots) {
    const [week, day] = slot.split(":").map(Number);
    await updateDayLogic(planId, week, day, "and");
  }

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
  revalidatePath("/my-plan");
  return { added };
}
