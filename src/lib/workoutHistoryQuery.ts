import { createClient } from "@/lib/supabase/client";
import type { PlanWorkout, ScheduledWorkout, WorkoutLog } from "@/types/database";
import { buildHistoryEntries, planWeekRange, type HistoryEntry, type UserPlanWithPlan } from "@/lib/workoutHistory";

/**
 * Loads every workout occurrence (plan + ad-hoc scheduled) falling within
 * [rangeStart, rangeEnd], bucketed by date. Browser-client only — used by the
 * /history calendar and the dashboard's "Recent days" feed.
 */
export async function fetchWorkoutHistory(rangeStart: string, rangeEnd: string): Promise<Map<string, HistoryEntry[]>> {
  const supabase = createClient();

  const [{ data: userPlansData }, { data: scheduledData }] = await Promise.all([
    supabase.from("user_plans").select("*, training_plans(*)"),
    supabase
      .from("scheduled_workouts")
      .select("*")
      .gte("scheduled_date", rangeStart)
      .lte("scheduled_date", rangeEnd)
      .order("scheduled_date")
      .order("sort_order"),
  ]);

  const userPlans = ((userPlansData ?? []) as unknown as UserPlanWithPlan[]).filter((up) => up.training_plans);

  const perPlan = await Promise.all(
    userPlans.map(async (up) => {
      const weeks = planWeekRange(up.start_date, up.training_plans.total_weeks, rangeStart, rangeEnd);
      if (!weeks) return { workouts: [] as PlanWorkout[], logs: [] as WorkoutLog[] };
      const [{ data: workouts }, { data: logs }] = await Promise.all([
        supabase
          .from("plan_workouts")
          .select("*")
          .eq("plan_id", up.plan_id)
          .gte("week_number", weeks.from)
          .lte("week_number", weeks.to),
        supabase.from("workout_logs").select("*").eq("user_plan_id", up.id),
      ]);
      return { workouts: (workouts ?? []) as PlanWorkout[], logs: (logs ?? []) as WorkoutLog[] };
    })
  );

  return buildHistoryEntries(
    {
      userPlans,
      // Two user_plans can share a plan_id (a plan restarted later), so dedupe.
      planWorkouts: [...new Map(perPlan.flatMap((p) => p.workouts).map((w) => [w.id, w])).values()],
      logs: perPlan.flatMap((p) => p.logs),
      scheduled: (scheduledData ?? []) as ScheduledWorkout[],
    },
    rangeStart,
    rangeEnd
  );
}
