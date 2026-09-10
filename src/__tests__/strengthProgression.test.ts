import { describe, it, expect } from "vitest";
import {
  formatLoad,
  deriveCurrentLoad,
  computeTrend,
  computeRecommendation,
} from "@/lib/strengthProgression";
import type { WorkoutSetLog } from "@/types/database";

function makeSet(overrides: Partial<WorkoutSetLog>): WorkoutSetLog {
  return {
    id: overrides.id ?? "set-id",
    session_exercise_id: "session-exercise-id",
    set_number: 1,
    weight: null,
    reps_completed: null,
    duration_seconds: null,
    rpe: null,
    completed: true,
    created_at: "2026-09-10T00:00:00Z",
    ...overrides,
  };
}

describe("formatLoad", () => {
  it("returns null when there is no weight and the format isn't bodyweight", () => {
    expect(formatLoad(null, "total")).toBeNull();
  });

  it("formats per_hand loads unambiguously", () => {
    expect(formatLoad(15, "per_hand")).toBe("15 lb/hand");
  });

  it("formats per_side loads unambiguously", () => {
    expect(formatLoad(15, "per_side")).toBe("15 lb/side");
  });

  it("shows Bodyweight regardless of weight for the bodyweight format", () => {
    expect(formatLoad(null, "bodyweight")).toBe("Bodyweight");
    expect(formatLoad(0, "bodyweight")).toBe("Bodyweight");
  });

  it("adds added weight for bodyweight_plus", () => {
    expect(formatLoad(10, "bodyweight_plus")).toBe("Bodyweight + 10 lb");
  });

  it("defaults to plain lb for total/single_db_kb/other/unset", () => {
    expect(formatLoad(30, "total")).toBe("30 lb");
    expect(formatLoad(30, "single_db_kb")).toBe("30 lb");
    expect(formatLoad(30, null)).toBe("30 lb");
  });
});

describe("deriveCurrentLoad", () => {
  it("returns null when there are no sets", () => {
    expect(deriveCurrentLoad([])).toBeNull();
  });

  it("returns null when passed nothing", () => {
    expect(deriveCurrentLoad(null)).toBeNull();
  });

  it("uses the weight of the last set by set_number, not insertion order", () => {
    const sets = [
      makeSet({ set_number: 2, weight: 17.5 }),
      makeSet({ set_number: 1, weight: 15 }),
      makeSet({ set_number: 3, weight: 20 }),
    ];
    expect(deriveCurrentLoad(sets)).toBe(20);
  });

  it("ignores sets marked incomplete", () => {
    const sets = [
      makeSet({ set_number: 1, weight: 15 }),
      makeSet({ set_number: 2, weight: 17.5, completed: false }),
    ];
    expect(deriveCurrentLoad(sets)).toBe(15);
  });
});

describe("computeTrend", () => {
  it("returns null when either value is missing", () => {
    expect(computeTrend(null, 15)).toBeNull();
    expect(computeTrend(15, null)).toBeNull();
  });

  it("detects an increase", () => {
    expect(computeTrend(17.5, 15)).toBe("up");
  });

  it("detects a decrease", () => {
    expect(computeTrend(12.5, 15)).toBe("down");
  });

  it("detects no change", () => {
    expect(computeTrend(15, 15)).toBe("same");
  });
});

describe("computeRecommendation", () => {
  it("returns none when there are no completed sets", () => {
    expect(
      computeRecommendation({
        plannedReps: 10,
        plannedDurationSeconds: null,
        sets: [],
        currentWeight: 15,
        previousWeight: 15,
        defaultIncrement: 2.5,
      }).status
    ).toBe("none");
  });

  it("returns none when there is no current weight to reason about", () => {
    expect(
      computeRecommendation({
        plannedReps: 10,
        plannedDurationSeconds: null,
        sets: [makeSet({ reps_completed: 10 })],
        currentWeight: null,
        previousWeight: null,
        defaultIncrement: null,
      }).status
    ).toBe("none");
  });

  it("suggests increase with the default increment once every set hits the target reps", () => {
    const result = computeRecommendation({
      plannedReps: 10,
      plannedDurationSeconds: null,
      sets: [
        makeSet({ set_number: 1, reps_completed: 10 }),
        makeSet({ set_number: 2, reps_completed: 10 }),
        makeSet({ set_number: 3, reps_completed: 10 }),
      ],
      currentWeight: 15,
      previousWeight: 15,
      defaultIncrement: 2.5,
    });
    expect(result.status).toBe("increase");
    expect(result.suggestedWeight).toBe(17.5);
  });

  it("suggests increase with no specific number when there is no default increment", () => {
    const result = computeRecommendation({
      plannedReps: 10,
      plannedDurationSeconds: null,
      sets: [makeSet({ reps_completed: 10 })],
      currentWeight: 15,
      previousWeight: 15,
      defaultIncrement: null,
    });
    expect(result.status).toBe("increase");
    expect(result.suggestedWeight).toBeUndefined();
  });

  it("suggests building reps when short of target at the same weight as last time", () => {
    const result = computeRecommendation({
      plannedReps: 10,
      plannedDurationSeconds: null,
      sets: [
        makeSet({ set_number: 1, reps_completed: 10 }),
        makeSet({ set_number: 2, reps_completed: 9 }),
      ],
      currentWeight: 15,
      previousWeight: 15,
      defaultIncrement: 2.5,
    });
    expect(result.status).toBe("build_reps");
  });

  it("suggests holding when short of target but weight already changed from last time", () => {
    const result = computeRecommendation({
      plannedReps: 10,
      plannedDurationSeconds: null,
      sets: [makeSet({ reps_completed: 9 })],
      currentWeight: 17.5,
      previousWeight: 15,
      defaultIncrement: 2.5,
    });
    expect(result.status).toBe("hold");
  });

  it("falls back to duration when there is no planned rep count", () => {
    const result = computeRecommendation({
      plannedReps: null,
      plannedDurationSeconds: 30,
      sets: [makeSet({ duration_seconds: 30 })],
      currentWeight: 10,
      previousWeight: 10,
      defaultIncrement: 5,
    });
    expect(result.status).toBe("increase");
  });

  it("returns none when there is nothing planned to compare against", () => {
    const result = computeRecommendation({
      plannedReps: null,
      plannedDurationSeconds: null,
      sets: [makeSet({ reps_completed: 10 })],
      currentWeight: 15,
      previousWeight: 15,
      defaultIncrement: 2.5,
    });
    expect(result.status).toBe("none");
  });
});
