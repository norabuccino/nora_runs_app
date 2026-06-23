"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PlanType } from "@/types/database";

export async function createPlan(data: {
  name: string;
  type: PlanType;
  description: string;
  total_weeks: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: plan, error } = await supabase
    .from("training_plans")
    .insert({ ...data, user_id: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/plans");
  redirect(`/plans/${plan.id}/edit`);
}

export async function updatePlan(
  id: string,
  data: { name?: string; type?: PlanType; description?: string; total_weeks?: number }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("training_plans")
    .update(data)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/plans");
  revalidatePath(`/plans/${id}`);
}

export async function upsertWeekPurpose(planId: string, weekNumber: number, purpose: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (!purpose.trim()) {
    await supabase
      .from("plan_week_notes")
      .delete()
      .eq("plan_id", planId)
      .eq("week_number", weekNumber);
  } else {
    await supabase
      .from("plan_week_notes")
      .upsert(
        { plan_id: planId, week_number: weekNumber, purpose: purpose.trim() },
        { onConflict: "plan_id,week_number" }
      );
  }
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
}

export async function duplicatePlan(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Not authorized");

  const { data: source } = await supabase.from("training_plans").select("*").eq("id", id).single();
  if (!source) throw new Error("Plan not found");

  const { data: newPlan, error: planError } = await supabase
    .from("training_plans")
    .insert({
      user_id: user.id,
      name: `Copy of ${source.name}`,
      type: source.type,
      description: source.description,
      total_weeks: source.total_weeks,
    })
    .select()
    .single();
  if (planError) throw new Error(planError.message);

  const { data: sourceWorkouts } = await supabase
    .from("plan_workouts")
    .select("*")
    .eq("plan_id", id)
    .order("week_number")
    .order("sort_order");

  if (sourceWorkouts?.length) {
    const { data: newWorkouts, error: workoutsError } = await supabase
      .from("plan_workouts")
      .insert(
        sourceWorkouts.map(({ id: _id, plan_id: _pid, ...rest }) => ({
          ...rest,
          plan_id: newPlan.id,
        }))
      )
      .select("id");
    if (workoutsError) throw new Error(workoutsError.message);

    if (newWorkouts?.length) {
      const idMap: Record<string, string> = {};
      sourceWorkouts.forEach((w, i) => { idMap[w.id] = newWorkouts[i].id; });

      const { data: sourceSteps } = await supabase
        .from("workout_steps")
        .select("*")
        .in("plan_workout_id", sourceWorkouts.map((w) => w.id))
        .order("step_order");

      if (sourceSteps?.length) {
        const { error: stepsError } = await supabase.from("workout_steps").insert(
          sourceSteps.map(({ id: _id, plan_workout_id, ...rest }) => ({
            ...rest,
            plan_workout_id: idMap[plan_workout_id!],
          }))
        );
        if (stepsError) throw new Error(stepsError.message);
      }
    }
  }

  const { data: weekNotes } = await supabase
    .from("plan_week_notes")
    .select("*")
    .eq("plan_id", id);

  if (weekNotes?.length) {
    await supabase.from("plan_week_notes").insert(
      weekNotes.map(({ id: _id, plan_id: _pid, ...rest }) => ({
        ...rest,
        plan_id: newPlan.id,
      }))
    );
  }

  revalidatePath("/plans");
  redirect(`/plans/${newPlan.id}/edit`);
}

export async function deletePlan(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("training_plans")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/plans");
  redirect("/plans");
}
