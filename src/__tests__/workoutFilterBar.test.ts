import { describe, it, expect } from "vitest";
import { applyWorkoutFilter, DEFAULT_FILTER, NO_SOURCE_SENTINEL, type WorkoutFilter } from "@/components/WorkoutFilterBar";

interface FakeWorkout {
  id: string;
  type: string;
  run_type?: string | null;
  strength_type?: string | null;
  cross_train_type?: string | null;
  source?: string | null;
}

function w(overrides: Partial<FakeWorkout>): FakeWorkout {
  return { id: "1", type: "run", ...overrides };
}

function filter(overrides: Partial<WorkoutFilter>): WorkoutFilter {
  return { ...DEFAULT_FILTER, ...overrides };
}

describe("applyWorkoutFilter", () => {
  it("returns everything unfiltered", () => {
    const items = [w({ id: "1", type: "run" }), w({ id: "2", type: "swim" })];
    expect(applyWorkoutFilter(items, DEFAULT_FILTER)).toHaveLength(2);
  });

  it("filters by top-level type", () => {
    const items = [w({ id: "1", type: "run" }), w({ id: "2", type: "swim" })];
    const result = applyWorkoutFilter(items, filter({ type: "swim" }));
    expect(result.map((x) => x.id)).toEqual(["2"]);
  });

  it("filters by run_type only when the top-level type is run", () => {
    const items = [
      w({ id: "1", type: "run", run_type: "easy_run" }),
      w({ id: "2", type: "run", run_type: "long_run" }),
      w({ id: "3", type: "swim", run_type: "easy_run" }),
    ];
    // run_type sub-filter should be ignored unless type === "run"
    const ignored = applyWorkoutFilter(items, filter({ type: "swim", runType: "easy_run" }));
    expect(ignored.map((x) => x.id)).toEqual(["3"]);

    const applied = applyWorkoutFilter(items, filter({ type: "run", runType: "easy_run" }));
    expect(applied.map((x) => x.id)).toEqual(["1"]);
  });

  it("filters by strength_type only when the top-level type is strength", () => {
    const items = [
      w({ id: "1", type: "strength", strength_type: "upper_body" }),
      w({ id: "2", type: "strength", strength_type: "lower_body" }),
    ];
    const result = applyWorkoutFilter(items, filter({ type: "strength", strengthType: "upper_body" }));
    expect(result.map((x) => x.id)).toEqual(["1"]);
  });

  it("filters by cross_train_type only when the top-level type is cross_train", () => {
    const items = [
      w({ id: "1", type: "cross_train", cross_train_type: "yoga" }),
      w({ id: "2", type: "cross_train", cross_train_type: "walk" }),
      w({ id: "3", type: "run", cross_train_type: "yoga" }),
    ];
    const ignored = applyWorkoutFilter(items, filter({ type: "run", crossTrainType: "yoga" }));
    expect(ignored.map((x) => x.id)).toEqual(["3"]);

    const applied = applyWorkoutFilter(items, filter({ type: "cross_train", crossTrainType: "yoga" }));
    expect(applied.map((x) => x.id)).toEqual(["1"]);
  });

  it("filters to a specific source", () => {
    const items = [w({ id: "1", source: "Jack Daniels" }), w({ id: "2", source: "Coach Sarah" })];
    const result = applyWorkoutFilter(items, filter({ source: "Jack Daniels" }));
    expect(result.map((x) => x.id)).toEqual(["1"]);
  });

  it("filters to unsourced workouts via NO_SOURCE_SENTINEL", () => {
    const items = [w({ id: "1", source: "Jack Daniels" }), w({ id: "2", source: null })];
    const result = applyWorkoutFilter(items, filter({ source: NO_SOURCE_SENTINEL }));
    expect(result.map((x) => x.id)).toEqual(["2"]);
  });
});
