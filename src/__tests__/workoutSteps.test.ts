import { describe, it, expect } from "vitest";
import { groupSteps, formatStepDuration, stepTimedSeconds, buildSessionBeats } from "@/lib/workoutSteps";
import type { WorkoutStep } from "@/types/database";

function makeStep(overrides: Partial<WorkoutStep>): WorkoutStep {
  return {
    id: overrides.id ?? "step-id",
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
    ...overrides,
  };
}

describe("groupSteps", () => {
  it("treats steps with no repeat_group_id as standalone", () => {
    const steps = [makeStep({ id: "a" }), makeStep({ id: "b" })];
    const segments = groupSteps(steps);
    expect(segments).toEqual([
      { type: "step", step: steps[0] },
      { type: "step", step: steps[1] },
    ]);
  });

  it("groups contiguous steps sharing a repeat_group_id", () => {
    const steps = [
      makeStep({ id: "a", repeat_group_id: 1, repeat_count: 3 }),
      makeStep({ id: "b", repeat_group_id: 1, repeat_count: 3 }),
      makeStep({ id: "c" }),
    ];
    const segments = groupSteps(steps);
    expect(segments).toEqual([
      { type: "group", repeatCount: 3, steps: [steps[0], steps[1]] },
      { type: "step", step: steps[2] },
    ]);
  });
});

describe("formatStepDuration", () => {
  it("returns null when there is no duration", () => {
    expect(formatStepDuration(null, "min")).toBeNull();
  });

  it("formats minutes as-is", () => {
    expect(formatStepDuration(1, "min")).toBe("1 min");
  });

  it("converts stored minutes to seconds for display when unit is sec", () => {
    expect(formatStepDuration(0.5, "sec")).toBe("30 sec");
  });
});

describe("stepTimedSeconds", () => {
  it("returns null when the step is rep-based", () => {
    expect(stepTimedSeconds(makeStep({ reps: 10, duration_minutes: 1 }))).toBeNull();
  });

  it("returns null when there is no duration", () => {
    expect(stepTimedSeconds(makeStep({ reps: null, duration_minutes: null }))).toBeNull();
  });

  it("converts a 1-minute hold to 60 seconds", () => {
    expect(stepTimedSeconds(makeStep({ duration_minutes: 1, duration_unit: "min" }))).toBe(60);
  });

  it("converts a 30-second hold stored as 0.5 minutes to 30 seconds", () => {
    expect(stepTimedSeconds(makeStep({ duration_minutes: 0.5, duration_unit: "sec" }))).toBe(30);
  });
});

describe("buildSessionBeats", () => {
  it("expands a standalone exercise into one beat per set", () => {
    const step = makeStep({ id: "squat", sets: 3, reps: 10 });
    const beats = buildSessionBeats([step]);
    expect(beats).toHaveLength(3);
    expect(beats.map((b) => b.setNumber)).toEqual([1, 2, 3]);
    expect(beats.every((b) => b.totalSets === 3 && !b.isSuperset)).toBe(true);
  });

  it("defaults to a single beat when sets is not set", () => {
    const step = makeStep({ id: "plank", duration_minutes: 1 });
    const beats = buildSessionBeats([step]);
    expect(beats).toHaveLength(1);
    expect(beats[0].setNumber).toBe(1);
    expect(beats[0].totalSets).toBe(1);
  });

  it("loops through every exercise in a superset before repeating rounds", () => {
    const a = makeStep({ id: "a", repeat_group_id: 1, repeat_count: 2, group_name: "Superset A" });
    const b = makeStep({ id: "b", repeat_group_id: 1, repeat_count: 2, group_name: "Superset A" });
    const beats = buildSessionBeats([a, b]);
    expect(beats.map((beat) => [beat.step.id, beat.roundNumber])).toEqual([
      ["a", 1],
      ["b", 1],
      ["a", 2],
      ["b", 2],
    ]);
    expect(beats.every((beat) => beat.isSuperset && beat.totalRounds === 2 && beat.groupName === "Superset A")).toBe(
      true
    );
  });

  it("lets each exercise in a per-exercise-mode superset run its own set count, dropping out once it's done", () => {
    // "Per exercise" mode: at least one step in the group carries its own `sets`
    // value instead of relying on the group's shared repeat_count.
    const a = makeStep({ id: "a", repeat_group_id: 1, repeat_count: 1, sets: 3, group_name: "Warm Up" });
    const b = makeStep({ id: "b", repeat_group_id: 1, repeat_count: 1, sets: 4, group_name: "Warm Up" });
    const beats = buildSessionBeats([a, b]);
    expect(beats.map((beat) => [beat.step.id, beat.roundNumber, beat.totalRounds])).toEqual([
      ["a", 1, 3],
      ["b", 1, 4],
      ["a", 2, 3],
      ["b", 2, 4],
      ["a", 3, 3],
      ["b", 3, 4],
      ["b", 4, 4],
    ]);
    expect(beats.every((beat) => beat.isSuperset)).toBe(true);
  });

  it("concatenates standalone exercises and superset groups in order", () => {
    const warmup = makeStep({ id: "warmup", sets: 1 });
    const a = makeStep({ id: "a", repeat_group_id: 1, repeat_count: 2 });
    const b = makeStep({ id: "b", repeat_group_id: 1, repeat_count: 2 });
    const cooldown = makeStep({ id: "cooldown", sets: 2 });
    const beats = buildSessionBeats([warmup, a, b, cooldown]);
    expect(beats.map((beat) => beat.step.id)).toEqual(["warmup", "a", "b", "a", "b", "cooldown", "cooldown"]);
  });
});
