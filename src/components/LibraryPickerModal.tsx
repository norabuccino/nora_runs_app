"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LibraryWorkoutWithSteps } from "@/types/database";
import { addLibraryWorkoutToPlan } from "@/app/actions/workoutLibrary";
import { WORKOUT_TYPE_COLORS, WORKOUT_TYPE_LABELS, RUN_TYPE_COLORS, RUN_TYPE_LABELS } from "@/lib/paceUtils";
import { WorkoutFilterBar, applyWorkoutFilter, DEFAULT_FILTER, type WorkoutFilter } from "@/components/WorkoutFilterBar";

interface LibraryPickerModalProps {
  planId: string;
  weekNumber: number;
  dayOfWeek: number;
  onAdded: () => void;
  onCancel: () => void;
}

export function LibraryPickerModal({
  planId,
  weekNumber,
  dayOfWeek,
  onAdded,
  onCancel,
}: LibraryPickerModalProps) {
  const [workouts, setWorkouts] = useState<LibraryWorkoutWithSteps[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WorkoutFilter>(DEFAULT_FILTER);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: ws }, { data: steps }] = await Promise.all([
        supabase.from("workouts").select("*").order("created_at", { ascending: false }),
        supabase.from("workout_steps").select("*").not("workout_id", "is", null).order("step_order"),
      ]);
      const stepsMap: Record<string, typeof steps> = {};
      (steps ?? []).forEach((s) => {
        if (!s.workout_id) return;
        if (!stepsMap[s.workout_id]) stepsMap[s.workout_id] = [];
        stepsMap[s.workout_id]!.push(s);
      });
      setWorkouts((ws ?? []).map((w) => ({ ...w, workout_steps: stepsMap[w.id] ?? [] })));
      setLoading(false);
    }
    load();
  }, []);

  function handleSelect(workout: LibraryWorkoutWithSteps) {
    startTransition(async () => {
      await addLibraryWorkoutToPlan(workout.id, planId, weekNumber, dayOfWeek);
      onAdded();
    });
  }

  const filtered = applyWorkoutFilter(workouts, filter).filter((w) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return w.title.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q);
  });

  const displayed = filter.type === "run"
    ? [...filtered].sort((a, b) => {
        const ad = a.distance_miles != null ? parseFloat(String(a.distance_miles)) : Infinity;
        const bd = b.distance_miles != null ? parseFloat(String(b.distance_miles)) : Infinity;
        return ad - bd;
      })
    : filtered;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-xl flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              title="Back"
            >
              ←
            </button>
            <h2 className="font-semibold">Add from library</h2>
          </div>
          <button
            onClick={onCancel}
            className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4 border-b border-[var(--border)] space-y-3">
          <input
            type="search"
            placeholder="Search workouts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            autoFocus
          />
          <WorkoutFilterBar filter={filter} onChange={setFilter} />
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {loading && <p className="text-sm text-[var(--muted)] text-center py-8">Loading…</p>}

          {!loading && workouts.length === 0 && (
            <p className="text-sm text-[var(--muted)] text-center py-8">
              Your library is empty. Create workouts on the Workouts page first.
            </p>
          )}

          {!loading && workouts.length > 0 && displayed.length === 0 && (
            <p className="text-sm text-[var(--muted)] text-center py-8">
              No workouts match this filter.
            </p>
          )}

          {!loading && displayed.length > 0 && (
            <div className="flex flex-col gap-1">
              {displayed.map((workout) => {
                const typeBadge = workout.run_type
                  ? (RUN_TYPE_COLORS[workout.run_type] ?? WORKOUT_TYPE_COLORS[workout.type])
                  : (WORKOUT_TYPE_COLORS[workout.type] ?? "bg-gray-100 text-gray-600");
                const typeLabel = workout.run_type
                  ? RUN_TYPE_LABELS[workout.run_type]
                  : WORKOUT_TYPE_LABELS[workout.type];
                const distanceLabel = workout.distance_miles
                  ? `${parseFloat(Number(workout.distance_miles).toFixed(2))} ${workout.distance_unit ?? "mi"}`
                  : null;
                const durationLabel = workout.duration_minutes
                  ? `${workout.duration_minutes} min`
                  : null;

                return (
                  <button
                    key={workout.id}
                    disabled={isPending}
                    onClick={() => handleSelect(workout)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 flex items-center gap-3 hover:border-[var(--foreground)] transition-colors text-left disabled:opacity-50"
                  >
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${typeBadge}`}>
                      {typeLabel}
                    </span>
                    <span className="text-sm font-medium truncate flex-1 min-w-0">{workout.title}</span>
                    {(distanceLabel || durationLabel) && (
                      <div className="flex-shrink-0 text-right">
                        {distanceLabel && <p className="text-xs font-medium leading-tight">{distanceLabel}</p>}
                        {durationLabel && <p className="text-xs text-[var(--muted)] leading-tight">{durationLabel}</p>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
