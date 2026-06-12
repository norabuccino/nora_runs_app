"use client";

import type { PlanWorkout, WorkoutLog, RunningPace } from "@/types/database";
import {
  WORKOUT_TYPE_LABELS,
  WORKOUT_TYPE_COLORS,
  RUN_TYPE_LABELS,
  RUN_TYPE_COLORS,
  getWorkoutEstimate,
} from "@/lib/paceUtils";

interface WorkoutCardProps {
  workout: PlanWorkout;
  log?: WorkoutLog | null;
  paces?: RunningPace[];
  mode?: "view" | "dashboard" | "edit";
  onComplete?: (workout: PlanWorkout) => void;
  onUnComplete?: (workout: PlanWorkout) => void;
  onEdit?: (workout: PlanWorkout) => void;
  onDelete?: (workout: PlanWorkout) => void;
}

export function WorkoutCard({
  workout,
  log,
  paces = [],
  mode = "view",
  onComplete,
  onUnComplete,
  onEdit,
  onDelete,
}: WorkoutCardProps) {
  const isCompleted = !!log?.completed_at;
  const title = log?.custom_title ?? workout.title;
  const description = log?.custom_description ?? workout.description;
  const estimate = getWorkoutEstimate(
    workout.distance_miles,
    workout.distance_unit ?? "mi",
    workout.pace_type,
    workout.duration_minutes,
    paces
  );

  if (workout.type === "rest") {
    return (
      <div className="rounded-lg border border-[var(--border)] p-3 opacity-60">
        <span className="text-sm text-[var(--muted)]">Rest day</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 transition-all ${
        isCompleted
          ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"
          : "border-[var(--border)] bg-[var(--card)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${workout.run_type ? (RUN_TYPE_COLORS[workout.run_type] ?? WORKOUT_TYPE_COLORS[workout.type]) : WORKOUT_TYPE_COLORS[workout.type]}`}
            >
              {workout.run_type ? (RUN_TYPE_LABELS[workout.run_type] ?? WORKOUT_TYPE_LABELS[workout.type]) : WORKOUT_TYPE_LABELS[workout.type]}
            </span>
            {isCompleted && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                ✓ Done
              </span>
            )}
          </div>
          <p className={`text-sm font-medium mt-1 ${isCompleted ? "line-through opacity-60" : ""}`}>
            {title}
          </p>
          {description && (
            <p className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed">{description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-[var(--muted)]">
            {workout.distance_miles && (
              <span>{workout.distance_miles} {workout.distance_unit ?? "mi"}</span>
            )}
            {workout.pace_type && (
              <span className="capitalize">{workout.pace_type} pace</span>
            )}
            {estimate && <span>~{estimate}</span>}
          </div>
        </div>

        {mode === "edit" && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => onEdit?.(workout)}
              className="text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete?.(workout)}
              className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950 transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {mode === "dashboard" && (
        <div className="pt-1 border-t border-[var(--border)]">
          {isCompleted ? (
            <button
              onClick={() => onUnComplete?.(workout)}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Mark incomplete
            </button>
          ) : (
            <button
              onClick={() => onComplete?.(workout)}
              className="text-xs font-medium text-[var(--accent)] hover:opacity-80 transition-opacity"
            >
              Mark complete →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
