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

  const { error } = await supabase.from("user_plans").insert({
    user_id: user.id,
    plan_id: planId,
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
