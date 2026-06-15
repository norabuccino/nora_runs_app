import type { PlanWorkout, WorkoutLog, RunningPace } from "@/types/database";
import { DAY_NAMES } from "@/lib/paceUtils";
import { WorkoutCard } from "./WorkoutCard";

interface WeekGridProps {
  weekNumber: number;
  workouts: PlanWorkout[];
  logs?: WorkoutLog[];
  paces?: RunningPace[];
  mode?: "view" | "dashboard" | "edit";
  onComplete?: (workout: PlanWorkout) => void;
  onUnComplete?: (workout: PlanWorkout) => void;
  onEdit?: (workout: PlanWorkout) => void;
  onDelete?: (workout: PlanWorkout) => void;
  onAddWorkout?: (weekNumber: number, dayOfWeek: number) => void;
  onDayLogicChange?: (weekNumber: number, dayOfWeek: number, logic: "and" | "or") => void;
}

export function WeekGrid({
  weekNumber,
  workouts,
  logs = [],
  paces = [],
  mode = "view",
  onComplete,
  onUnComplete,
  onEdit,
  onDelete,
  onAddWorkout,
  onDayLogicChange,
}: WeekGridProps) {
  const byDay = Array.from({ length: 7 }, (_, i) =>
    workouts.filter((w) => w.week_number === weekNumber && w.day_of_week === i)
      .sort((a, b) => a.sort_order - b.sort_order)
  );

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--muted)]">Week {weekNumber}</h3>
      <div className="grid grid-cols-7 gap-2 overflow-x-auto">
        {byDay.map((dayWorkouts, dayIndex) => {
          const dayLogic: "and" | "or" = dayWorkouts[0]?.day_logic ?? "and";

          return (
            <div key={dayIndex} className="min-w-[120px] space-y-2">
              <p className="text-xs font-medium text-center text-[var(--muted)]">
                {DAY_NAMES[dayIndex]}
              </p>
              <div className="space-y-1.5">
                {dayWorkouts.length === 0 ? (
                  mode === "edit" ? (
                    <button
                      onClick={() => onAddWorkout?.(weekNumber, dayIndex)}
                      className="w-full h-14 rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors"
                    >
                      + Add
                    </button>
                  ) : (
                    <div className="h-14 rounded-lg border border-dashed border-[var(--border)]" />
                  )
                ) : (
                  dayWorkouts.flatMap((workout, i) => {
                    const log = logs.find((l) => l.plan_workout_id === workout.id) ?? null;
                    const card = (
                      <WorkoutCard
                        key={workout.id}
                        workout={workout}
                        log={log}
                        paces={paces}
                        mode={mode}
                        onComplete={onComplete}
                        onUnComplete={onUnComplete}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    );
                    if (i === 0) return [card];

                    const separatorKey = `logic-${weekNumber}-${dayIndex}-${i}`;
                    const separator = mode === "edit" ? (
                      <button
                        key={separatorKey}
                        onClick={() =>
                          onDayLogicChange?.(weekNumber, dayIndex, dayLogic === "and" ? "or" : "and")
                        }
                        title={
                          dayLogic === "and"
                            ? "Both required — click to switch to OR (pick one)"
                            : "Pick one — click to switch to AND (both required)"
                        }
                        className="w-full flex items-center gap-1 py-0.5 group"
                      >
                        <div className="flex-1 h-px bg-[var(--border)] group-hover:bg-[var(--foreground)] transition-colors" />
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--muted)] group-hover:border-[var(--foreground)] group-hover:text-[var(--foreground)] transition-colors leading-none">
                          {dayLogic === "and" ? "AND" : "OR"}
                        </span>
                        <div className="flex-1 h-px bg-[var(--border)] group-hover:bg-[var(--foreground)] transition-colors" />
                      </button>
                    ) : (
                      <div key={separatorKey} className="flex items-center gap-1 py-0.5">
                        <div className="flex-1 h-px bg-[var(--border)]" />
                        <span className="text-[10px] font-semibold px-1 text-[var(--muted)] leading-none">
                          {dayLogic === "and" ? "AND" : "OR"}
                        </span>
                        <div className="flex-1 h-px bg-[var(--border)]" />
                      </div>
                    );

                    return [separator, card];
                  })
                )}
                {mode === "edit" && dayWorkouts.length > 0 && (
                  <button
                    onClick={() => onAddWorkout?.(weekNumber, dayIndex)}
                    className="w-full py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
