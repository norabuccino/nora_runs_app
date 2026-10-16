// Muscle group balance on /progression: how much completed work landed on each
// muscle group. Work is counted in sets — the logged sets when a workout was
// done in the session player, otherwise the planned sets of a workout that was
// simply marked complete. An exercise tagged with several groups counts its
// sets toward each of them.

import type { WorkoutStep } from "@/types/database";
import { buildSessionBeats } from "@/lib/workoutSteps";
import { MUSCLE_GROUPS } from "@/lib/muscleGroups";

export type ExerciseSets = { exerciseId: string; sets: number };

export type CompletedWorkout = {
  date: string; // YYYY-MM-DD
  planWorkoutId: string | null;
  scheduledWorkoutId: string | null;
  exercises: ExerciseSets[];
};

export type Performance = ExerciseSets & { date: string; logged: boolean };

// How close a logged session's date must be to a plan workout's scheduled date
// to count as the same completion (sessions are dated when they're done, which
// can be a few days off the plan's slot).
const SAME_COMPLETION_WINDOW_DAYS = 7;

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/** Planned sets per exercise for a workout's steps (a both-sides set counts once). */
export function plannedSetsByExercise(steps: WorkoutStep[]): ExerciseSets[] {
  const totals = new Map<string, number>();
  for (const beat of buildSessionBeats(steps)) {
    const id = beat.step.exercise_id;
    if (!id || beat.side === "right") continue;
    totals.set(id, (totals.get(id) ?? 0) + 1);
  }
  return Array.from(totals, ([exerciseId, sets]) => ({ exerciseId, sets }));
}

/** Sets actually logged for a session exercise (distinct set numbers), falling back to the plan when none were logged. */
export function loggedSetCount(
  setNumbers: number[],
  planned: { plannedSets: number | null; repeatCount: number | null }
): number {
  const distinct = new Set(setNumbers).size;
  if (distinct > 0) return distinct;
  return planned.plannedSets ?? planned.repeatCount ?? 1;
}

/**
 * Merges logged sessions with workouts that were marked complete, dropping a
 * marked-complete workout when a logged session already covers it.
 */
export function mergeCompletedWork(
  sessions: CompletedWorkout[],
  markedComplete: CompletedWorkout[]
): Performance[] {
  const covered = (w: CompletedWorkout) =>
    sessions.some((s) =>
      w.scheduledWorkoutId
        ? s.scheduledWorkoutId === w.scheduledWorkoutId
        : w.planWorkoutId != null &&
          s.planWorkoutId === w.planWorkoutId &&
          daysBetween(s.date, w.date) <= SAME_COMPLETION_WINDOW_DAYS
    );

  const out: Performance[] = [];
  for (const s of sessions) for (const e of s.exercises) out.push({ ...e, date: s.date, logged: true });
  for (const w of markedComplete) {
    if (covered(w)) continue;
    for (const e of w.exercises) out.push({ ...e, date: w.date, logged: false });
  }
  return out;
}

export type MuscleGroupRow = {
  group: string;
  sets: number;
  exercises: number; // exercise performances (an exercise done in 3 workouts counts 3)
  share: number; // 0–1 share of all muscle-group sets
  lastDate: string | null;
};

export type MuscleGroupSummary = {
  rows: MuscleGroupRow[]; // every group, head-to-toe order
  regions: { upper: number; core: number; lower: number }; // shares, 0–1
  totalSets: number; // sets of exercises with at least one muscle group
  untaggedSets: number; // sets of exercises with no muscle group
  workoutDays: number;
};

export const REGION_GROUPS = {
  upper: ["chest", "shoulders", "back_spine", "arms"],
  core: ["abdomen"],
  lower: ["hips_glutes", "thighs", "lower_legs", "feet"],
} as const;

export function summarizeMuscleGroups(
  performances: Performance[],
  muscleGroupsByExercise: Map<string, string[]>,
  sinceDate?: string | null
): MuscleGroupSummary {
  const sets = new Map<string, number>(MUSCLE_GROUPS.map((g) => [g, 0]));
  const counts = new Map<string, number>(MUSCLE_GROUPS.map((g) => [g, 0]));
  const last = new Map<string, string>();
  const days = new Set<string>();
  let totalSets = 0;
  let untaggedSets = 0;

  for (const p of performances) {
    if (sinceDate && p.date < sinceDate) continue;
    days.add(p.date);
    const groups = (muscleGroupsByExercise.get(p.exerciseId) ?? []).filter((g) => sets.has(g));
    if (!groups.length) { untaggedSets += p.sets; continue; }
    totalSets += p.sets;
    for (const g of groups) {
      sets.set(g, sets.get(g)! + p.sets);
      counts.set(g, counts.get(g)! + 1);
      if (!last.has(g) || p.date > last.get(g)!) last.set(g, p.date);
    }
  }

  const groupSetTotal = Array.from(sets.values()).reduce((a, b) => a + b, 0);
  const share = (n: number) => (groupSetTotal ? n / groupSetTotal : 0);
  const regionShare = (groups: readonly string[]) => share(groups.reduce((a, g) => a + sets.get(g)!, 0));

  return {
    rows: MUSCLE_GROUPS.map((group) => ({
      group,
      sets: sets.get(group)!,
      exercises: counts.get(group)!,
      share: share(sets.get(group)!),
      lastDate: last.get(group) ?? null,
    })),
    regions: {
      upper: regionShare(REGION_GROUPS.upper),
      core: regionShare(REGION_GROUPS.core),
      lower: regionShare(REGION_GROUPS.lower),
    },
    totalSets,
    untaggedSets,
    workoutDays: days.size,
  };
}
