"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PlanWorkout, RunningPace, WorkoutStep } from "@/types/database";
import { WorkoutTypeBadges } from "@/components/WorkoutTypeBadges";
import { STEP_TYPE_LABELS, formatPace, stepDurationSeconds } from "@/lib/paceUtils";

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

function formatStepDuration(durationMinutes: number | null, durationUnit: string): string | null {
  if (!durationMinutes) return null;
  if (durationUnit === "sec") return `${Math.round(durationMinutes * 60)} sec`;
  return `${durationMinutes} min`;
}

function StepRow({
  step,
  isStrength,
  treadmillMode,
  paces,
}: {
  step: WorkoutStep;
  isStrength: boolean;
  treadmillMode: boolean;
  paces: RunningPace[];
}) {
  if (isStrength) {
    const durLabel = formatStepDuration(step.duration_minutes, step.duration_unit);
    const perSet = step.reps ? `${step.reps} reps` : durLabel ?? null;
    const setsReps = step.sets && perSet
      ? `${step.sets} × ${perSet}`
      : step.sets
      ? `${step.sets} sets`
      : perSet ?? null;

    return (
      <div className="flex items-center gap-3 px-3 py-2 text-xs">
        <span className="flex-1 font-medium text-[var(--foreground)]">{step.label || "—"}</span>
        <span className="flex flex-wrap gap-2 text-[var(--muted)] shrink-0">
          {setsReps && <span>{setsReps}</span>}
          {step.weight_suggestion && <span>{step.weight_suggestion}</span>}
          {step.video_url && (
            <a
              href={step.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Watch video →
            </a>
          )}
        </span>
      </div>
    );
  }

  const treadmillSeconds = treadmillMode ? stepDurationSeconds(step, paces) : null;

  return (
    <div className="flex items-center gap-3 px-3 py-2 text-xs">
      <span className="text-[var(--muted)] w-20 shrink-0">
        {STEP_TYPE_LABELS[step.step_type] ?? step.step_type}
      </span>
      <span className="flex-1 flex flex-wrap gap-2 text-[var(--muted)]">
        {treadmillSeconds != null ? (
          <>
            <span className="font-medium text-[var(--foreground)]">{formatPace(treadmillSeconds)}</span>
            {step.pace_type && <span className="capitalize">@ {step.pace_type}</span>}
          </>
        ) : (
          <>
            {step.duration_minutes && <span>{formatStepDuration(step.duration_minutes, step.duration_unit)}</span>}
            {step.distance_miles && (
              <span>{parseFloat(Number(step.distance_miles).toFixed(2))} {step.distance_unit ?? "mi"}</span>
            )}
            {step.pace_type && <span className="capitalize">{step.pace_type}</span>}
          </>
        )}
      </span>
    </div>
  );
}

interface PlanWorkoutDetailModalProps {
  workout: PlanWorkout;
  onClose: () => void;
}

export function PlanWorkoutDetailModal({ workout, onClose }: PlanWorkoutDetailModalProps) {
  const [steps, setSteps] = useState<WorkoutStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(true);
  const [paces, setPaces] = useState<RunningPace[]>([]);
  const [treadmillMode, setTreadmillMode] = useState(false);

  useEffect(() => {
    async function fetchPaces() {
      const supabase = createClient();
      const { data } = await supabase.from("running_paces").select("*").order("created_at");
      setPaces(data ?? []);
    }
    fetchPaces();
  }, []);

  useEffect(() => {
    async function fetchSteps() {
      const supabase = createClient();
      const { data } = await supabase
        .from("workout_steps")
        .select("*")
        .eq("plan_workout_id", workout.id)
        .order("step_order");
      setSteps(data ?? []);
      setLoadingSteps(false);
    }
    fetchSteps();
  }, [workout.id]);

  const isStrength = workout.type === "strength";
  const hasDistanceSteps = steps.some((s) => s.distance_miles != null);
  const distanceLabel =
    !isStrength && workout.distance_miles
      ? `${parseFloat(Number(workout.distance_miles).toFixed(2))} ${workout.distance_unit ?? "mi"}`
      : null;
  const durationLabel = workout.duration_minutes ? `${workout.duration_minutes} min` : null;
  const groupLabel = isStrength ? "Superset" : "Repeat";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90dvh] sm:max-h-[90vh]">
        <div className="p-4 sm:p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <WorkoutTypeBadges
                type={workout.type}
                run_type={workout.run_type}
                strength_type={workout.strength_type}
              />
              <h2 className="font-semibold text-lg leading-snug">{workout.title}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isStrength && hasDistanceSteps && (
                <button
                  onClick={() => setTreadmillMode((v) => !v)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--card)] transition-colors"
                >
                  {treadmillMode ? "Treadmill: On" : "Treadmill mode"}
                </button>
              )}
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

          {/* Steps / Exercises */}
          {loadingSteps ? (
            <p className="text-xs text-[var(--muted)]">Loading…</p>
          ) : steps.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                {isStrength ? "Exercises" : "Steps"}
              </p>
              <div className="space-y-1.5">
                {groupSteps(steps).map((seg, i) => {
                  if (seg.type === "step") {
                    return (
                      <div key={i} className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                        <StepRow step={seg.step} isStrength={isStrength} treadmillMode={treadmillMode} paces={paces} />
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="rounded-lg border border-[var(--border)]">
                      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)]">
                        <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                          {isStrength && seg.steps[0]?.group_name
                            ? seg.steps[0].group_name
                            : groupLabel}
                        </span>
                        {(!isStrength || !seg.steps.some((s) => s.sets !== null)) && (
                          <>
                            <span className="text-xs text-[var(--muted)]">×</span>
                            <span className="text-xs font-semibold text-[var(--muted)]">{seg.repeatCount}</span>
                          </>
                        )}
                      </div>
                      <div className="divide-y divide-[var(--border)] border-l-2 border-[var(--border)] ml-2">
                        {seg.steps.map((step, j) => (
                          <StepRow key={j} step={step} isStrength={isStrength} treadmillMode={treadmillMode} paces={paces} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Notes */}
          {workout.notes && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Notes</p>
              <p className="text-sm text-[var(--muted)]">{workout.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
