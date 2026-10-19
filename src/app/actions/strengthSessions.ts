"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sortSetLogs } from "@/lib/strengthProgression";
import type { SetLogRemoval, SetLogUpsert } from "@/lib/setLogForm";
import {
  loggedSetCount,
  mergeCompletedWork,
  plannedSetsByExercise,
  type CompletedWorkout,
  type Performance,
} from "@/lib/muscleGroupBreakdown";
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
 * Upserts one actual set (one side of a set, for `both_sides` exercises). Called immediately when a set is marked done in
 * the session player — not batched at the end — so progress is durable and
 * derivable from completed data as soon as it happens.
 */
export async function logSet(
  sessionExerciseId: string,
  setNumber: number,
  side: "left" | "right" | null,
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
      side,
      weight: data.weight ?? null,
      reps_completed: data.reps_completed ?? null,
      duration_seconds: data.duration_seconds ?? null,
      completed: data.completed ?? true,
    },
    { onConflict: "session_exercise_id,set_number,side" }
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

/**
 * Saves a whole session's sets at once (the "Log sets" sheet, for logging a
 * workout after the fact): upserts the ticked sets, deletes unticked ones that
 * had been logged, and marks the session complete if it wasn't already.
 */
export async function saveLoggedSets(
  sessionId: string,
  upserts: SetLogUpsert[],
  removals: SetLogRemoval[]
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id, completed_at, workout_session_exercises(id)")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();
  if (!session) throw new Error("Session not found");
  const ownIds = new Set(session.workout_session_exercises.map((e) => e.id));
  if ([...upserts, ...removals].some((s) => !ownIds.has(s.sessionExerciseId))) {
    throw new Error("Set does not belong to this session");
  }

  if (upserts.length) {
    const { error } = await supabase.from("workout_set_logs").upsert(
      upserts.map((s) => ({
        session_exercise_id: s.sessionExerciseId,
        set_number: s.setNumber,
        side: s.side,
        weight: s.weight,
        reps_completed: s.reps_completed,
        duration_seconds: s.duration_seconds,
        completed: true,
      })),
      { onConflict: "session_exercise_id,set_number,side" }
    );
    if (error) throw new Error(error.message);
  }

  for (const r of removals) {
    let query = supabase
      .from("workout_set_logs")
      .delete()
      .eq("session_exercise_id", r.sessionExerciseId)
      .eq("set_number", r.setNumber);
    query = r.side ? query.eq("side", r.side) : query.is("side", null);
    const { error } = await query;
    if (error) throw new Error(error.message);
  }

  if (!session.completed_at) {
    const { error } = await supabase
      .from("workout_sessions")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  }

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
    sets: sortSetLogs(row.workout_set_logs),
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

/** Derived Strength Progression dashboard data — latest + previous completed performance per tracked exercise that has been done at least once. */
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

  // Only exercises that have been done at least once — tracked-but-never-logged
  // exercises would just be rows of dashes.
  return exercises
    .filter((exercise) => byExercise.has(exercise.id))
    .map((exercise) => {
      const rows = byExercise.get(exercise.id)!.sort((a, b) =>
        b.workout_sessions!.session_date.localeCompare(a.workout_sessions!.session_date)
      );
      return {
        exercise,
        latest: toHistoryEntry(rows[0]),
        previous: rows[1] ? toHistoryEntry(rows[1]) : null,
      };
    });
}

export interface MuscleGroupBreakdownData {
  performances: Performance[];
  muscleGroupsByExercise: Record<string, string[]>;
}

/**
 * Every completed exercise performance (logged sessions + workouts marked
 * complete without logging) and each exercise's muscle groups — powers the
 * muscle group balance on /progression. Date-range filtering happens client-side.
 */
