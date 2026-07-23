"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlanWorkout, RunningPace, WorkoutLog } from "@/types/database";
import { WeekGrid } from "@/components/WeekGrid";
import { PlanWorkoutDetailModal } from "@/components/PlanWorkoutDetailModal";
import { LibraryPickerModal } from "@/components/LibraryPickerModal";
import { scheduledDate } from "@/lib/paceUtils";
import { markWorkoutComplete, unmarkWorkoutComplete } from "@/app/actions/userPlans";
import { deleteWorkout, batchUpdateWorkoutPositions } from "@/app/actions/workouts";

interface MyPlanWeeksProps {
  weeks: number[];
  planId: string;
  userPlanId: string;
  planWorkouts: PlanWorkout[];
  logs: WorkoutLog[];
  paces: RunningPace[];
  weekNotesMap: Record<number, string>;
  startDate: string;
  daysPerWeek?: number;
}

export function MyPlanWeeks({
  weeks,
  planId,
  userPlanId,
  planWorkouts,
  logs,
  paces,
  weekNotesMap,
  startDate,
  daysPerWeek,
}: MyPlanWeeksProps) {
  const router = useRouter();
  const [detailWorkout, setDetailWorkout] = useState<PlanWorkout | null>(null);
  const [addTarget, setAddTarget] = useState<{ weekNumber: number; dayOfWeek: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleComplete(workout: PlanWorkout) {
    const date = scheduledDate(startDate, workout.week_number, workout.day_of_week);
    startTransition(async () => {
      await markWorkoutComplete(userPlanId, workout.id, date);
      router.refresh();
    });
  }

  function handleUnComplete(workout: PlanWorkout) {
    startTransition(async () => {
      await unmarkWorkoutComplete(userPlanId, workout.id);
      router.refresh();
    });
  }

  function handleDelete(workout: PlanWorkout) {
    startTransition(async () => {
      await deleteWorkout(workout.id, planId);
      router.refresh();
    });
  }

  function handleReorder(updates: { id: string; week_number: number; day_of_week: number; sort_order: number }[]) {
    startTransition(async () => {
      await batchUpdateWorkoutPositions(planId, updates);
      router.refresh();
    });
  }

  return (
    <>
      {weeks.map((weekNum) => (
        <WeekGrid
          key={weekNum}
          weekNumber={weekNum}
          workouts={planWorkouts}
          logs={logs}
          paces={paces}
          mode="reorder"
          purpose={weekNotesMap[weekNum]}
          startDate={startDate}
          daysPerWeek={daysPerWeek}
          onComplete={handleComplete}
          onUnComplete={handleUnComplete}
          onDelete={handleDelete}
          onReorder={handleReorder}
          onAddWorkout={(weekNumber, dayOfWeek) => setAddTarget({ weekNumber, dayOfWeek })}
          onDetail={setDetailWorkout}
        />
      ))}
      {detailWorkout && (
        <PlanWorkoutDetailModal
          workout={detailWorkout}
          onClose={() => setDetailWorkout(null)}
        />
      )}
      {addTarget && (
        <LibraryPickerModal
          planId={planId}
          weekNumber={addTarget.weekNumber}
          dayOfWeek={addTarget.dayOfWeek}
          onAdded={() => { setAddTarget(null); router.refresh(); }}
          onCancel={() => setAddTarget(null)}
        />
      )}
      {isPending && (
        <div className="fixed bottom-4 right-4 bg-[var(--foreground)] text-[var(--background)] text-xs px-3 py-2 rounded-lg z-50">
          Saving…
        </div>
      )}
    </>
  );
}
