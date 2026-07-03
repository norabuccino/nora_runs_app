"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Exercise } from "@/types/database";

export type ExerciseImportRow = {
  name: string;
  exercise_type: string | null;
  description: string | null;
  video_url: string | null;
  source: string | null;
};

export async function createExercise(data: {
  name: string;
  description?: string | null;
  video_url?: string | null;
  exercise_type?: string | null;
  source?: string | null;
}): Promise<Exercise> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: exercise, error } = await supabase
    .from("exercises")
    .insert({ ...data, user_id: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/exercises");
  return exercise;
}

export async function updateExercise(
  id: string,
  data: { name?: string; description?: string | null; video_url?: string | null; exercise_type?: string | null; source?: string | null }
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("exercises")
    .update(data)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  if (data.name) {
    await supabase
      .from("workout_steps")
      .update({ label: data.name })
      .eq("exercise_id", id);
  }

  revalidatePath("/exercises");
}

export async function deleteExercise(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/exercises");
}

export async function bulkUpdateExercises(
  ids: string[],
  data: { exercise_type?: string | null; source?: string | null }
): Promise<void> {
  if (!ids.length) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("exercises")
    .update(data)
    .in("id", ids)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/exercises");
}

export async function importExercises(rows: ExerciseImportRow[]): Promise<{ count: number }> {
  if (!rows.length) return { count: 0 };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const inserts = rows.map((row) => ({
    user_id: user.id,
    name: row.name,
    exercise_type: row.exercise_type,
    description: row.description,
    video_url: row.video_url,
    source: row.source,
  }));

  const { error } = await supabase.from("exercises").insert(inserts);
  if (error) throw new Error(error.message);

  revalidatePath("/exercises");
  return { count: rows.length };
}
