import type { PlanWorkout, ScheduledWorkout } from "@/types/database";
import { formatDateLocal, parseDateLocal } from "@/lib/paceUtils";

export interface ScheduledWeekDay<T> {
  date: string;
  workouts: T[];
}

/**
 * Buckets a list of scheduled workouts into all 7 calendar days of the week
 * starting at weekStartISO (typically the Monday containing "today"), one
 * entry per day in order regardless of whether it has any workouts yet.
 * Lets non-plan (ad-hoc) users both look back at what they've logged this
 * week and plan ahead by adding workouts to upcoming days — mirroring what a
 * plan's own WeekGrid gives for free.
 */
export function buildScheduledWeekDays<T extends { scheduled_date: string }>(
  weekStartISO: string,
  scheduledWorkouts: T[]
): ScheduledWeekDay<T>[] {
  const byDate = new Map<string, T[]>();
  for (const sw of scheduledWorkouts) {
    const list = byDate.get(sw.scheduled_date) ?? [];
    list.push(sw);
    byDate.set(sw.scheduled_date, list);
  }

  const start = parseDateLocal(weekStartISO);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const date = formatDateLocal(d);
    return { date, workouts: byDate.get(date) ?? [] };
  });
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
    bike_location: sw.bike_location,
    cross_train_type: sw.cross_train_type,
    continuous_timers: sw.continuous_timers ?? false,
  };
}
