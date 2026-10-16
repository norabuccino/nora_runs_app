"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Exercise } from "@/types/database";
import { addSources, normalizeSources } from "@/lib/exerciseSources";
import { applyMuscleGroupChange, sortMuscleGroups } from "@/lib/muscleGroups";
import { summarizeExerciseUsage, type ExerciseUsageEntry, type ExerciseUsageStepRow } from "@/lib/exerciseUsage";

export type ExerciseImportRow = {
  name: string;
  exercise_type: string | null;
  description: string | null;
  video_url: string | null;
  sources: string[];
  muscle_groups?: string[];
  is_private?: boolean;
  loading_category?: string | null;
  track_load?: boolean;
  load_format?: string | null;
  default_increment?: number | null;
};

export async function createExercise(data: {
  name: string;
  description?: string | null;
  video_url?: string | null;
  exercise_type?: string | null;
  sources?: string[];
  muscle_groups?: string[];
  is_private?: boolean;
  loading_category?: string | null;
  track_load?: boolean;
  load_format?: string | null;
  default_increment?: number | null;
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
  data: {
    name?: string;
    description?: string | null;
    video_url?: string | null;
    exercise_type?: string | null;
    sources?: string[];
    muscle_groups?: string[];
    is_private?: boolean;
    loading_category?: string | null;
    track_load?: boolean;
    load_format?: string | null;
    default_increment?: number | null;
  }
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

export async function getExerciseUsage(id: string): Promise<{
  workouts: ExerciseUsageEntry[];
  historyCount: number;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [{ data: steps, error }, { count }] = await Promise.all([
    supabase
      .from("workout_steps")
      .select(
        "plan_workout_id, workout_id, scheduled_workout_id, plan_workouts(title, training_plans(name)), workouts(title), scheduled_workouts(title, scheduled_date)"
      )
      .eq("exercise_id", id),
    supabase
      .from("workout_session_exercises")
      .select("id", { count: "exact", head: true })
      .eq("exercise_id", id),
  ]);
  if (error) throw new Error(error.message);

  return {
    workouts: summarizeExerciseUsage((steps ?? []) as unknown as ExerciseUsageStepRow[]),
    historyCount: count ?? 0,
  };
}

// Deletes an exercise. When `replacement` is given, every workout step using the
// exercise is first repointed at the replacement (and, optionally, its logged
// strength history moved over too) so workouts don't lose the link.
export async function deleteExercise(
  id: string,
  replacement?: { exerciseId: string; moveHistory: boolean }
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (replacement) {
    if (replacement.exerciseId === id) throw new Error("Pick a different exercise as the replacement");
    const [{ data: oldEx }, { data: newEx, error: newErr }] = await Promise.all([
      supabase.from("exercises").select("video_url").eq("id", id).single(),
      supabase.from("exercises").select("id, name, video_url").eq("id", replacement.exerciseId).single(),
    ]);
    if (newErr || !newEx) throw new Error("Replacement exercise not found");

    const { error: stepErr } = await supabase
      .from("workout_steps")
      .update({ exercise_id: newEx.id, label: newEx.name })
      .eq("exercise_id", id);
    if (stepErr) throw new Error(stepErr.message);

    // Steps that carried the old exercise's video get the replacement's video.
    if (oldEx?.video_url) {
      await supabase
        .from("workout_steps")
        .update({ video_url: newEx.video_url })
        .eq("exercise_id", newEx.id)
        .eq("video_url", oldEx.video_url);
    }

    if (replacement.moveHistory) {
      const { error: histErr } = await supabase
        .from("workout_session_exercises")
        .update({ exercise_id: newEx.id })
        .eq("exercise_id", id);
      if (histErr) throw new Error(histErr.message);
    }
  }

  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/exercises");
  if (replacement) {
    revalidatePath("/plans", "layout");
    revalidatePath("/workouts");
    revalidatePath("/progression");
  }
}

export async function bulkUpdateExercises(
  ids: string[],
  data: {
    exercise_type?: string | null;
    addSources?: string[];
    addMuscleGroups?: string[];
    removeMuscleGroups?: string[];
  }
): Promise<void> {
  if (!ids.length) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (data.exercise_type !== undefined) {
    const { error } = await supabase
      .from("exercises")
      .update({ exercise_type: data.exercise_type })
      .in("id", ids)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  }

  // Sources are added to each exercise's existing list, never replace it.
  // Muscle groups are added/removed per exercise, keeping its other groups.
  const added = normalizeSources(data.addSources ?? []);
  const muscleChange = { add: data.addMuscleGroups ?? [], remove: data.removeMuscleGroups ?? [] };
  const hasMuscleChange = muscleChange.add.length > 0 || muscleChange.remove.length > 0;
  if (added.length || hasMuscleChange) {
    const { data: rows, error } = await supabase
      .from("exercises")
      .select("id, sources, muscle_groups")
      .in("id", ids)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    const results = await Promise.all(
      (rows ?? []).map((row) =>
        supabase
          .from("exercises")
          .update({
            ...(added.length ? { sources: addSources(row.sources ?? [], added) } : {}),
            ...(hasMuscleChange ? { muscle_groups: applyMuscleGroupChange(row.muscle_groups, muscleChange) } : {}),
          })
          .eq("id", row.id)
          .eq("user_id", user.id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
  }

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
    sources: normalizeSources(row.sources),
    muscle_groups: sortMuscleGroups(row.muscle_groups),
    is_private: row.is_private ?? false,
    loading_category: row.loading_category ?? null,
    track_load: row.track_load ?? false,
    load_format: row.load_format ?? null,
    default_increment: row.default_increment ?? null,
  }));

  const { error } = await supabase.from("exercises").insert(inserts);
  if (error) throw new Error(error.message);

  revalidatePath("/exercises");
  return { count: rows.length };
}
