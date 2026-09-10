import type { PlanWorkout, ScheduledWorkout } from "@/types/database";

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
