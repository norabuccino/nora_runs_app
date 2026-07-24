"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { PlanWorkout, WorkoutLog, UserPlan, TrainingPlan, RunningPace, ScheduledWorkoutWithSteps, ScheduledWorkout } from "@/types/database";
import { WorkoutCard } from "@/components/WorkoutCard";
import { WeekGrid } from "@/components/WeekGrid";
import { WorkoutForm, type WorkoutFormData } from "@/components/WorkoutForm";
import { LibraryPickerModal } from "@/components/LibraryPickerModal";
import { getTodayPosition, scheduledDate, DAY_NAMES, parseDateLocal } from "@/lib/paceUtils";
import { markWorkoutComplete, unmarkWorkoutComplete } from "@/app/actions/userPlans";
import {
  createScheduledWorkout,
  markScheduledWorkoutComplete,
  unmarkScheduledWorkoutComplete,
  deleteScheduledWorkout,
} from "@/app/actions/scheduledWorkouts";
import { batchUpdateWorkoutPositions, deleteWorkout } from "@/app/actions/workouts";
import { PlanWorkoutDetailModal } from "@/components/PlanWorkoutDetailModal";
import type { WorkoutStepData } from "@/app/actions/workouts";

interface PlanContext {
  userPlan: UserPlan;
  plan: TrainingPlan;
  todayPos: { weekNumber: number; dayOfWeek: number } | null;
  todayWorkouts: PlanWorkout[];
  weekWorkouts: PlanWorkout[];
  logs: WorkoutLog[];
  weekPurpose: string | undefined;
}

type AddMode = null | "choose" | "from-scratch" | "from-library";

