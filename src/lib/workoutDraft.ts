// Moving a not-yet-saved workout (from a plan import) in and out of the workout
// editor, so its parsed steps can be corrected before anything is created.

import type { WorkoutFormData } from "@/components/WorkoutForm";
import type { WorkoutWithSteps } from "@/types/database";
import type { NewWorkoutFromText } from "@/lib/planTextImport";
import type { EditedWorkout } from "@/lib/planWorkoutChoice";
import { formRowsToStepData, type StepData } from "@/lib/workoutTextBlock";

type Draft = NewWorkoutFromText & Partial<Omit<EditedWorkout, keyof NewWorkoutFromText>>;

/** The draft in the shape `WorkoutForm` edits (`existing`). Ids are placeholders — nothing is saved. */
export function draftToExisting(w: Draft): WorkoutWithSteps {
  const steps: StepData[] = (w.steps as StepData[] | undefined) ?? [];
  return {
    id: "import-draft",
    plan_id: "",
    week_number: 1,
    day_of_week: 0,
    sort_order: 0,
    type: w.type,
    run_type: w.run_type,
    strength_type: w.strength_type,
    title: w.title,
    description: w.description ?? null,
    distance_miles: w.distance_miles,
    distance_unit: w.distance_unit,
    pace_type: w.pace_type ?? null,
    duration_minutes: w.duration_minutes,
    notes: w.notes,
    bike_location: w.bike_location ?? null,
    cross_train_type: w.cross_train_type ?? null,
    continuous_timers: w.continuous_timers ?? false,
    equipment_added: w.equipment_added ?? [],
    equipment_removed: w.equipment_removed ?? [],
    workout_steps: steps.map((s, i) => ({ ...s, id: `import-draft-${i}`, step_order: i })),
  } as unknown as WorkoutWithSteps;
}

/** What the workout editor saved, as the workout the import will create. */
export function formDataToDraft(d: WorkoutFormData): EditedWorkout {
  return {
    type: d.type,
    run_type: d.run_type || null,
    strength_type: d.strength_type || null,
    title: d.title.trim(),
    description: d.description || null,
    // The editor recalculates totals from the steps unrounded ("5.4913"); round like the saved forms.
    distance_miles: d.distance_miles ? Math.round(parseFloat(d.distance_miles) * 100) / 100 : null,
    distance_unit: d.distance_unit ?? "mi",
    pace_type: d.pace_type || null,
    duration_minutes: d.duration_minutes ? Math.round(parseFloat(d.duration_minutes)) : null,
    notes: d.notes || null,
    steps: formRowsToStepData(d.steps),
    bike_location: d.bike_location || null,
    cross_train_type: d.cross_train_type || null,
    continuous_timers: d.continuous_timers,
    equipment_added: d.equipment_added,
    equipment_removed: d.equipment_removed,
  };
}
