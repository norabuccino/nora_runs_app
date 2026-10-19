import { describe, it, expect } from "vitest";
import { buildSetLogForm, setLogChanges, setLogDrafts, setLogEdits, updateSetLogRow } from "@/lib/setLogForm";
import { completedAtForDate } from "@/lib/scheduledWorkout";
import type { WorkoutStep, WorkoutSessionExerciseWithSets, WorkoutSetLog } from "@/types/database";

function makeStep(overrides: Partial<WorkoutStep>): WorkoutStep {
  return {
    id: "step-id",
    plan_workout_id: "workout-id",
    workout_id: null,
    scheduled_workout_id: null,
    step_order: 0,
    step_type: "main",
    label: "Exercise",
    pace_type: null,
    duration_minutes: null,
    distance_miles: null,
    distance_unit: "mi",
    notes: null,
    repeat_group_id: null,
    repeat_count: 1,
    group_name: null,
    sets: null,
    reps: null,
    weight_suggestion: null,
    video_url: null,
    exercise_id: null,
    duration_unit: "min",
    both_sides: false,
    stroke_style: null,
    ...overrides,
  } as WorkoutStep;
}

function sessionExercise(stepId: string, loadFormat: string | null, logs: Partial<WorkoutSetLog>[] = []): WorkoutSessionExerciseWithSets {
  return {
    id: `se-${stepId}`,
    session_id: "session",
    exercise_id: `ex-${stepId}`,
    source_workout_step_id: stepId,
    load_format: loadFormat,
    workout_set_logs: logs.map((l) => ({ side: null, weight: null, reps_completed: null, duration_seconds: null, ...l }) as WorkoutSetLog),
  } as WorkoutSessionExerciseWithSets;
}

describe("buildSetLogForm", () => {
  const squat = makeStep({ id: "squat", label: "Goblet squat", exercise_id: "ex-squat", sets: 3, reps: 10, step_order: 0 });
  const plank = makeStep({ id: "plank", label: "Plank", exercise_id: "ex-plank", sets: 2, duration_minutes: 0.5, step_order: 1 });
  const unlinked = makeStep({ id: "stretch", label: "Stretch", sets: 1, step_order: 2 });

  it("makes a row per set for library-linked exercises, ticked with planned values when nothing is logged", () => {
    const form = buildSetLogForm([squat, plank, unlinked], [sessionExercise("squat", "per_hand"), sessionExercise("plank", null)]);
    expect(form.map((e) => e.name)).toEqual(["Goblet squat", "Plank"]);
    expect(form[0]).toMatchObject({ weighted: true, repsBased: true, timed: false });
    expect(form[0].rows.map((r) => [r.setNumber, r.reps, r.done])).toEqual([[1, "10", true], [2, "10", true], [3, "10", true]]);
    expect(form[1]).toMatchObject({ weighted: false, repsBased: false, timed: true });
    expect(form[1].rows.map((r) => r.seconds)).toEqual(["30", "30"]);
  });

  it("prefills from existing logs and leaves unlogged sets unticked once anything is logged", () => {
    const form = buildSetLogForm([squat], [sessionExercise("squat", "total", [{ set_number: 1, weight: 40, reps_completed: 9 }])]);
    expect(form[0].rows[0]).toMatchObject({ weight: "40", reps: "9", done: true, existing: true });
    expect(form[0].rows[1]).toMatchObject({ weight: "", reps: "10", done: false, existing: false });
  });

  it("splits both-sides exercises into left and right rows", () => {
    const lunge = makeStep({ id: "lunge", exercise_id: "ex-lunge", sets: 2, reps: 8, both_sides: true });
    const form = buildSetLogForm([lunge], [sessionExercise("lunge", null)]);
    expect(form[0].rows.map((r) => `${r.setNumber}${r.side}`)).toEqual(["1left", "1right", "2left", "2right"]);
  });

  it("numbers superset rows by round", () => {
    const a = makeStep({ id: "a", exercise_id: "ex-a", reps: 10, repeat_group_id: 1, repeat_count: 3, step_order: 0 });
    const b = makeStep({ id: "b", exercise_id: "ex-b", reps: 12, repeat_group_id: 1, repeat_count: 3, step_order: 1 });
    const form = buildSetLogForm([a, b], [sessionExercise("a", null), sessionExercise("b", null)]);
    expect(form.map((e) => e.rows.map((r) => r.setNumber))).toEqual([[1, 2, 3], [1, 2, 3]]);
  });
});

