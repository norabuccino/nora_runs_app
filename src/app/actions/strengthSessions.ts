"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  WorkoutStep,
  WorkoutSession,
  WorkoutSessionExerciseWithSets,
  WorkoutSetLog,
  Exercise,
} from "@/types/database";

type SessionParent =
  | { planWorkoutId: string; sessionDate: string }
  | { scheduledWorkoutId: string; sessionDate: string };

export interface WorkoutSessionWithExercises {
  session: WorkoutSession;
  exercises: WorkoutSessionExerciseWithSets[];
}

async function fetchSessionExercises(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string
): Promise<WorkoutSessionExerciseWithSets[]> {
  const { data, error } = await supabase
    .from("workout_session_exercises")
    .select("*, workout_set_logs(*)")
    .eq("session_id", sessionId)
    .order("step_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkoutSessionExerciseWithSets[];
}

/**
 * Finds the workout_session already tied to this plan/scheduled workout
 * occurrence, or creates one (snapshotting the current prescription + superset
 * structure from workout_steps so later template edits can't rewrite history).
 * Idempotent — reopening "Start Workout" resumes rather than duplicating.
 */
export async function getOrCreateWorkoutSession(parent: SessionParent): Promise<WorkoutSessionWithExercises> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const parentColumn = "planWorkoutId" in parent ? "plan_workout_id" : "scheduled_workout_id";
  const parentId = "planWorkoutId" in parent ? parent.planWorkoutId : parent.scheduledWorkoutId;

  const { data: existing } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq(parentColumn, parentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const exercises = await fetchSessionExercises(supabase, existing.id);
    return { session: existing, exercises };
  }

  const sourceTable = parentColumn === "plan_workout_id" ? "plan_workouts" : "scheduled_workouts";
  const [{ data: source }, { data: steps }] = await Promise.all([
    supabase.from(sourceTable).select("title, type, strength_type").eq("id", parentId).single(),
    supabase.from("workout_steps").select("*").eq(parentColumn, parentId).order("step_order"),
  ]);
  if (!source) throw new Error("Workout not found");

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      session_date: parent.sessionDate,
      [parentColumn]: parentId,
      title: source.title,
      workout_type: source.type,
      strength_type: source.strength_type,
    })
    .select()
    .single();
  if (sessionError) throw new Error(sessionError.message);

  const exerciseSteps = (steps ?? []).filter(
    (s): s is WorkoutStep & { exercise_id: string } => !!s.exercise_id
  );
  if (exerciseSteps.length === 0) {
    return { session, exercises: [] };
  }

  const exerciseIds = Array.from(new Set(exerciseSteps.map((s) => s.exercise_id)));
  const { data: exerciseRows } = await supabase
    .from("exercises")
    .select("id, load_format")
    .in("id", exerciseIds);
  const loadFormatById = new Map((exerciseRows ?? []).map((e) => [e.id, e.load_format]));

  const { data: insertedExercises, error: exercisesError } = await supabase
    .from("workout_session_exercises")
    .insert(
      exerciseSteps.map((s) => ({
        session_id: session.id,
        exercise_id: s.exercise_id,
        source_workout_step_id: s.id,
        step_order: s.step_order,
        repeat_group_id: s.repeat_group_id,
        repeat_count: s.repeat_count,
        group_name: s.group_name,
        planned_sets: s.sets,
        planned_reps: s.reps,
        planned_duration_minutes: s.duration_minutes,
        planned_duration_unit: s.duration_unit,
        load_format: loadFormatById.get(s.exercise_id) ?? null,
      }))
    )
    .select();
  if (exercisesError) throw new Error(exercisesError.message);

  return {
    session,
    exercises: (insertedExercises ?? []).map((e) => ({ ...e, workout_set_logs: [] })),
  };
}

/**
 * Upserts one actual set. Called immediately when a set is marked done in
 * the session player — not batched at the end — so progress is durable and
 * derivable from completed data as soon as it happens.
 */
export async function logSet(
  sessionExerciseId: string,
  setNumber: number,
  data: {
    weight?: number | null;
    reps_completed?: number | null;
    duration_seconds?: number | null;
    completed?: boolean;
  }
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("workout_set_logs").upsert(
    {
      session_exercise_id: sessionExerciseId,
      set_number: setNumber,
      weight: data.weight ?? null,
      reps_completed: data.reps_completed ?? null,
      duration_seconds: data.duration_seconds ?? null,
      completed: data.completed ?? true,
    },
    { onConflict: "session_exercise_id,set_number" }
  );
  if (error) throw new Error(error.message);
}

export async function completeWorkoutSession(sessionId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("workout_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/progression");
}

export interface ExerciseHistoryEntry {
  sessionId: string;
  sessionDate: string;
  workoutTitle: string;
  loadFormat: string | null;
  plannedReps: number | null;
  plannedDurationSeconds: number | null;
  sets: WorkoutSetLog[];
}

