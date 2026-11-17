import { describe, it, expect } from "vitest";
import { draftToExisting, formDataToDraft } from "@/lib/workoutDraft";
import { applyNewWorkoutChoice } from "@/lib/planWorkoutChoice";
import { workoutFromText } from "@/lib/planTextImport";
import type { WorkoutFormData, WorkoutStepFormRow } from "@/components/WorkoutForm";

const row = (over: Partial<WorkoutStepFormRow>): WorkoutStepFormRow => ({
  step_type: "main",
  label: "",
  pace_type: "",
  duration_minutes: "",
  duration_unit: "min",
  distance_miles: "",
  distance_unit: "mi",
  notes: "",
  repeat_group_id: null,
  repeat_count: 1,
  exercise_id: "",
  group_name: "",
  sets: "",
  reps: "",
  weight_suggestion: "",
  video_url: "",
  both_sides: false,
  stroke_style: "",
  ...over,
});

const form: WorkoutFormData = {
  type: "run",
  run_type: "interval_run",
  strength_type: "",
  title: " Hill repeats ",
  description: "",
  distance_miles: "5.4913",
  distance_unit: "mi",
  pace_type: "",
  duration_minutes: "46.9361601650366",
  notes: "",
  sort_order: 0,
  steps: [
    row({ step_type: "warmup", distance_miles: "2", pace_type: "Easy" }),
    row({ step_type: "interval", distance_miles: "400", distance_unit: "m", repeat_group_id: 1, repeat_count: 8 }),
    row({ step_type: "recovery", duration_minutes: "90", duration_unit: "sec", repeat_group_id: 1, repeat_count: 8 }),
  ],
  bike_location: "",
  cross_train_type: "",
  continuous_timers: false,
  equipment_added: [],
  equipment_removed: [],
};

describe("workout drafts for the plan import editor", () => {
  it("turns what the editor saved into the workout to create", () => {
    const d = formDataToDraft(form);
    expect(d).toMatchObject({ type: "run", run_type: "interval_run", strength_type: null, title: "Hill repeats", distance_miles: 5.49, duration_minutes: 47 });
    expect(d.steps.map((s) => [s.step_type, s.distance_miles, s.duration_minutes, s.repeat_count])).toEqual([
      ["warmup", 2, null, 1],
      ["interval", 400, null, 8],
      ["recovery", null, 1.5, 8],
    ]);
  });

  it("opens a draft in the editor with its steps in order", () => {
    const existing = draftToExisting(formDataToDraft(form));
    expect(existing.title).toBe("Hill repeats");
    expect(existing.workout_steps.map((s) => [s.step_order, s.step_type])).toEqual([
      [0, "warmup"],
      [1, "interval"],
      [2, "recovery"],
    ]);
    expect(draftToExisting(workoutFromText("Easy 5 miles")).workout_steps).toEqual([]);
  });

  it("an edited workout replaces the parsed one (a later rename still applies)", () => {
    const edited = formDataToDraft(form);
    const guess = workoutFromText("8x400m uphill");
    expect(applyNewWorkoutChoice(guess, { kind: "new", edited }, false).newWorkout).toBe(edited);
    expect(applyNewWorkoutChoice(guess, { kind: "new", edited, title: "Hills" }, false).newWorkout).toMatchObject({ title: "Hills", steps: edited.steps });
  });
});
