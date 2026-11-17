// The decision for one workout name in a pasted plan, and how a "new workout"
// decision's edits (type, name, save to library) apply to what was guessed from the text.

import type { NewWorkoutFromText } from "@/lib/planTextImport";
import type { WorkoutType } from "@/types/database";

export type PlanWorkoutChoice =
  | { kind: "library"; id: string; title: string }
  /** A new workout from the text; `title` / `saveToLibrary` are the user's edits (unset = guessed title / the "save all" default). */
  | { kind: "new"; type?: WorkoutType; title?: string; saveToLibrary?: boolean }
  | { kind: "skip" };

export function applyNewWorkoutChoice(
  guess: NewWorkoutFromText,
  choice: PlanWorkoutChoice,
  saveAllNew: boolean
): { newWorkout: NewWorkoutFromText; saveToLibrary: boolean } {
  if (choice.kind !== "new") return { newWorkout: guess, saveToLibrary: false };
  const byType: NewWorkoutFromText =
    choice.type && choice.type !== guess.type
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
