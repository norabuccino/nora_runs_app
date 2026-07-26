"use client";

import { useState } from "react";
import type { PlanWorkout, WorkoutLog, RunningPace } from "@/types/database";
import { getWorkoutEstimate, resolveWorkoutTypeDisplay } from "@/lib/paceUtils";
import { displayDistance, convertDistance, type DistanceUnit } from "@/lib/unitUtils";
import { useUnitPreference } from "@/hooks/useUnitPreference";
import { WorkoutTypeBadges } from "@/components/WorkoutTypeBadges";

interface WorkoutCardProps {
  workout: PlanWorkout;
  log?: WorkoutLog | null;
  paces?: RunningPace[];
  mode?: "view" | "dashboard" | "edit";
  onComplete?: (workout: PlanWorkout, actualDistanceMiles?: number | null) => void;
  onUnComplete?: (workout: PlanWorkout) => void;
  onEdit?: (workout: PlanWorkout) => void;
  onDelete?: (workout: PlanWorkout) => void;
  onCopy?: (workout: PlanWorkout) => void;
  onDetail?: (workout: PlanWorkout) => void;
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
  onCopy,
  onDetail,
}: WorkoutCardProps) {
  const [unit] = useUnitPreference();
  const [enteringMileage, setEnteringMileage] = useState(false);
  const [mileageInput, setMileageInput] = useState("");

  const isCompleted = !!log?.completed_at;
  const title = log?.custom_title ?? workout.title;
  const description = log?.custom_description ?? workout.description;
  const isStrength = workout.type === "strength";
  const hasDistance = !!workout.distance_miles;

  function startComplete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!hasDistance) {
      onComplete?.(workout);
      return;
    }
    const defaultVal = convertDistance(
      workout.distance_miles!,
      (workout.distance_unit ?? "mi") as DistanceUnit,
      unit
    );
    setMileageInput(String(parseFloat(defaultVal.toFixed(2))));
    setEnteringMileage(true);
  }

  function confirmComplete(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(mileageInput);
    const miles = Number.isFinite(parsed) ? convertDistance(parsed, unit, "mi") : null;
    onComplete?.(workout, miles);
    setEnteringMileage(false);
  }

  function cancelComplete(e: React.MouseEvent) {
    e.stopPropagation();
    setEnteringMileage(false);
  }

  const estimate = isStrength
    ? null
    : getWorkoutEstimate(
        workout.distance_miles,
        workout.distance_unit ?? "mi",
        workout.pace_type,
        workout.duration_minutes,
        paces
      );

  const { typeColor, typeLabel, subColor, subLabel } = resolveWorkoutTypeDisplay(
    workout.type,
    workout.run_type,
    workout.strength_type
  );
  const editColor = subColor ?? typeColor;
  const editLabel = subLabel ?? typeLabel;

  if (workout.type === "rest" && mode !== "edit") {
    return (
      <div className="rounded-lg border border-[var(--border)] p-3 opacity-60">
        <span className="text-sm text-[var(--muted)]">Rest day</span>
      </div>
    );
  }

  if (mode === "edit") {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className={`px-2 py-1 text-xs font-medium text-center w-full ${editColor}`}>
          {editLabel}
        </div>
        <div className="px-2 pt-1.5 pb-2">
          <p className="text-xs font-medium leading-snug">{title}</p>
        </div>
        <div className="flex border-t border-[var(--border)]">
          <button
            onClick={() => onEdit?.(workout)}
            className="flex-1 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
          >
            Edit
          </button>
          <div className="w-px bg-[var(--border)]" />
          <button
            onClick={() => onDelete?.(workout)}
            className="flex-1 py-1.5 text-xs text-[var(--muted)] hover:text-red-500 hover:bg-[var(--background)] transition-colors"
          >
            Delete
          </button>
        </div>
        <button
          onClick={() => onCopy?.(workout)}
          className="w-full py-1.5 text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] border-t border-[var(--border)] transition-colors"
        >
          Copy to days…
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => onDetail?.(workout)}
      className={`rounded-lg border p-3 space-y-2 transition-all ${
        isCompleted
          ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"
          : "border-[var(--border)] bg-[var(--card)]"
      } ${onDetail ? "cursor-pointer hover:border-[var(--foreground)]" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <WorkoutTypeBadges
            type={workout.type}
            run_type={workout.run_type}
            strength_type={workout.strength_type}
            compact
          />
          {isCompleted && (
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
              ✓ Done
              {log?.actual_distance_miles
                ? ` · ${displayDistance(convertDistance(log.actual_distance_miles, "mi", unit), unit)}`
                : ""}
            </span>
          )}
        </div>
        <p className={`text-sm font-medium mt-1 ${isCompleted ? "line-through opacity-60" : ""}`}>
          {title}
        </p>
        {description && (
          <p className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed">{description}</p>
        )}
        {!isStrength && (
          <div className="flex items-center gap-3 mt-1 text-xs text-[var(--muted)]">
            {workout.distance_miles && (
              <span>{displayDistance(workout.distance_miles, workout.distance_unit ?? "mi")}</span>
            )}
            {workout.pace_type && (
              <span className="capitalize">{workout.pace_type} pace</span>
            )}
            {estimate && <span>~{estimate}</span>}
          </div>
        )}
      </div>

      {mode === "dashboard" && (
        <div className="pt-1 border-t border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
          {isCompleted ? (
            <button
              onClick={() => onUnComplete?.(workout)}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Mark incomplete
            </button>
          ) : enteringMileage ? (
            <form onSubmit={confirmComplete} className="flex items-center gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                autoFocus
                value={mileageInput}
                onChange={(e) => setMileageInput(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-16 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs"
              />
              <span className="text-xs text-[var(--muted)]">{unit}</span>
              <button
                type="submit"
                className="text-xs font-medium text-[var(--accent)] hover:opacity-80 transition-opacity"
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelComplete}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={startComplete}
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