const SESSION_EXERCISE_SELECT =
  "id, exercise_id, load_format, planned_reps, planned_duration_minutes, workout_sessions!inner(id, session_date, title, completed_at, user_id), workout_set_logs(*)";

type SessionExerciseJoinRow = {
  id: string;
  exercise_id: string | null;
  load_format: string | null;
  planned_reps: number | null;
  planned_duration_minutes: number | null;
  workout_sessions: { id: string; session_date: string; title: string } | null;
  workout_set_logs: WorkoutSetLog[];
};

function toHistoryEntry(row: SessionExerciseJoinRow): ExerciseHistoryEntry {
  return {
    sessionId: row.workout_sessions!.id,
    sessionDate: row.workout_sessions!.session_date,
    workoutTitle: row.workout_sessions!.title,
    loadFormat: row.load_format,
    plannedReps: row.planned_reps,
    plannedDurationSeconds: row.planned_duration_minutes != null ? Math.round(row.planned_duration_minutes * 60) : null,
    sets: [...row.workout_set_logs].sort((a, b) => a.set_number - b.set_number),
  };
}

/**
 * Most recent *other* completed performance of each given exercise, followed
 * across every workout it appears in (not scoped to the current workout) —
 * powers the "Last time…" callout in the session player.
 */
export async function getLastPerformances(
  exerciseIds: string[],
  excludeSessionId?: string
): Promise<Record<string, ExerciseHistoryEntry>> {
  if (exerciseIds.length === 0) return {};
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let query = supabase
    .from("workout_session_exercises")
    .select(SESSION_EXERCISE_SELECT)
    .in("exercise_id", exerciseIds)
    .eq("workout_sessions.user_id", user.id)
    .not("workout_sessions.completed_at", "is", null);
  if (excludeSessionId) {
    query = query.neq("workout_sessions.id", excludeSessionId);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const best = new Map<string, SessionExerciseJoinRow>();
  for (const row of (data ?? []) as unknown as SessionExerciseJoinRow[]) {
    if (!row.exercise_id || !row.workout_sessions) continue;
    const current = best.get(row.exercise_id);
    if (!current || row.workout_sessions.session_date > current.workout_sessions!.session_date) {
      best.set(row.exercise_id, row);
    }
  }

  const result: Record<string, ExerciseHistoryEntry> = {};
  for (const [exerciseId, row] of best) {
    result[exerciseId] = toHistoryEntry(row);
  }
  return result;
}

/** Recent completed history for one exercise, most recent first. */
export async function getExerciseHistory(exerciseId: string, limit = 10): Promise<ExerciseHistoryEntry[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("workout_session_exercises")
    .select(SESSION_EXERCISE_SELECT)
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", user.id)
    .not("workout_sessions.completed_at", "is", null);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as SessionExerciseJoinRow[];
  return rows
    .filter((r) => r.workout_sessions)
    .sort((a, b) => b.workout_sessions!.session_date.localeCompare(a.workout_sessions!.session_date))
    .slice(0, limit)
    .map(toHistoryEntry);
}

export interface ProgressionRow {
  exercise: Exercise;
  latest: ExerciseHistoryEntry | null;
  previous: ExerciseHistoryEntry | null;
}

/** Derived Strength Progression dashboard data — latest + previous completed performance per tracked exercise. */
export async function getProgressionDashboard(): Promise<ProgressionRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: exercises, error: exercisesError } = await supabase
    .from("exercises")
    .select("*")
    .eq("track_load", true)
    .order("name");
  if (exercisesError) throw new Error(exercisesError.message);
  if (!exercises || exercises.length === 0) return [];

  const exerciseIds = exercises.map((e) => e.id);
  const { data, error } = await supabase
    .from("workout_session_exercises")
    .select(SESSION_EXERCISE_SELECT)
    .in("exercise_id", exerciseIds)
    .eq("workout_sessions.user_id", user.id)
    .not("workout_sessions.completed_at", "is", null);
  if (error) throw new Error(error.message);

  const byExercise = new Map<string, SessionExerciseJoinRow[]>();
  for (const row of (data ?? []) as unknown as SessionExerciseJoinRow[]) {
    if (!row.exercise_id || !row.workout_sessions) continue;
    const list = byExercise.get(row.exercise_id) ?? [];
    list.push(row);
    byExercise.set(row.exercise_id, list);
  }

  return exercises.map((exercise) => {
    const rows = (byExercise.get(exercise.id) ?? []).sort((a, b) =>
      b.workout_sessions!.session_date.localeCompare(a.workout_sessions!.session_date)
    );
    return {
      exercise,
      latest: rows[0] ? toHistoryEntry(rows[0]) : null,
      previous: rows[1] ? toHistoryEntry(rows[1]) : null,
    };
  });
}
