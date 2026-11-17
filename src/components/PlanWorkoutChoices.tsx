"use client";

// Matching the workout names in a pasted plan to the workout library, shared by
// the plan editor's "Paste plan from text" dialog and the admin bulk plan import.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { splitAddOns, workoutFromText, type NewWorkoutFromText } from "@/lib/planTextImport";
import { applyNewWorkoutChoice, type PlanWorkoutChoice } from "@/lib/planWorkoutChoice";
import { defaultSubType, filterLibrary, subTypeOptions } from "@/lib/libraryPicker";
import { describeStepData, groupStepData, planRunSteps } from "@/lib/workoutTextBlock";
import { matchExercise, normalizeExerciseName, type ExerciseMatch } from "@/lib/exerciseMatch";
import { RUN_TYPE_LABELS, STEP_TYPE_LABELS, STRENGTH_TYPE_LABELS, WORKOUT_TYPE_LABELS } from "@/lib/paceUtils";
import type { RunningPace, WorkoutType } from "@/types/database";

export type LibraryWorkout = {
  id: string;
  title: string;
  type: string;
  run_type: string | null;
  strength_type: string | null;
  cross_train_type: string | null;
};
export type { PlanWorkoutChoice } from "@/lib/planWorkoutChoice";

export interface ResolvedPlanWorkout {
  key: string;
  choice: PlanWorkoutChoice;
  match: ExerciseMatch<LibraryWorkout & { name: string }>;
  /** What "new from text" would create. */
  newWorkout: NewWorkoutFromText;
  /** A new workout is also saved to the workout library (and the plan copies link to it). */
  saveToLibrary: boolean;
}

const TYPES: WorkoutType[] = ["run", "strength", "bike", "swim", "cross_train", "rest"];

export function weeksLabel(weeks: number[]): string {
  if (weeks.length === 1) return `Week ${weeks[0]}`;
  const contiguous = weeks.every((w, i) => i === 0 || w === weeks[i - 1] + 1);
  return contiguous ? `Weeks ${weeks[0]}–${weeks[weeks.length - 1]}` : `Weeks ${weeks.join(", ")}`;
}

/**
 * Loads the workout library (and the user's paces, for steps of structured runs) and tracks one
 * decision per distinct workout name. Exact title matches default to the library copy.
 */
export function usePlanWorkoutChoices() {
  const [library, setLibrary] = useState<LibraryWorkout[]>([]);
  const [paces, setPaces] = useState<RunningPace[]>([]);
  const [choices, setChoices] = useState<Record<string, PlanWorkoutChoice>>({});
  const [saveAllNew, setSaveAllNewState] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("workouts")
      .select("id, title, type, run_type, strength_type, cross_train_type")
      .order("title")
      .then(({ data }) => setLibrary(data ?? []));
    supabase
      .from("running_paces")
      .select("*")
      .order("created_at")
      .then(({ data }) => setPaces(data ?? []));
  }, []);

  const knownTitles = useMemo(() => new Set(library.map((w) => normalizeExerciseName(w.title))), [library]);
  const named = useMemo(() => library.map((w) => ({ ...w, name: w.title })), [library]);
  const isKnownWorkout = useCallback((text: string) => knownTitles.has(normalizeExerciseName(text)), [knownTitles]);

  function resolve(typed: string): ResolvedPlanWorkout {
    const key = normalizeExerciseName(typed);
    // "w/ strides & drills" is left out of matching (it becomes the new workout's notes).
    const match = matchExercise(splitAddOns(typed).core, named);
    const choice: PlanWorkoutChoice =
      choices[key] ?? (match.exercise ? { kind: "library", id: match.exercise.id, title: match.exercise.title } : { kind: "new" });
    const guess = withRunSteps(workoutFromText(typed), paces);
    const { newWorkout, saveToLibrary } = applyNewWorkoutChoice(guess, choice, saveAllNew);
    return { key, choice, match, newWorkout, saveToLibrary };
  }

  return {
    library,
    paces,
    isKnownWorkout,
    resolve,
    choose: (key: string, choice: PlanWorkoutChoice) => setChoices((p) => ({ ...p, [key]: choice })),
    saveAllNew,
    /** Sets "save to library" for every new workout (clearing per-row choices). */
    setSaveAllNew: (value: boolean) => {
      setSaveAllNewState(value);
      setChoices((p) =>
        Object.fromEntries(
          Object.entries(p).map(([k, c]) => [k, c.kind === "new" ? { ...c, saveToLibrary: undefined } : c])
        )
      );
    },
  };
}

/** A structured run ("2M w/u; 8x400m …; 2M c/d") gets its steps, and distance/time from them. */
function withRunSteps(w: NewWorkoutFromText, paces: RunningPace[]): NewWorkoutFromText {
  if (w.type !== "run") return w;
  const parsed = planRunSteps(splitAddOns(w.title).core, paces);
  if (!parsed) return w;
  return {
    ...w,
    steps: parsed.steps,
    distance_miles: parsed.miles || w.distance_miles,
    distance_unit: parsed.miles ? "mi" : w.distance_unit,
    duration_minutes: parsed.minutes || w.duration_minutes,
  };
}

