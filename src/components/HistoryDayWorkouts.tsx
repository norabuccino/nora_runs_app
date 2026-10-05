"use client";

import { useState, useTransition } from "react";
import type { PlanWorkout, RunningPace } from "@/types/database";
import type { HistoryEntry } from "@/lib/workoutHistory";
import { WorkoutCard } from "@/components/WorkoutCard";
import { PlanWorkoutDetailModal } from "@/components/PlanWorkoutDetailModal";
import { markWorkoutComplete, unmarkWorkoutComplete, updateWorkoutActualDistance } from "@/app/actions/userPlans";
import { markScheduledWorkoutComplete, unmarkScheduledWorkoutComplete } from "@/app/actions/scheduledWorkouts";

interface HistoryDayWorkoutsProps {
  entries: HistoryEntry[];
  paces: RunningPace[];
  /** Called after any completion change so the parent can reload. */
  onChanged: () => void | Promise<void>;
  emptyText?: string;
  /** Label each plan workout with its plan's name (useful across past plans). */
  showPlanName?: boolean;
}

/**
 * A single day's workouts from the workout history, as dashboard-mode
 * WorkoutCards — past workouts can still be marked done (or undone) after
 * the fact, and clicking one opens the usual detail modal.
 */
export function HistoryDayWorkouts({ entries, paces, onChanged, emptyText = "Nothing scheduled.", showPlanName = false }: HistoryDayWorkoutsProps) {
  const [detail, setDetail] = useState<HistoryEntry | null>(null);
  const [, startTransition] = useTransition();

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      await onChanged();
    });
  }

  function complete(entry: HistoryEntry, miles?: number | null) {
    run(() =>
      entry.source === "scheduled"
        ? markScheduledWorkoutComplete(entry.workout.id)
        : markWorkoutComplete(entry.userPlanId!, entry.workout.id, entry.date, miles)
    );
  }

  function uncomplete(entry: HistoryEntry) {
    run(() =>
      entry.source === "scheduled"
        ? unmarkScheduledWorkoutComplete(entry.workout.id)
        : unmarkWorkoutComplete(entry.userPlanId!, entry.workout.id)
    );
  }

  if (entries.length === 0) {
    return <p className="text-xs text-[var(--muted)]">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div key={entry.key} className="space-y-1">
          {showPlanName && entry.planName && (
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{entry.planName}</p>
          )}
          <WorkoutCard
            workout={entry.workout}
            log={entry.log}
            paces={paces}
            mode="dashboard"
            onComplete={(_: PlanWorkout, miles?: number | null) => complete(entry, miles)}
            onUnComplete={() => uncomplete(entry)}
            onEditMileage={
              entry.source === "plan"
                ? (w: PlanWorkout, miles: number | null) =>
                    run(() => updateWorkoutActualDistance(entry.userPlanId!, w.id, miles))
                : undefined
            }
            onDetail={() => setDetail(entry)}
          />
        </div>
      ))}

      {detail && (
        <PlanWorkoutDetailModal
          workout={detail.workout}
          source={detail.source}
          sessionDate={detail.date}
          onClose={() => setDetail(null)}
          onComplete={(_, miles) => complete(detail, miles)}
        />
      )}
    </div>
  );
}
