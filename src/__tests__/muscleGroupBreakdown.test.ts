import { describe, it, expect } from "vitest";
import {
  plannedSetsByExercise,
  loggedSetCount,
  mergeCompletedWork,
  summarizeMuscleGroups,
  type CompletedWorkout,
  type Performance,
} from "@/lib/muscleGroupBreakdown";
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
    stroke_style: null,
    ...overrides,
  };
}

describe("plannedSetsByExercise", () => {
  it("counts a standalone step's sets", () => {
    expect(plannedSetsByExercise([makeStep({ id: "a", exercise_id: "squat", sets: 3 })])).toEqual([
      { exerciseId: "squat", sets: 3 },
    ]);
  });

  it("counts superset rounds for each exercise in the group", () => {
    const steps = [
      makeStep({ id: "a", exercise_id: "squat", repeat_group_id: 1, repeat_count: 3 }),
      makeStep({ id: "b", exercise_id: "row", repeat_group_id: 1, repeat_count: 3 }),
    ];
    expect(plannedSetsByExercise(steps)).toEqual([
      { exerciseId: "squat", sets: 3 },
      { exerciseId: "row", sets: 3 },
    ]);
  });

  it("counts a both-sides set once, not once per side", () => {
    expect(plannedSetsByExercise([makeStep({ exercise_id: "lunge", sets: 2, both_sides: true })])).toEqual([
      { exerciseId: "lunge", sets: 2 },
    ]);
  });

  it("ignores steps without a library exercise", () => {
    expect(plannedSetsByExercise([makeStep({ sets: 3 })])).toEqual([]);
  });
});

describe("loggedSetCount", () => {
  it("counts distinct set numbers (left and right of one set count once)", () => {
    expect(loggedSetCount([1, 1, 2, 2, 3], { plannedSets: 4, repeatCount: null })).toBe(3);
  });

  it("falls back to planned sets, then repeat count, then 1 when nothing was logged", () => {
    expect(loggedSetCount([], { plannedSets: 4, repeatCount: 2 })).toBe(4);
    expect(loggedSetCount([], { plannedSets: null, repeatCount: 2 })).toBe(2);
    expect(loggedSetCount([], { plannedSets: null, repeatCount: null })).toBe(1);
  });
});

describe("mergeCompletedWork", () => {
  const session: CompletedWorkout = {
    date: "2026-10-10",
    planWorkoutId: "pw1",
    scheduledWorkoutId: null,
    exercises: [{ exerciseId: "squat", sets: 3 }],
  };

  it("keeps a logged session and skips the same plan workout marked complete within a week", () => {
    const marked: CompletedWorkout = { ...session, date: "2026-10-08", exercises: [{ exerciseId: "squat", sets: 4 }] };
    expect(mergeCompletedWork([session], [marked])).toEqual([
      { exerciseId: "squat", sets: 3, date: "2026-10-10", logged: true },
    ]);
  });

  it("counts the same plan workout again when the completions are far apart (plan repeated)", () => {
    const marked: CompletedWorkout = { ...session, date: "2026-08-01" };
    expect(mergeCompletedWork([session], [marked])).toHaveLength(2);
  });

  it("matches scheduled workouts by id regardless of date", () => {
    const s: CompletedWorkout = { date: "2026-10-10", planWorkoutId: null, scheduledWorkoutId: "sw1", exercises: [{ exerciseId: "row", sets: 2 }] };
    const marked: CompletedWorkout = { ...s, date: "2026-09-01" };
    expect(mergeCompletedWork([s], [marked])).toHaveLength(1);
  });

  it("includes marked-complete workouts with no logged session", () => {
    const marked: CompletedWorkout = { date: "2026-10-01", planWorkoutId: "pw2", scheduledWorkoutId: null, exercises: [{ exerciseId: "row", sets: 2 }] };
    expect(mergeCompletedWork([session], [marked])).toContainEqual({ exerciseId: "row", sets: 2, date: "2026-10-01", logged: false });
  });
});

describe("summarizeMuscleGroups", () => {
  const groups = new Map<string, string[]>([
    ["squat", ["hips_glutes", "thighs"]],
    ["row", ["back_spine", "arms"]],
    ["plank", ["abdomen"]],
    ["mystery", []],
  ]);
  const perf = (exerciseId: string, sets: number, date: string): Performance => ({ exerciseId, sets, date, logged: true });

  it("credits an exercise's sets to each of its groups and computes shares and regions", () => {
    const s = summarizeMuscleGroups([perf("squat", 3, "2026-10-01"), perf("row", 2, "2026-10-02")], groups);
    const byGroup = Object.fromEntries(s.rows.map((r) => [r.group, r]));
    expect(byGroup.thighs.sets).toBe(3);
    expect(byGroup.hips_glutes.sets).toBe(3);
    expect(byGroup.arms.sets).toBe(2);
    expect(byGroup.chest.sets).toBe(0);
    expect(byGroup.thighs.share).toBeCloseTo(3 / 10);
    expect(s.regions.lower).toBeCloseTo(6 / 10);
    expect(s.regions.upper).toBeCloseTo(4 / 10);
    expect(s.regions.core).toBe(0);
    expect(s.totalSets).toBe(5);
    expect(s.workoutDays).toBe(2);
  });

  it("returns all nine groups in head-to-toe order", () => {
    const s = summarizeMuscleGroups([], groups);
    expect(s.rows.map((r) => r.group)).toEqual([
      "chest", "shoulders", "back_spine", "abdomen", "arms", "hips_glutes", "thighs", "lower_legs", "feet",
    ]);
    expect(s.rows.every((r) => r.share === 0)).toBe(true);
  });

  it("tracks the most recent date and the number of performances per group", () => {
    const s = summarizeMuscleGroups([perf("plank", 2, "2026-10-01"), perf("plank", 3, "2026-10-05")], groups);
    const abdomen = s.rows.find((r) => r.group === "abdomen")!;
    expect(abdomen).toMatchObject({ sets: 5, exercises: 2, lastDate: "2026-10-05" });
  });

  it("filters out work before the since date", () => {
    const s = summarizeMuscleGroups([perf("plank", 2, "2026-09-01"), perf("plank", 3, "2026-10-05")], groups, "2026-10-01");
    expect(s.totalSets).toBe(3);
  });

  it("reports sets from untagged or unknown exercises separately", () => {
    const s = summarizeMuscleGroups([perf("mystery", 4, "2026-10-01"), perf("unknown", 1, "2026-10-01")], groups);
    expect(s.untaggedSets).toBe(5);
    expect(s.totalSets).toBe(0);
  });
});
