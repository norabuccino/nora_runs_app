"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function assignPlan(planId: string, startDate: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Pause any currently active plan
  await supabase
    .from("user_plans")
    .update({ status: "paused" })
    .eq("user_id", user.id)
    .eq("status", "active");

  // Load the source plan
  const { data: sourcePlan } = await supabase
    .from("training_plans")
    .select("*")
    .eq("id", planId)
    .single();
  if (!sourcePlan) throw new Error("Plan not found");

  // Create a personal copy of the plan owned by this user
  const { data: personalPlan, error: planError } = await supabase
    .from("training_plans")
    .insert({
      user_id: user.id,
      name: sourcePlan.name,
      type: sourcePlan.type,
      description: sourcePlan.description,
      total_weeks: sourcePlan.total_weeks,
      source_plan_id: planId,
    })
    .select()
    .single();
  if (planError) throw new Error(planError.message);

  // Copy workouts from source plan into the personal copy
  const { data: sourceWorkouts } = await supabase
    .from("plan_workouts")
    .select("*")
    .eq("plan_id", planId)
    .order("week_number")
    .order("sort_order");

  if (sourceWorkouts?.length) {
    const { data: newWorkouts, error: workoutsError } = await supabase
      .from("plan_workouts")
      .insert(
        sourceWorkouts.map(({ id: _id, plan_id: _pid, ...rest }) => ({
          ...rest,
          plan_id: personalPlan.id,
        }))
      )
      .select("id");
    if (workoutsError) throw new Error(workoutsError.message);

    // Copy workout steps; rely on insertion order matching to build old→new ID map
    if (newWorkouts?.length) {
      const idMap: Record<string, string> = {};
      sourceWorkouts.forEach((w, i) => { idMap[w.id] = newWorkouts[i].id; });

      const { data: sourceSteps } = await supabase
        .from("workout_steps")
        .select("*")
        .in("plan_workout_id", sourceWorkouts.map((w) => w.id))
        .order("step_order");

      if (sourceSteps?.length) {
        const stepsToInsert = sourceSteps.map(({ id: _id, plan_workout_id, ...rest }) => ({
          ...rest,
          plan_workout_id: idMap[plan_workout_id!],
        }));
        const { error: stepsError } = await supabase.from("workout_steps").insert(stepsToInsert);
        if (stepsError) throw new Error(stepsError.message);
      }
    }
  }

  // Link user_plan to the personal copy
  const { error } = await supabase.from("user_plans").insert({
    user_id: user.id,
    plan_id: personalPlan.id,
    start_date: startDate,
    status: "active",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/my-plan");
  revalidatePath("/dashboard");
  redirect("/my-plan");
}

export async function updateUserPlan(
  id: string,
  data: { status?: "active" | "paused" | "completed"; start_date?: string }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_plans")
    .update(data)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/my-plan");
  revalidatePath("/dashboard");
}

export async function markWorkoutComplete(
  userPlanId: string,
  planWorkoutId: string,
  scheduledDate: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("workout_logs").upsert(
    {
      user_id: user.id,
      user_plan_id: userPlanId,
      plan_workout_id: planWorkoutId,
      scheduled_date: scheduledDate,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_plan_id,plan_workout_id" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function unmarkWorkoutComplete(userPlanId: string, planWorkoutId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("workout_logs")
    .update({ completed_at: null })
    .eq("user_plan_id", userPlanId)
    .eq("plan_workout_id", planWorkoutId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
