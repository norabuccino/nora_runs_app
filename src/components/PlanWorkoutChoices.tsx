"use client";

// Matching the workout names in a pasted plan to the workout library, shared by
// the plan editor's "Paste plan from text" dialog and the admin bulk plan import.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { workoutFromText, type NewWorkoutFromText } from "@/lib/planTextImport";
import { matchExercise, normalizeExerciseName, type ExerciseMatch } from "@/lib/exerciseMatch";
import { RUN_TYPE_LABELS, STRENGTH_TYPE_LABELS, WORKOUT_TYPE_LABELS } from "@/lib/paceUtils";
import type { WorkoutType } from "@/types/database";

export type LibraryWorkout = { id: string; title: string; type: string };
export type PlanWorkoutChoice = { kind: "library"; id: string; title: string } | { kind: "new"; type?: WorkoutType } | { kind: "skip" };

export interface ResolvedPlanWorkout {
  key: string;
  choice: PlanWorkoutChoice;
  match: ExerciseMatch<LibraryWorkout & { name: string }>;
  /** What "new from text" would create. */
  newWorkout: NewWorkoutFromText;
}

const TYPES: WorkoutType[] = ["run", "strength", "bike", "swim", "cross_train", "rest"];

export function weeksLabel(weeks: number[]): string {
  if (weeks.length === 1) return `Week ${weeks[0]}`;
  const contiguous = weeks.every((w, i) => i === 0 || w === weeks[i - 1] + 1);
  return contiguous ? `Weeks ${weeks[0]}–${weeks[weeks.length - 1]}` : `Weeks ${weeks.join(", ")}`;
}

/** Loads the workout library and tracks one decision per distinct workout name. Exact title matches default to the library copy. */
export function usePlanWorkoutChoices() {
  const [library, setLibrary] = useState<LibraryWorkout[]>([]);
  const [choices, setChoices] = useState<Record<string, PlanWorkoutChoice>>({});

  useEffect(() => {
    createClient()
      .from("workouts")
      .select("id, title, type")
      .order("title")
      .then(({ data }) => setLibrary(data ?? []));
  }, []);

  const knownTitles = useMemo(() => new Set(library.map((w) => normalizeExerciseName(w.title))), [library]);
  const named = useMemo(() => library.map((w) => ({ ...w, name: w.title })), [library]);
  const isKnownWorkout = useCallback((text: string) => knownTitles.has(normalizeExerciseName(text)), [knownTitles]);

  function resolve(typed: string): ResolvedPlanWorkout {
    const key = normalizeExerciseName(typed);
    const match = matchExercise(typed, named);
    const choice: PlanWorkoutChoice =
      choices[key] ?? (match.exercise ? { kind: "library", id: match.exercise.id, title: match.exercise.title } : { kind: "new" });
    const guess = workoutFromText(typed);
    const newWorkout: NewWorkoutFromText =
      choice.kind === "new" && choice.type && choice.type !== guess.type
        ? {
            ...guess,
            type: choice.type,
            run_type: choice.type === "run" ? guess.run_type : null,
            strength_type: choice.type === "strength" ? guess.strength_type : null,
          }
        : guess;
    return { key, choice, match, newWorkout };
  }

  return {
    library,
    isKnownWorkout,
    resolve,
    choose: (key: string, choice: PlanWorkoutChoice) => setChoices((p) => ({ ...p, [key]: choice })),
  };
}

function describeNew(w: NewWorkoutFromText): string {
  return [
    WORKOUT_TYPE_LABELS[w.type] ?? w.type,
    w.run_type ? RUN_TYPE_LABELS[w.run_type] : null,
    w.strength_type ? STRENGTH_TYPE_LABELS[w.strength_type] : null,
    w.distance_miles != null ? `${w.distance_miles} ${w.distance_unit}` : null,
    w.duration_minutes != null ? `${w.duration_minutes} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

const btn = "text-xs px-2 py-0.5 rounded-md border border-[var(--border)] hover:bg-[var(--card)] transition-colors";

/** One workout name from a pasted plan: library copy, new workout, or skipped — with the controls to change it. */
export function PlanWorkoutChoiceRow({
  typed,
  resolved,
  library,
  onChoose,
}: {
  typed: string;
  resolved: ResolvedPlanWorkout;
  library: LibraryWorkout[];
  onChoose: (key: string, choice: PlanWorkoutChoice) => void;
}) {
  const { key, choice, match, newWorkout } = resolved;
  return (
    <li className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 space-y-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 text-sm">
          {choice.kind === "library" ? (
            <>
              <span className="text-[var(--accent)]">✓</span> <span className="font-medium">{choice.title}</span>
              <span className="text-xs text-[var(--muted)]"> · from your library</span>
              {normalizeExerciseName(choice.title) !== key && (
                <span className="text-xs text-[var(--muted)]"> · typed “{typed}”</span>
              )}
            </>
          ) : choice.kind === "skip" ? (
            <span className="text-[var(--muted)] line-through">{typed}</span>
          ) : (
            <>
              <span className="text-[var(--muted)]">+</span> <span className="font-medium">{newWorkout.title}</span>
              <span className="text-xs text-[var(--muted)]"> · new workout · {describeNew(newWorkout)}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {choice.kind === "new" && (
            <select
              value={newWorkout.type}
              onChange={(e) => onChoose(key, { kind: "new", type: e.target.value as WorkoutType })}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs"
              aria-label="Workout type"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {WORKOUT_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          )}
          <select
            value=""
            onChange={(e) => {
              const w = library.find((l) => l.id === e.target.value);
              if (w) onChoose(key, { kind: "library", id: w.id, title: w.title });
            }}
            className="max-w-[11rem] rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs"
            aria-label="Pick from library"
          >
            <option value="">Pick from library…</option>
            {library.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
              </option>
            ))}
          </select>
          {choice.kind !== "new" && (
            <button type="button" onClick={() => onChoose(key, { kind: "new" })} className={btn}>
              New from text
            </button>
          )}
          {choice.kind !== "skip" && (
            <button type="button" onClick={() => onChoose(key, { kind: "skip" })} className={btn}>
              Skip
            </button>
          )}
        </div>
      </div>
      {choice.kind === "new" && match.suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--muted)]">Similar in your library:</span>
          {match.suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChoose(key, { kind: "library", id: s.id, title: s.title })}
              className={`${btn} border-[var(--accent)] text-[var(--accent)]`}
            >
              Use “{s.title}”
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
