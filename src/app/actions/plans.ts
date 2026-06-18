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
