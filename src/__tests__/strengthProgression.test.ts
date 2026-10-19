import { describe, it, expect } from "vitest";
import {
  formatLoad,
  deriveCurrentLoad,
  computeTrend,
  computeRecommendation,
  sortSetLogs,
  formatActualSets,
  loadInputLabel,
} from "@/lib/strengthProgression";
import type { WorkoutSetLog } from "@/types/database";

function makeSet(overrides: Partial<WorkoutSetLog>): WorkoutSetLog {
  return {
    id: overrides.id ?? "set-id",
    session_exercise_id: "session-exercise-id",
    set_number: 1,
    side: null,
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

describe("assisted load format", () => {
  it("formats the assistance", () => {
    expect(formatLoad(40, "assisted")).toBe("40 lb assist");
  });

  it("treats less assistance as progress", () => {
    expect(computeTrend(30, 40, "assisted")).toBe("up");
    expect(computeTrend(50, 40, "assisted")).toBe("down");
    expect(computeTrend(40, 40, "assisted")).toBe("same");
    expect(computeTrend(50, 40, "machine")).toBe("up");
  });

  it("suggests reducing assistance after hitting the target, never below zero", () => {
    const sets = [
      { completed: true, reps_completed: 8 },
      { completed: true, reps_completed: 8 },
    ] as Parameters<typeof computeRecommendation>[0]["sets"];
    const base = { plannedReps: 8, plannedDurationSeconds: null, sets, previousWeight: null, defaultIncrement: 5, loadFormat: "assisted" };
    expect(computeRecommendation({ ...base, currentWeight: 40 })).toEqual({ status: "increase", suggestedWeight: 35 });
    expect(computeRecommendation({ ...base, currentWeight: 3 })).toEqual({ status: "increase", suggestedWeight: 0 });
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

describe("sortSetLogs", () => {
  it("orders by set number, left side before right", () => {
    const sets = [
      makeSet({ id: "2r", set_number: 2, side: "right" }),
      makeSet({ id: "1r", set_number: 1, side: "right" }),
      makeSet({ id: "2l", set_number: 2, side: "left" }),
      makeSet({ id: "1l", set_number: 1, side: "left" }),
    ];
    expect(sortSetLogs(sets).map((s) => s.id)).toEqual(["1l", "1r", "2l", "2r"]);
  });
});

describe("formatActualSets", () => {
  it("joins single-sided sets", () => {
    expect(
      formatActualSets([
        makeSet({ set_number: 2, reps_completed: 8 }),
        makeSet({ set_number: 1, reps_completed: 10 }),
        makeSet({ set_number: 3, duration_seconds: 30 }),
      ])
    ).toBe("10 / 8 / 30s");
  });

  it("pairs both-sides sets with L/R markers", () => {
    expect(
      formatActualSets([
        makeSet({ set_number: 1, side: "right", reps_completed: 10 }),
        makeSet({ set_number: 1, side: "left", reps_completed: 10 }),
        makeSet({ set_number: 2, side: "left", reps_completed: 10 }),
        makeSet({ set_number: 2, side: "right", reps_completed: 9 }),
      ])
    ).toBe("10L 10R / 10L 9R");
  });

  it("returns null when nothing was recorded", () => {
    expect(formatActualSets([makeSet({})])).toBeNull();
  });
});

describe("band levels", () => {
  it("formats band levels by name", () => {
    expect(formatLoad(1, "band")).toBe("Extra light band");
    expect(formatLoad(3, "band")).toBe("Medium band");
    expect(formatLoad(7, "band")).toBe("Band level 7");
  });

  it("labels the load field by format", () => {
    expect(loadInputLabel("band")).toBe("Band");
    expect(loadInputLabel("assisted")).toBe("Assist (lb)");
    expect(loadInputLabel("per_hand")).toBe("Weight (lb)");
    expect(loadInputLabel(null)).toBe("Weight (lb)");
  });

  it("suggests the next band up, ignoring the increment, and nothing past the heaviest", () => {
    const sets = [{ set_number: 1, side: null, weight: 3, reps_completed: 12, duration_seconds: null, completed: true }] as WorkoutSetLog[];
    const base = { plannedReps: 12, plannedDurationSeconds: null, sets, previousWeight: null, loadFormat: "band" };
    expect(computeRecommendation({ ...base, currentWeight: 3, defaultIncrement: 5 })).toEqual({ status: "increase", suggestedWeight: 4 });
    expect(computeRecommendation({ ...base, currentWeight: 5, defaultIncrement: null })).toEqual({ status: "increase", suggestedWeight: undefined });
  });
});