describe("updateSetLogRow", () => {
  const squat = makeStep({ id: "squat", exercise_id: "ex-squat", sets: 3, reps: 10 });

  it("carries a weight down to later sets that were blank or matched the old value", () => {
    let form = buildSetLogForm([squat], [sessionExercise("squat", "total")]);
    form = updateSetLogRow(form, 0, 0, "weight", "50");
    expect(form[0].rows.map((r) => r.weight)).toEqual(["50", "50", "50"]);
    form = updateSetLogRow(form, 0, 2, "weight", "55");
    form = updateSetLogRow(form, 0, 0, "weight", "45");
    expect(form[0].rows.map((r) => r.weight)).toEqual(["45", "45", "55"]);
  });

  it("only changes the one row for other fields", () => {
    let form = buildSetLogForm([squat], [sessionExercise("squat", "total")]);
    form = updateSetLogRow(form, 0, 1, "done", false);
    form = updateSetLogRow(form, 0, 0, "reps", "8");
    expect(form[0].rows.map((r) => [r.reps, r.done])).toEqual([["8", true], ["10", false], ["10", true]]);
  });
});

describe("setLogChanges", () => {
  it("upserts ticked rows and removes unticked rows that were logged", () => {
    const squat = makeStep({ id: "squat", exercise_id: "ex-squat", sets: 2, reps: 10 });
    let form = buildSetLogForm([squat], [sessionExercise("squat", "total", [{ set_number: 1, weight: 40, reps_completed: 10 }, { set_number: 2, weight: 40, reps_completed: 10 }])]);
    form = updateSetLogRow(form, 0, 0, "weight", "42.5");
    form = updateSetLogRow(form, 0, 1, "done", false);
    expect(setLogChanges(form)).toEqual({
      upserts: [{ sessionExerciseId: "se-squat", setNumber: 1, side: null, weight: 42.5, reps_completed: 10, duration_seconds: null }],
      removals: [{ sessionExerciseId: "se-squat", setNumber: 2, side: null }],
    });
  });

  it("drops fields the exercise doesn't track and blank values", () => {
    const plank = makeStep({ id: "plank", exercise_id: "ex-plank", sets: 1, duration_minutes: 1 });
    let form = buildSetLogForm([plank], [sessionExercise("plank", null)]);
    expect(setLogChanges(form).upserts[0]).toMatchObject({ weight: null, reps_completed: null, duration_seconds: 60 });
    form = updateSetLogRow(form, 0, 0, "seconds", "");
    expect(setLogChanges(form).upserts[0].duration_seconds).toBeNull();
  });
});

describe("completedAtForDate", () => {
  it("is midday UTC on that date", () => {
    expect(completedAtForDate("2026-03-04")).toBe("2026-03-04T12:00:00.000Z");
  });
});

describe("setLogEdits", () => {
  const sets = [
    { id: "s1", weight: 40, reps_completed: 10, duration_seconds: null },
    { id: "s2", weight: 40, reps_completed: 8, duration_seconds: null },
  ];

  it("returns nothing when no values changed", () => {
    expect(setLogEdits(sets, setLogDrafts(sets))).toEqual([]);
  });

  it("returns only changed sets, with cleared fields as null", () => {
    const drafts = setLogDrafts(sets);
    drafts.s2 = { ...drafts.s2, weight: "45" };
    drafts.s1 = { ...drafts.s1, reps: "" };
    expect(setLogEdits(sets, drafts)).toEqual([
      { id: "s1", weight: 40, reps_completed: null, duration_seconds: null },
      { id: "s2", weight: 45, reps_completed: 8, duration_seconds: null },
    ]);
  });
});
