import type { PlanWorkout, ScheduledWorkout } from "@/types/database";

export interface ScheduledWorkoutHistoryDay<T> {
  date: string;
  workouts: T[];
}

/**
 * Splits a list of scheduled workouts (already fetched for some date window)
 * into today's workouts and a "history" of prior days, grouped by date and
 * ordered most-recent-first. Used to give non-plan (ad-hoc) users a look-back
 * at what they've logged this week, mirroring what a plan's own WeekGrid
 * already shows for prior days.
 */
export function groupScheduledWorkoutHistory<T extends { scheduled_date: string }>(
  scheduledWorkouts: T[],
  todayISO: string
): { today: T[]; history: ScheduledWorkoutHistoryDay<T>[] } {
  const today: T[] = [];
  const byDate = new Map<string, T[]>();

  for (const sw of scheduledWorkouts) {
    if (sw.scheduled_date === todayISO) {
      today.push(sw);
    } else {
      const list = byDate.get(sw.scheduled_date) ?? [];
      list.push(sw);
      byDate.set(sw.scheduled_date, list);
    }
  }

  const history = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, workouts]) => ({ date, workouts }));

  return { today, history };
}

/**
 * Adapts a standalone, date-based ScheduledWorkout into the PlanWorkout
 * shape so it can render through the same components (WorkoutCard, WeekGrid,
 * PlanWorkoutDetailModal, StrengthWorkoutPlayer) as workouts that belong to
 * an actual training plan.
 */
export function adaptScheduledWorkout(sw: ScheduledWorkout): PlanWorkout {
  return {
    id: sw.id,
    plan_id: "",
    week_number: 0,
    day_of_week: 0,
    type: sw.type,
    run_type: sw.run_type,
    strength_type: sw.strength_type,
    title: sw.title,
    description: sw.description,
    distance_miles: sw.distance_miles,
    distance_unit: sw.distance_unit,
    pace_type: sw.pace_type,
    duration_minutes: sw.duration_minutes,
    notes: sw.notes,
    sort_order: sw.sort_order,
    day_logic: "or",
    library_workout_id: sw.library_workout_id,
  };
}