function adaptScheduled(sw: ScheduledWorkout): PlanWorkout {
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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [planContexts, setPlanContexts] = useState<PlanContext[]>([]);
  const [paces, setPaces] = useState<RunningPace[]>([]);
  const [scheduledWorkouts, setScheduledWorkouts] = useState<ScheduledWorkoutWithSteps[]>([]);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [addToPlanDay, setAddToPlanDay] = useState<{ dayOfWeek: number; planId: string } | null>(null);
  const [detailWorkout, setDetailWorkout] = useState<PlanWorkout | null>(null);
  const [isPending, startTransition] = useTransition();

  const todayISO = new Date().toISOString().split("T")[0];

  async function load() {
    const supabase = createClient();

    const [{ data: userPlans }, { data: pacesData }, { data: scheduledData }] = await Promise.all([
      supabase.from("user_plans").select("*, training_plans(*)").eq("status", "active"),
      supabase.from("running_paces").select("*").order("created_at"),
      supabase
        .from("scheduled_workouts")
        .select("*, workout_steps(*)")
        .eq("scheduled_date", todayISO)
        .order("sort_order"),
    ]);

    setPaces(pacesData ?? []);
    setScheduledWorkouts((scheduledData ?? []) as ScheduledWorkoutWithSteps[]);

    if (!userPlans?.length) {
      setPlanContexts([]);
      setLoading(false);
      return;
    }

    const contexts = await Promise.all(
      userPlans.map(async (activePlan) => {
        const plan = activePlan.training_plans as unknown as TrainingPlan;
        const pos = getTodayPosition(activePlan.start_date, plan.total_weeks);

        if (!pos) {
          return {
            userPlan: activePlan as unknown as UserPlan,
            plan,
            todayPos: null,
            todayWorkouts: [],
            weekWorkouts: [],
            logs: [],
            weekPurpose: undefined,
          } as PlanContext;
        }

        const weekStart = scheduledDate(activePlan.start_date, pos.weekNumber, 0);
        const weekEnd = scheduledDate(activePlan.start_date, pos.weekNumber, 6);

        const [{ data: noteData }, { data: workoutsData }, { data: logsData }] = await Promise.all([
          supabase
            .from("plan_week_notes")
            .select("purpose")
            .eq("plan_id", activePlan.plan_id)
            .eq("week_number", pos.weekNumber)
            .single(),
          supabase
            .from("plan_workouts")
            .select("*")
            .eq("plan_id", activePlan.plan_id)
            .eq("week_number", pos.weekNumber)
            .order("day_of_week")
            .order("sort_order"),
          supabase
            .from("workout_logs")
            .select("*")
            .eq("user_plan_id", activePlan.id)
            .gte("scheduled_date", weekStart)
            .lte("scheduled_date", weekEnd),
        ]);

        const allWeekWorkouts = (workoutsData ?? []) as PlanWorkout[];
        return {
          userPlan: activePlan as unknown as UserPlan,
          plan,
          todayPos: pos,
          todayWorkouts: allWeekWorkouts.filter((w) => w.day_of_week === pos.dayOfWeek),
          weekWorkouts: allWeekWorkouts,
          logs: (logsData ?? []) as WorkoutLog[],
          weekPurpose: noteData?.purpose ?? undefined,
        } as PlanContext;
      })
    );

    setPlanContexts(contexts);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function findCtx(planId: string): PlanContext | undefined {
    return planContexts.find((c) => c.plan.id === planId);
  }

  function handleComplete(workout: PlanWorkout) {
    const ctx = findCtx(workout.plan_id);
    if (!ctx) return;
    const date = scheduledDate(ctx.userPlan.start_date, workout.week_number, workout.day_of_week);
    startTransition(async () => {
      await markWorkoutComplete(ctx.userPlan.id, workout.id, date);
      await load();
    });
  }

  function handleUnComplete(workout: PlanWorkout) {
    const ctx = findCtx(workout.plan_id);
    if (!ctx) return;
    startTransition(async () => {
      await unmarkWorkoutComplete(ctx.userPlan.id, workout.id);
      await load();
    });
  }

  function handleDeleteFromWeek(workout: PlanWorkout) {
    startTransition(async () => {
      await deleteWorkout(workout.id, workout.plan_id);
      await load();
    });
  }

  function makeReorderHandler(ctx: PlanContext) {
    return (updates: { id: string; week_number: number; day_of_week: number; sort_order: number }[]) => {
      startTransition(async () => {
        await batchUpdateWorkoutPositions(ctx.plan.id, updates);
        await load();
      });
    };
  }

  function handleScheduledComplete(sw: ScheduledWorkoutWithSteps) {
    startTransition(async () => {
      await markScheduledWorkoutComplete(sw.id);
      await load();
    });
  }

  function handleScheduledUnComplete(sw: ScheduledWorkoutWithSteps) {
    startTransition(async () => {
      await unmarkScheduledWorkoutComplete(sw.id);
      await load();
    });
  }

  function handleScheduledDelete(sw: ScheduledWorkoutWithSteps) {
    startTransition(async () => {
      await deleteScheduledWorkout(sw.id);
      await load();
    });
  }

  async function handleCreateFromScratch(formData: WorkoutFormData) {
    const steps: WorkoutStepData[] = formData.steps.map((s) => ({
      step_type: s.step_type,
      label: s.label || null,
      pace_type: s.pace_type || null,
      duration_minutes: s.duration_minutes ? parseFloat(s.duration_minutes) : null,
      distance_miles: s.distance_miles ? parseFloat(s.distance_miles) : null,
      distance_unit: s.distance_unit,
      notes: s.notes || null,
      repeat_group_id: s.repeat_group_id,
      repeat_count: s.repeat_count,
      group_name: s.group_name || null,
      sets: s.sets ? parseInt(s.sets) : null,
      reps: s.reps ? parseInt(s.reps) : null,
      weight_suggestion: s.weight_suggestion || null,
      video_url: s.video_url || null,
      exercise_id: s.exercise_id || null,
      both_sides: s.both_sides,
    }));

    await createScheduledWorkout({
      scheduled_date: todayISO,
      type: formData.type,
      run_type: formData.run_type || null,
      strength_type: formData.strength_type || null,
      title: formData.title,
      description: formData.description || null,
      distance_miles: formData.distance_miles ? parseFloat(formData.distance_miles) : null,
      distance_unit: formData.distance_unit,
      pace_type: formData.pace_type || null,
      duration_minutes: formData.duration_minutes ? parseFloat(formData.duration_minutes) : null,
      notes: formData.notes || null,
      steps,
    });
    setAddMode(null);
    await load();
  }

  if (loading) {
    return <div className="text-sm text-[var(--muted)]">Loading…</div>;
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Plans where today falls inside a valid week
  const activePlanContexts = planContexts.filter((ctx) => ctx.todayPos !== null);
  const hasActivePlans = planContexts.length > 0;

  // Scheduled workouts for today — rendered in every state
  const scheduledSection = scheduledWorkouts.length > 0 ? (
    <div className="space-y-2">
      {scheduledWorkouts.map((sw) => {
        const adapted = adaptScheduled(sw);
        const syntheticLog = sw.completed_at
          ? { completed_at: sw.completed_at } as WorkoutLog
          : null;
        return (
          <div key={sw.id}>
            <div className="flex justify-end h-4">
              <button
                onClick={() => handleScheduledDelete(sw)}
                title="Remove"
                className="w-5 h-5 flex items-center justify-center text-sm leading-none text-[var(--muted)] hover:text-red-500 transition-colors"
              >
                ×
              </button>
            </div>
            <WorkoutCard
              workout={adapted}
              log={syntheticLog}
              paces={paces}
              mode="dashboard"
              onComplete={() => handleScheduledComplete(sw)}
              onUnComplete={() => handleScheduledUnComplete(sw)}
            />
          </div>
        );
      })}
    </div>
  ) : null;

  // "Log a workout" button — shown in every state
  const addWorkoutButton = (
    <button
      onClick={() => setAddMode("choose")}
      className="text-xs text-[var(--accent)] hover:underline"
    >
      + Log a workout for today
    </button>
  );

  // Add-mode modals — defined once, rendered in every branch
  const addModeModals = (
    <>
      {addMode === "choose" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full sm:max-w-sm bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Log a workout for today</h2>
              <button
                onClick={() => setAddMode(null)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setAddMode("from-library")}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-left hover:border-[var(--foreground)] transition-colors"
              >
                <p className="font-medium">From workout library</p>
                <p className="text-xs text-[var(--muted)]">Pick one of your saved workouts</p>
              </button>
              <button
                onClick={() => setAddMode("from-scratch")}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-left hover:border-[var(--foreground)] transition-colors"
              >
                <p className="font-medium">Create from scratch</p>
                <p className="text-xs text-[var(--muted)]">Build a new workout now</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {addMode === "from-library" && (
        <LibraryPickerModal
          scheduledDate={todayISO}
          onAdded={async () => { setAddMode(null); await load(); }}
          onCancel={() => setAddMode("choose")}
        />
      )}

      {addMode === "from-scratch" && (
        <WorkoutForm
          scheduledDate={todayISO}
          paces={paces}
          onSave={handleCreateFromScratch}
          onCancel={() => setAddMode(null)}
          onBack={() => setAddMode("choose")}
        />
      )}
    </>
  );

  if (!hasActivePlans) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{dateStr}</p>
        </div>

        {scheduledSection}

        <p className="text-sm text-[var(--muted)]">No active training plan. How would you like to train?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/plans"
            className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-2 hover:border-[var(--foreground)] transition-colors"
          >
            <p className="font-semibold">Start a training plan</p>
            <p className="text-sm text-[var(--muted)]">
              Browse structured marathon, strength, or custom plans and assign one to follow week by week.
            </p>
            <p className="text-xs text-[var(--accent)] group-hover:underline">Browse plans →</p>
          </Link>
          <Link
            href="/workouts"
            className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-2 hover:border-[var(--foreground)] transition-colors"
          >
            <p className="font-semibold">Workout library</p>
            <p className="text-sm text-[var(--muted)]">
              Browse your saved workouts, or log one for today directly from the library.
            </p>
            <p className="text-xs text-[var(--accent)] group-hover:underline">Go to workout library →</p>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-xs text-[var(--muted)]">or</span>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        {addWorkoutButton}
        {addModeModals}
      </div>
    );
  }

  // Header info: if all active plans have no valid today position, show the first plan's status
  const firstCtx = planContexts[0];
  const firstPos = firstCtx.todayPos;
  const planStartDate = parseDateLocal(firstCtx.userPlan.start_date);
  today.setHours(0, 0, 0, 0);
  const planNotStarted = !firstPos && today < planStartDate;
  const planEnded = !firstPos && !planNotStarted;

  const headerTitle = activePlanContexts.length === 1
    ? `Week ${activePlanContexts[0].todayPos!.weekNumber}, ${DAY_NAMES[activePlanContexts[0].todayPos!.dayOfWeek]}`
    : activePlanContexts.length > 1
    ? DAY_NAMES[activePlanContexts[0].todayPos!.dayOfWeek]
    : planNotStarted
    ? "Plan not started"
    : "Plan complete";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--muted)]">{dateStr}</p>
          <h1 className="text-2xl font-bold mt-0.5">{headerTitle}</h1>
          {planContexts.length === 1 && (
            <Link
              href={`/plans/${firstCtx.plan.id}`}
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {firstCtx.plan.name} →
            </Link>
          )}
        </div>
        {isPending && (
          <span className="text-xs text-[var(--muted)] animate-pulse">Saving…</span>
        )}
      </div>

      {activePlanContexts.length === 0 ? (
        // All plans are either not-yet-started or ended
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
            {planNotStarted ? (
              <>
                <div className="space-y-1">
                  <p className="font-semibold">Your plan hasn&apos;t started yet</p>
                  <p className="text-sm text-[var(--muted)]">
                    {firstCtx.plan.name} starts on {firstCtx.userPlan.start_date}. In the meantime, add individual workouts from your library.
                  </p>
                </div>
                <div className="flex gap-3 flex-wrap">
                  <Link href="/workouts" className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity">
                    Workout library
                  </Link>
                  <Link href="/my-plan" className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors">
                    View my plan
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="font-semibold">You&apos;ve finished this plan!</p>
                  <p className="text-sm text-[var(--muted)]">Start a new plan or add workouts from your library to keep training.</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                  <Link href="/plans" className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity">
                    Browse plans
                  </Link>
                  <Link href="/workouts" className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors">
                    Workout library
                  </Link>
                </div>
              </>
            )}
          </div>

          {scheduledSection && (
            <div className="space-y-3">
              <h2 className="font-semibold text-sm text-[var(--muted)] uppercase tracking-wide">
                Today&apos;s workouts
              </h2>
              {scheduledSection}
            </div>
          )}

          {addWorkoutButton}
        </div>
      ) : (
        <>
          {/* Today — combined workouts from all active in-progress plans */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-[var(--muted)] uppercase tracking-wide">Today</h2>

            {activePlanContexts.every((ctx) => ctx.todayWorkouts.length === 0) && !scheduledSection ? (
              <div className="rounded-xl border border-[var(--border)] p-6 text-center space-y-3">
                <p className="text-sm text-[var(--muted)]">Rest day — enjoy the recovery.</p>
                {addWorkoutButton}
              </div>
            ) : (
              <div className="space-y-2">
                {activePlanContexts.flatMap((ctx) =>
                  ctx.todayWorkouts.map((workout) => {
                    const log = ctx.logs.find((l) => l.plan_workout_id === workout.id) ?? null;
                    return (
                      <WorkoutCard
                        key={workout.id}
                        workout={workout}
                        log={log}
                        paces={paces}
                        mode="dashboard"
                        onComplete={handleComplete}
                        onUnComplete={handleUnComplete}
                        onDetail={setDetailWorkout}
                      />
                    );
                  })
                )}
                {scheduledSection}
                {addWorkoutButton}
              </div>
            )}
          </div>

          {/* This week — one WeekGrid per active in-progress plan */}
          {activePlanContexts.map((ctx) => (
            <div key={ctx.plan.id} className="space-y-3">
              <h2 className="font-semibold text-sm text-[var(--muted)] uppercase tracking-wide">
                {activePlanContexts.length > 1
                  ? `This week — ${ctx.plan.name}`
                  : "This week"}
              </h2>
              <div className="sm:overflow-x-auto sm:pb-2">
                <WeekGrid
                  weekNumber={ctx.todayPos!.weekNumber}
                  workouts={ctx.weekWorkouts}
                  logs={ctx.logs}
                  paces={paces}
                  mode="reorder"
                  purpose={ctx.weekPurpose}
                  startDate={ctx.userPlan.start_date}
                  onComplete={handleComplete}
                  onUnComplete={handleUnComplete}
                  onDelete={handleDeleteFromWeek}
                  onReorder={makeReorderHandler(ctx)}
                  onAddWorkout={(_, dayOfWeek) => setAddToPlanDay({ dayOfWeek, planId: ctx.plan.id })}
                  onDetail={setDetailWorkout}
                />
              </div>
            </div>
          ))}
        </>
      )}

      {addModeModals}

      {detailWorkout && (
        <PlanWorkoutDetailModal
          workout={detailWorkout}
          onClose={() => setDetailWorkout(null)}
        />
      )}

      {addToPlanDay !== null && (() => {
        const ctx = findCtx(addToPlanDay.planId);
        if (!ctx || !ctx.todayPos) return null;
        return (
          <LibraryPickerModal
            planId={ctx.plan.id}
            weekNumber={ctx.todayPos.weekNumber}
            dayOfWeek={addToPlanDay.dayOfWeek}
            onAdded={async () => { setAddToPlanDay(null); await load(); }}
            onCancel={() => setAddToPlanDay(null)}
          />
        );
      })()}
    </div>
  );
}