export async function getMuscleGroupBreakdown(): Promise<MuscleGroupBreakdownData> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [sessionsRes, logsRes, scheduledRes] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("session_date, plan_workout_id, scheduled_workout_id, workout_session_exercises(exercise_id, planned_sets, repeat_count, workout_set_logs(set_number))")
      .eq("user_id", user.id)
      .not("completed_at", "is", null),
    supabase
      .from("workout_logs")
      .select("plan_workout_id, scheduled_date")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .not("plan_workout_id", "is", null),
    supabase
      .from("scheduled_workouts")
      .select("id, scheduled_date")
      .eq("user_id", user.id)
      .not("completed_at", "is", null),
  ]);
  for (const r of [sessionsRes, logsRes, scheduledRes]) if (r.error) throw new Error(r.error.message);

  type SessionRow = {
    session_date: string;
    plan_workout_id: string | null;
    scheduled_workout_id: string | null;
    workout_session_exercises: {
      exercise_id: string | null;
      planned_sets: number | null;
      repeat_count: number | null;
      workout_set_logs: { set_number: number }[];
    }[];
  };
  const sessions: CompletedWorkout[] = ((sessionsRes.data ?? []) as unknown as SessionRow[]).map((s) => ({
    date: s.session_date,
    planWorkoutId: s.plan_workout_id,
    scheduledWorkoutId: s.scheduled_workout_id,
    exercises: s.workout_session_exercises
      .filter((e): e is typeof e & { exercise_id: string } => !!e.exercise_id)
      .map((e) => ({
        exerciseId: e.exercise_id,
        sets: loggedSetCount(e.workout_set_logs.map((l) => l.set_number), {
          plannedSets: e.planned_sets,
          repeatCount: e.repeat_count,
        }),
      })),
  }));

  const logs = (logsRes.data ?? []).filter((l): l is { plan_workout_id: string; scheduled_date: string } => !!l.plan_workout_id && !!l.scheduled_date);
  const scheduled = scheduledRes.data ?? [];
  const planIds = Array.from(new Set(logs.map((l) => l.plan_workout_id)));
  const scheduledIds = scheduled.map((s) => s.id);

  const [planStepsRes, scheduledStepsRes] = await Promise.all([
    planIds.length
      ? supabase.from("workout_steps").select("*").in("plan_workout_id", planIds).order("step_order")
      : Promise.resolve({ data: [] as WorkoutStep[], error: null }),
    scheduledIds.length
      ? supabase.from("workout_steps").select("*").in("scheduled_workout_id", scheduledIds).order("step_order")
      : Promise.resolve({ data: [] as WorkoutStep[], error: null }),
  ]);
  for (const r of [planStepsRes, scheduledStepsRes]) if (r.error) throw new Error(r.error.message);

  const stepsBy = (rows: WorkoutStep[], key: "plan_workout_id" | "scheduled_workout_id") => {
    const map = new Map<string, WorkoutStep[]>();
    for (const step of rows) {
      const id = step[key];
      if (!id) continue;
      map.set(id, [...(map.get(id) ?? []), step]);
    }
    return map;
  };
  const planSteps = stepsBy(planStepsRes.data ?? [], "plan_workout_id");
  const scheduledSteps = stepsBy(scheduledStepsRes.data ?? [], "scheduled_workout_id");

  const markedComplete: CompletedWorkout[] = [
    ...logs.map((l) => ({
      date: l.scheduled_date,
      planWorkoutId: l.plan_workout_id,
      scheduledWorkoutId: null,
      exercises: plannedSetsByExercise(planSteps.get(l.plan_workout_id) ?? []),
    })),
    ...scheduled.map((s) => ({
      date: s.scheduled_date,
      planWorkoutId: null,
      scheduledWorkoutId: s.id,
      exercises: plannedSetsByExercise(scheduledSteps.get(s.id) ?? []),
    })),
  ];

  const performances = mergeCompletedWork(sessions, markedComplete);
  const exerciseIds = Array.from(new Set(performances.map((p) => p.exerciseId)));
  const muscleGroupsByExercise: Record<string, string[]> = {};
  if (exerciseIds.length) {
    const { data: exercises, error } = await supabase
      .from("exercises")
      .select("id, muscle_groups")
      .in("id", exerciseIds);
    if (error) throw new Error(error.message);
    for (const e of exercises ?? []) muscleGroupsByExercise[e.id] = e.muscle_groups ?? [];
  }

  return { performances, muscleGroupsByExercise };
}
