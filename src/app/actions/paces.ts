"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createPace(name: string, paceSecondsPerMile: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("running_paces").insert({
    user_id: user.id,
    name,
    pace_seconds_per_mile: paceSecondsPerMile,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/paces");
}

export async function updatePace(id: string, name: string, paceSecondsPerMile: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("running_paces")
    .update({ name, pace_seconds_per_mile: paceSecondsPerMile })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/paces");
}

export async function deletePace(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("running_paces")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/paces");
}
