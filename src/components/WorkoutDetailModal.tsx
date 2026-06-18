"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LibraryWorkoutWithSteps, WorkoutStep } from "@/types/database";
import { WORKOUT_TYPE_COLORS, WORKOUT_TYPE_LABELS, RUN_TYPE_COLORS, RUN_TYPE_LABELS, STEP_TYPE_LABELS, DAY_NAMES } from "@/lib/paceUtils";

type StepSegment =
  | { type: "step"; step: WorkoutStep }
  | { type: "group"; repeatCount: number; steps: WorkoutStep[] };

function groupSteps(steps: WorkoutStep[]): StepSegment[] {
  const segments: StepSegment[] = [];
  let i = 0;
  while (i < steps.length) {
    const gid = steps[i].repeat_group_id;
    if (gid === null) {
      segments.push({ type: "step", step: steps[i] });
      i++;
    } else {
      const group: WorkoutStep[] = [];
      while (i < steps.length && steps[i].repeat_group_id === gid) {
        group.push(steps[i]);
        i++;
      }
      segments.push({ type: "group", repeatCount: group[0].repeat_count, steps: group });
    }
  }
  return segments;
}

function StepRow({ step }: { step: WorkoutStep }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-xs">
      <span className="text-[var(--muted)] w-20 shrink-0">
        {STEP_TYPE_LABELS[step.step_type] ?? step.step_type}
      </span>
      <span className="flex-1 flex flex-wrap gap-2 text-[var(--muted)]">
        {step.duration_minutes && <span>{step.duration_minutes} min</span>}
        {step.distance_miles && (
          <span>{parseFloat(Number(step.distance_miles).toFixed(2))} {step.distance_unit ?? "mi"}</span>
        )}
        {step.pace_type && <span className="capitalize">{step.pace_type}</span>}
      </span>
    </div>
  );
}

interface PlanUsage {
  id: string;
  week_number: number;
  day_of_week: number;
  plan_id: string;
  training_plans: { id: string; name: string } | null;
}

interface WorkoutDetailModalProps {
  workout: LibraryWorkoutWithSteps;
  onClose: () => void;
  onEdit: (w: LibraryWorkoutWithSteps) => void;
}

export function WorkoutDetailModal({ workout, onClose, onEdit }: WorkoutDetailModalProps) {
  const [usage, setUsage] = useState<PlanUsage[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(true);

  useEffect(() => {
    async function fetchUsage() {
      const supabase = createClient();
      const { data } = await supabase
        .from("plan_workouts")
        .select("id, week_number, day_of_week, plan_id, training_plans(id, name)")
        .eq("library_workout_id", workout.id)
        .order("week_number");
      setUsage((data ?? []) as unknown as PlanUsage[]);
      setLoadingUsage(false);
    }
    fetchUsage();
  }, [workout.id]);

  const typeBadge = workout.run_type
    ? (RUN_TYPE_COLORS[workout.run_type] ?? WORKOUT_TYPE_COLORS[workout.type])
    : (WORKOUT_TYPE_COLORS[workout.type] ?? "bg-gray-100 text-gray-600");
  const typeLabel = workout.run_type
    ? RUN_TYPE_LABELS[workout.run_type]
    : WORKOUT_TYPE_LABELS[workout.type];

  const distanceLabel = workout.distance_miles
    ? `${parseFloat(Number(workout.distance_miles).toFixed(2))} ${workout.distance_unit ?? "mi"}`
    : null;
  const durationLabel = workout.duration_minutes ? `${workout.duration_minutes} min` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge}`}>
                {typeLabel}
              </span>
              <h2 className="font-semibold text-lg leading-snug">{workout.title}</h2>
              {workout.source && (
                <p className="text-xs text-[var(--muted)]">from {workout.source}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onEdit(workout)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--card)] transition-colors"
              >
                Edit
              </button>
              <button
                onClick={onClose}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {/* Distance / duration */}
          {(distanceLabel || durationLabel) && (
            <div className="flex gap-4">
              {distanceLabel && (
                <div>
                  <p className="text-xs text-[var(--muted)]">Distance</p>
                  <p className="text-sm font-medium">{distanceLabel}</p>
                </div>
              )}
              {durationLabel && (
                <div>
                  <p className="text-xs text-[var(--muted)]">Duration</p>
                  <p className="text-sm font-medium">{durationLabel}</p>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {workout.description && (
            <p className="text-sm text-[var(--muted)]">{workout.description}</p>
          )}

          {/* Steps */}
          {workout.workout_steps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Steps</p>
              <div className="space-y-1.5">
                {groupSteps(workout.workout_steps).map((seg, i) => {
                  if (seg.type === "step") {
                    return (
                      <div key={i} className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                        <StepRow step={seg.step} />
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="rounded-lg border border-[var(--border)]">
                      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)]">
                        <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Repeat</span>
                        <span className="text-xs text-[var(--muted)]">×</span>
                        <span className="text-xs font-semibold text-[var(--muted)]">{seg.repeatCount}</span>
                      </div>
                      <div className="divide-y divide-[var(--border)] border-l-2 border-[var(--border)] ml-2">
                        {seg.steps.map((step, j) => (
                          <StepRow key={j} step={step} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          {workout.notes && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Notes</p>
              <p className="text-sm text-[var(--muted)]">{workout.notes}</p>
            </div>
          )}

          {/* Plans using this workout */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Used in plans</p>
            {loadingUsage ? (
              <p className="text-xs text-[var(--muted)]">Loading…</p>
            ) : usage.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">Not added to any plan yet.</p>
            ) : (
              <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                {usage.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="font-medium">{u.training_plans?.name ?? "Unknown plan"}</span>
                    <span className="text-[var(--muted)]">
                      Week {u.week_number}, {DAY_NAMES[u.day_of_week]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