function describeNew(w: NewWorkoutFromText): string {
  return [
    WORKOUT_TYPE_LABELS[w.type] ?? w.type,
    w.run_type ? RUN_TYPE_LABELS[w.run_type] : null,
    w.strength_type ? STRENGTH_TYPE_LABELS[w.strength_type] : null,
    w.distance_miles != null ? `${w.distance_miles} ${w.distance_unit}` : null,
    w.duration_minutes != null ? `${w.duration_minutes} min` : null,
    w.notes,
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
  const [showSteps, setShowSteps] = useState(false);
  const steps = choice.kind === "new" ? newWorkout.steps ?? [] : [];

  // "Pick from library" only lists workouts of the type being imported, optionally narrowed to a sub-type.
  const pickType = newWorkout.type;
  const subOptions = useMemo(() => subTypeOptions(library, pickType), [library, pickType]);
  const [subFilter, setSubFilter] = useState<{ type: string; sub: string } | null>(null);
  const sub = subFilter?.type === pickType ? subFilter.sub : defaultSubType(library, pickType, newWorkout);
  const [showAll, setShowAll] = useState(false);
  const pickable = showAll ? library : filterLibrary(library, pickType, sub);
  const typeName = WORKOUT_TYPE_LABELS[pickType] ?? pickType;
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
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--muted)]">+</span>
                <input
                  value={choice.kind === "new" && choice.title !== undefined ? choice.title : newWorkout.title}
                  onChange={(e) => onChoose(key, { ...choice, title: e.target.value })}
                  onBlur={(e) => !e.target.value.trim() && onChoose(key, { ...choice, title: undefined })}
                  className="min-w-0 w-64 max-w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-sm font-medium"
                  aria-label="New workout name"
                  title="Workout name"
                />
              </div>
              <div className="text-xs text-[var(--muted)]">
                new workout · {describeNew(newWorkout)}
                {normalizeExerciseName(newWorkout.title) !== key && <> · typed “{typed}”</>}
              </div>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={resolved.saveToLibrary}
                  onChange={(e) => onChoose(key, { ...choice, saveToLibrary: e.target.checked })}
                />
                Also save to my workout library
              </label>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {choice.kind === "new" && (
            <select
              value={newWorkout.type}
              onChange={(e) => onChoose(key, { ...choice, kind: "new", type: e.target.value as WorkoutType })}
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
          {!showAll && subOptions.length > 0 && (
            <select
              value={sub}
              onChange={(e) => setSubFilter({ type: pickType, sub: e.target.value })}
              className="max-w-[9rem] rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs"
              aria-label={`Filter library by ${typeName.toLowerCase()} type`}
            >
              <option value="">All {typeName.toLowerCase()}</option>
              {subOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          <select
            value=""
            onChange={(e) => {
              if (e.target.value === "__all") return setShowAll(true);
              if (e.target.value === "__type") return setShowAll(false);
              const w = library.find((l) => l.id === e.target.value);
              if (w) onChoose(key, { kind: "library", id: w.id, title: w.title });
            }}
            className="max-w-[11rem] rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs"
            aria-label="Pick from library"
          >
            <option value="">
              {pickable.length ? `Pick from library (${pickable.length})…` : "No matching library workouts"}
            </option>
            {showAll
              ? [...new Set(library.map((w) => w.type))]
                  .sort((a, b) => ((TYPES as string[]).indexOf(a) + 1 || 99) - ((TYPES as string[]).indexOf(b) + 1 || 99))
                  .map((t) => (
                  <optgroup key={t} label={WORKOUT_TYPE_LABELS[t] ?? t}>
                    {library
                      .filter((w) => w.type === t)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.title}
                        </option>
                      ))}
                  </optgroup>
                ))
              : pickable.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title}
                  </option>
                ))}
            <option disabled>──────────</option>
            {showAll ? (
              <option value="__type">Only {typeName.toLowerCase()} workouts</option>
            ) : (
              <option value="__all">Show all library workouts…</option>
            )}
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
      {steps.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowSteps((v) => !v)}
            className="text-xs text-[var(--accent)] hover:underline"
            aria-expanded={showSteps}
          >
            {showSteps ? "▾ Hide" : "▸ Show"} {steps.length} steps
          </button>
          {showSteps && (
            <ol className="mt-1 space-y-1 text-xs">
              {groupStepData(steps).map((g, i) =>
                g.repeat != null ? (
                  <li key={i} className="rounded-md border border-[var(--border)] px-2 py-1">
                    <div className="font-medium">Repeat {g.repeat}×</div>
                    <ul className="pl-3 space-y-0.5 text-[var(--muted)]">
                      {g.steps.map((s, j) => (
                        <li key={j}>{describeStepData(s, STEP_TYPE_LABELS)}</li>
                      ))}
                    </ul>
                  </li>
                ) : (
                  <li key={i} className="px-2">
                    {describeStepData(g.steps[0], STEP_TYPE_LABELS)}
                  </li>
                )
              )}
            </ol>
          )}
        </div>
      )}
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

/** "Save all new workouts to my library" — shown above the workout rows when any will be created. */
export function SaveAllToLibraryToggle({
  resolved,
  onChange,
}: {
  resolved: ResolvedPlanWorkout[];
  onChange: (value: boolean) => void;
}) {
  const fresh = resolved.filter((r) => r.choice.kind === "new");
  if (!fresh.length) return null;
  const saving = fresh.filter((r) => r.saveToLibrary).length;
  return (
    <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
      <input
        type="checkbox"
        checked={saving === fresh.length}
        ref={(el) => {
          if (el) el.indeterminate = saving > 0 && saving < fresh.length;
        }}
        onChange={(e) => onChange(e.target.checked)}
      />
      Save all {fresh.length} new {fresh.length === 1 ? "workout" : "workouts"} to my workout library
      {saving > 0 && saving < fresh.length && ` (${saving} selected)`}
    </label>
  );
}
