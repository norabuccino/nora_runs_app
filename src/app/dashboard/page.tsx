"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { PlanWorkout, WorkoutLog, UserPlan, TrainingPlan, RunningPace } from "@/types/database";
import { WorkoutCard } from "@/components/WorkoutCard";
import { WeekGrid } from "@/components/WeekGrid";
import { getTodayPosition, scheduledDate, DAY_NAMES } from "@/lib/paceUtils";
import { markWorkoutComplete, unmarkWorkoutComplete } from "@/app/actions/userPlans";

interface ActivePlanData {
  userPlan: UserPlan;
  plan: TrainingPlan;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [activePlanData, setActivePlanData] = useState<ActivePlanData | null>(null);
  const [todayWorkouts, setTodayWorkouts] = useState<PlanWorkout[]>([]);
  const [weekWorkouts, setWeekWorkouts] = useState<PlanWorkout[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [paces, setPaces] = useState<RunningPace[]>([]);
  const [todayPos, setTodayPos] = useState<{ weekNumber: number; dayOfWeek: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function load() {
    const supabase = createClient();

    const [{ data: userPlans }, { data: pacesData }] = await Promise.all([
      supabase
        .from("user_plans")
        .select("*, training_plans(*)")
        .eq("status", "active")
        .limit(1),
      supabase.from("running_paces").select("*").order("created_at"),
    ]);

    setPaces(pacesData ?? []);

    const activePlan = userPlans?.[0];
    if (!activePlan) {
      setLoading(false);
      return;
    }

    const plan = activePlan.training_plans as unknown as TrainingPlan;
    setActivePlanData({ userPlan: activePlan as unknown as UserPlan, plan });

    const pos = getTodayPosition(activePlan.start_date, plan.total_weeks);
    setTodayPos(pos);

    if (!pos) {
      setLoading(false);
      return;
    }

    // Fetch today's + this whole week's workouts
    const { data: workoutsData } = await supabase
      .from("plan_workouts")
      .select("*")
      .eq("plan_id", activePlan.plan_id)
      .eq("week_number", pos.weekNumber)
      .order("day_of_week")
      .order("sort_order");

    const allWeekWorkouts = workoutsData ?? [];
    setWeekWorkouts(allWeekWorkouts);
    setTodayWorkouts(allWeekWorkouts.filter((w) => w.day_of_week === pos.dayOfWeek));

    // Fetch logs for the whole week
    const weekStart = scheduledDate(activePlan.start_date, pos.weekNumber, 0);
    const weekEnd = scheduledDate(activePlan.start_date, pos.weekNumber, 6);
    const { data: logsData } = await supabase
      .from("workout_logs")
      .select("*")
      .eq("user_plan_id", activePlan.id)
      .gte("scheduled_date", weekStart)
      .lte("scheduled_date", weekEnd);

    setLogs(logsData ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleComplete(workout: PlanWorkout) {
    if (!activePlanData || !todayPos) return;
    const date = scheduledDate(activePlanData.userPlan.start_date, workout.week_number, workout.day_of_week);
    startTransition(async () => {
      await markWorkoutComplete(activePlanData.userPlan.id, workout.id, date);
      await load();
    });
  }

  function handleUnComplete(workout: PlanWorkout) {
    if (!activePlanData) return;
    startTransition(async () => {
      await unmarkWorkoutComplete(activePlanData.userPlan.id, workout.id);
      await load();
    });
  }

  if (loading) {
    return <div className="text-sm text-[var(--muted)]">Loading…</div>;
  }

  if (!activePlanData) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center space-y-3">
          <p className="font-medium">No active training plan</p>
          <p className="text-sm text-[var(--muted)]">
            Assign a plan to start seeing your daily workouts here.
          </p>
          <Link
            href="/plans"
            className="inline-block px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Browse plans
          </Link>
        </div>
      </div>
    );
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const planEnded = !todayPos;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--muted)]">{dateStr}</p>
          <h1 className="text-2xl font-bold mt-0.5">
            {todayPos ? `Week ${todayPos.weekNumber}, ${DAY_NAMES[todayPos.dayOfWeek]}` : "Plan complete"}
          </h1>
          <Link
            href={`/plans/${activePlanData.plan.id}`}
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {activePlanData.plan.name} →
          </Link>
        </div>
        {isPending && (
          <span className="text-xs text-[var(--muted)] animate-pulse">Saving…</span>
        )}
      </div>

      {planEnded ? (
        <div className="rounded-xl border border-[var(--border)] p-6 text-center space-y-2">
          <p className="font-semibold">You&apos;ve finished this plan!</p>
          <Link href="/my-plan" className="text-sm text-[var(--accent)] hover:opacity-70">
            View plan history or start a new plan →
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-[var(--muted)] uppercase tracking-wide">
              Today
            </h2>
            {todayWorkouts.length === 0 ? (
              <div className="rounded-xl border border-[var(--border)] p-6 text-center">
                <p className="text-sm text-[var(--muted)]">Rest day — enjoy the recovery.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayWorkouts.map((workout) => {
                  const log = logs.find((l) => l.plan_workout_id === workout.id) ?? null;
                  return (
                    <WorkoutCard
                      key={workout.id}
                      workout={workout}
                      log={log}
                      paces={paces}
                      mode="dashboard"
                      onComplete={handleComplete}
                      onUnComplete={handleUnComplete}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-[var(--muted)] uppercase tracking-wide">
              This week
            </h2>
            <div className="overflow-x-auto pb-2">
              <WeekGrid
                weekNumber={todayPos!.weekNumber}
                workouts={weekWorkouts}
                logs={logs}
                paces={paces}
                mode="view"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
