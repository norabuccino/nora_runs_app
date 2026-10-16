import { describe, it, expect } from "vitest";
import { summarizeExerciseUsage, type ExerciseUsageStepRow } from "@/lib/exerciseUsage";

function planStep(planWorkoutId: string, title: string, planName: string): ExerciseUsageStepRow {
  return {
    plan_workout_id: planWorkoutId,
    workout_id: null,
    scheduled_workout_id: null,
    plan_workouts: { title, training_plans: { name: planName } },
    workouts: null,
    scheduled_workouts: null,
  };
}

function libraryStep(workoutId: string, title: string): ExerciseUsageStepRow {
  return {
    plan_workout_id: null,
    workout_id: workoutId,
    scheduled_workout_id: null,
    plan_workouts: null,
    workouts: { title },
    scheduled_workouts: null,
  };
}

function scheduledStep(id: string, title: string, date: string): ExerciseUsageStepRow {
  return {
    plan_workout_id: null,
    workout_id: null,
    scheduled_workout_id: id,
    plan_workouts: null,
    workouts: null,
    scheduled_workouts: { title, scheduled_date: date },
  };
}

describe("summarizeExerciseUsage", () => {
  it("returns an empty list when nothing uses the exercise", () => {
    expect(summarizeExerciseUsage([])).toEqual([]);
  });

  it("groups multiple steps in the same workout and counts them", () => {
    const result = summarizeExerciseUsage([
      planStep("pw1", "Lower Body A", "Strength Block"),
      planStep("pw1", "Lower Body A", "Strength Block"),
    ]);
    expect(result).toEqual([
      { kind: "plan", key: "plan:pw1", workoutTitle: "Lower Body A", context: "Strength Block", stepCount: 2 },
    ]);
  });

  it("labels library and scheduled workouts and orders plans first, library last", () => {
    const result = summarizeExerciseUsage([
      libraryStep("w1", "Core Circuit"),
      scheduledStep("s1", "Quick Lift", "2026-10-01"),
      planStep("pw2", "Upper Body", "Marathon Strength"),
      planStep("pw1", "Lower Body", "Base Strength"),
    ]);
    expect(result.map((r) => [r.kind, r.context, r.workoutTitle])).toEqual([
      ["plan", "Base Strength", "Lower Body"],
      ["plan", "Marathon Strength", "Upper Body"],
      ["scheduled", "2026-10-01", "Quick Lift"],
      ["library", "Workout library", "Core Circuit"],
    ]);
  });

  it("falls back to placeholder labels when the joined parent is missing", () => {
    const row = planStep("pw1", "x", "y");
    row.plan_workouts = null;
    expect(summarizeExerciseUsage([row])[0]).toMatchObject({ workoutTitle: "Untitled workout", context: "Plan" });
  });
});
