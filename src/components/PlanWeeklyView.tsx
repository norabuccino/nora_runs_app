"use client";

import { useState } from "react";
import type { PlanWorkout, RunningPace } from "@/types/database";
import {
  DAY_NAMES,
  WORKOUT_TYPE_COLORS,
  WORKOUT_TYPE_LABELS,
  RUN_TYPE_COLORS,
  RUN_TYPE_LABELS,
  getWorkoutEstimate,
  weekMileageRange,
} from "@/lib/paceUtils";
import { WeekMileageLabel } from "@/components/WeekMileageLabel";
import { PlanWorkoutDetailModal } from "@/components/PlanWorkoutDetailModal";
import { displayDistance } from "@/lib/unitUtils";

interface PlanWeeklyViewProps {
  weeks: number[];
  allWorkouts: PlanWorkout[];
  daysPerWeek: number;
  weekNotes: Record<number, string>;
  paces: RunningPace[];
}

export function PlanWeeklyView({ weeks, allWorkouts, daysPerWeek, weekNotes, paces }: PlanWeeklyViewProps) {
  const [detailWorkout, setDetailWorkout] = useState<PlanWorkout | null>(null);

  return (
    <>
      <div className="space-y-10">
        {weeks.map((weekNum) => {
          const weekWorkouts = allWorkouts.filter((w) => w.week_number === weekNum);
          const { low, high } = weekMileageRange(weekWorkouts, daysPerWeek);
          return (
            <div key={weekNum} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-3 min-w-0">
                  <h2 className="font-semibold text-sm text-[var(--muted)] uppercase tracking-wide whitespace-nowrap">
                    Week {weekNum}
                  </h2>
                  {weekNotes[weekNum] && (
                    <p className="text-sm text-[var(--muted)] italic truncate">{weekNotes[weekNum]}</p>
                  )}
                </div>
                <WeekMileageLabel lowMi={low} highMi={high} />
              </div>
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                {weekWorkouts.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-[var(--muted)]">No workouts scheduled.</p>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {Array.from({ length: daysPerWeek }, (_, dayIndex) => {
                      const dayWorkouts = weekWorkouts
                        .filter((w) => w.day_of_week === dayIndex)
                        .sort((a, b) => a.sort_order - b.sort_order);
                      return (
                        <div key={dayIndex} className="flex gap-4 px-4 py-3">
                          <span className="text-xs font-medium text-[var(--muted)] w-14 shrink-0 pt-0.5">
                            {DAY_NAMES[dayIndex]}
                          </span>
                          <div className="flex-1 space-y-1.5">
                            {dayWorkouts.length === 0 ? (
                              <span className="text-xs text-[var(--muted)]">Rest</span>
                            ) : (
                              dayWorkouts.flatMap((w, i) => {
                                const estimate = getWorkoutEstimate(
                                  w.distance_miles,
                                  w.distance_unit ?? "mi",
                                  w.pace_type,
                                  w.duration_minutes,
                                  paces
                                );
                                const typeColor = w.run_type
                                  ? (RUN_TYPE_COLORS[w.run_type] ?? WORKOUT_TYPE_COLORS[w.type])
                                  : WORKOUT_TYPE_COLORS[w.type];
                                const typeLabel = w.run_type
                                  ? (RUN_TYPE_LABELS[w.run_type] ?? WORKOUT_TYPE_LABELS[w.type])
                                  : WORKOUT_TYPE_LABELS[w.type];

                                const card = (
                                  <button
                                    key={w.id}
                                    onClick={() => setDetailWorkout(w)}
                                    className="flex items-center gap-2 flex-wrap text-left w-full hover:opacity-80 transition-opacity"
                                  >
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor}`}>
                                      {typeLabel}
                                    </span>
                                    <span className="text-sm font-medium">{w.title}</span>
                                    {w.distance_miles && (
                                      <span className="text-xs text-[var(--muted)]">
                                        {displayDistance(w.distance_miles, w.distance_unit ?? "mi")}
                                      </span>
                                    )}
                                    {w.pace_type && (
                                      <span className="text-xs text-[var(--muted)] capitalize">{w.pace_type}</span>
                                    )}
                                    {estimate && (
                                      <span className="text-xs text-[var(--muted)]">~{estimate}</span>
                                    )}
                                  </button>
                                );

                                if (i === 0) return [card];
                                const logic = dayWorkouts[0].day_logic ?? "and";
                                const sep = (
                                  <div key={`logic-${i}`} className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-[var(--muted)] uppercase">
                                      {logic}
                                    </span>
                                  </div>
                                );
                                return [sep, card];
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {detailWorkout && (
        <PlanWorkoutDetailModal
          workout={detailWorkout}
          onClose={() => setDetailWorkout(null)}
        />
      )}
    </>
  );
}
