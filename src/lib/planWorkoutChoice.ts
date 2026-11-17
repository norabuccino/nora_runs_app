// The decision for one workout name in a pasted plan, and how a "new workout"
// decision's edits (type, name, save to library) apply to what was guessed from the text.

import type { NewWorkoutFromText } from "@/lib/planTextImport";
import type { ExerciseMatch } from "@/lib/exerciseMatch";
import type { StepData } from "@/lib/workoutTextBlock";

/** A new workout as corrected in the workout editor ("Edit steps…") — saved as-is instead of the parsed one. */
export type EditedWorkout = NewWorkoutFromText & {
  steps: StepData[];
  pace_type?: string | null;
  bike_location?: string | null;
  cross_train_type?: string | null;
  continuous_timers?: boolean;
  equipment_added?: string[];
  equipment_removed?: string[];
};
import type { WorkoutType } from "@/types/database";

export type PlanWorkoutChoice =
  | { kind: "library"; id: string; title: string }
  /** A new workout from the text; `title` / `saveToLibrary` are the user's edits (unset = guessed title / the "save all" default). */
  | { kind: "new"; type?: WorkoutType; title?: string; saveToLibrary?: boolean; edited?: EditedWorkout }
  | { kind: "skip" };

export function applyNewWorkoutChoice(
  guess: NewWorkoutFromText,
  choice: PlanWorkoutChoice,
  saveAllNew: boolean
): { newWorkout: NewWorkoutFromText; saveToLibrary: boolean } {
  if (choice.kind !== "new") return { newWorkout: guess, saveToLibrary: false };
  const byType: NewWorkoutFromText = choice.edited
    ? choice.edited
    : choice.type && choice.type !== guess.type
      ? {
          ...guess,
          type: choice.type,
          run_type: choice.type === "run" ? guess.run_type : null,
          strength_type: choice.type === "strength" ? guess.strength_type : null,
          steps: choice.type === "run" ? guess.steps : undefined,
        }
      : guess;
  // An edited name replaces the guessed title (steps etc. still come from the pasted text).
  const title = choice.title?.trim();
  return { newWorkout: title ? { ...byType, title } : byType, saveToLibrary: choice.saveToLibrary ?? saveAllNew };
}

/**
 * The library match shown for a workout and the decision it starts with. Named workouts default to
 * an exact library match; a workout written out in full defaults to new, with that match offered
 * as the first suggestion instead.
 */
export function initialChoice<T extends { id: string; title: string }>(
  found: ExerciseMatch<T>,
  writtenOut: boolean
): { match: ExerciseMatch<T>; choice: PlanWorkoutChoice } {
  const exact = found.exercise;
  if (writtenOut && exact) {
    return {
      match: { status: "suggested", exercise: null, suggestions: [exact, ...found.suggestions.filter((s) => s.id !== exact.id)] },
      choice: { kind: "new" },
    };
  }
  return { match: found, choice: exact ? { kind: "library", id: exact.id, title: exact.title } : { kind: "new" } };
}
