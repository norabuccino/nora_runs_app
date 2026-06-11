"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { WorkoutType, PaceType } from "@/types/database";

export interface WorkoutData {
  plan_id: string;
  week_number: number;
  day_of_week: number;
  type: WorkoutType;
  title: string;
  description?: string | null;
  distance_miles?: number | null;
  pace_type?: PaceType | null;
  duration_minutes?: number | null;
  notes?: string | null;
  sort_order?: number;
}

export async function createWorkout(data: WorkoutData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verify user owns the plan
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("id", data.plan_id)
    .eq("user_id", user.id)
    .single();

  if (!plan) throw new Error("Plan not found");

  const { error } = await supabase.from("plan_workouts").insert(data);
  if (error) throw new Error(error.message);

  revalidatePath(`/plans/${data.plan_id}`);
  revalidatePath(`/plans/${data.plan_id}/edit`);
}

export async function updateWorkout(id: string, data: Partial<WorkoutData>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verify ownership via join
  const { data: workout } = await supabase
    .from("plan_workouts")
    .select("plan_id, training_plans!inner(user_id)")
    .eq("id", id)
    .single();

  if (!workout) throw new Error("Workout not found");

  const { error } = await supabase
    .from("plan_workouts")
    .update(data)
    .eq("id", id);

  if (error) throw new Error(error.message);

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
