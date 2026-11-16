import { describe, it, expect } from "vitest";
import { buildSessionBeats } from "@/lib/workoutSteps";
import {
  initialQueue,
  skipCurrentSet,
  skipCurrentExercise,
  moveCurrentExerciseToEnd,
  canMoveCurrentExerciseToEnd,
  remainingCounts,
  restoreSkipped,
  jumpToBeat,
  isValidQueue,
} from "@/lib/sessionQueue";
import type { WorkoutStep } from "@/types/database";

function makeStep(overrides: Partial<WorkoutStep>): WorkoutStep {
  return {
    id: "id",
    plan_workout_id: "w",
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

const squat = makeStep({ id: "squat", sets: 3 });
const lunge = makeStep({ id: "lunge", sets: 2, both_sides: true });
const plank = makeStep({ id: "plank", sets: 1 });
// squat1 squat2 squat3 | lunge1L lunge1R lunge2L lunge2R | plank1
const beats = buildSessionBeats([squat, lunge, plank]);

describe("skipCurrentSet", () => {
  it("drops just the current set and stays on the same position", () => {
    const q = skipCurrentSet(beats, { ...initialQueue(beats.length), position: 2 });
    expect(q.order).toEqual([0, 1, 3, 4, 5, 6, 7]);
    expect(q.position).toBe(2);
    expect(q.skipped).toEqual([2]);
  });

  it("drops both sides of a both-sides set", () => {
    const q = skipCurrentSet(beats, { ...initialQueue(beats.length), position: 5 });
    expect(q.order).toEqual([0, 1, 2, 3, 4, 7]);
    expect(q.skipped).toEqual([5, 6]);
  });

  it("from the right side, drops only the right side left", () => {
    const q = skipCurrentSet(beats, { ...initialQueue(beats.length), position: 4 });
    expect(q.skipped).toEqual([4]);
  });

  it("leaves the position past the end when the last beat is skipped", () => {
    const q = skipCurrentSet(beats, { ...initialQueue(beats.length), position: 7 });
    expect(q.position).toBe(q.order.length);
  });
});

describe("skipCurrentExercise", () => {
  it("drops every remaining set of the exercise but keeps done ones", () => {
    const q = skipCurrentExercise(beats, { ...initialQueue(beats.length), position: 1 });
    expect(q.order).toEqual([0, 3, 4, 5, 6, 7]);
    expect(q.skipped).toEqual([1, 2]);
    expect(beats[q.order[q.position]].step).toBe(lunge);
  });
});

describe("moveCurrentExerciseToEnd", () => {
  it("moves the remaining sets after everything else, in order", () => {
    const q = moveCurrentExerciseToEnd(beats, { ...initialQueue(beats.length), position: 1 });
    expect(q.order).toEqual([0, 3, 4, 5, 6, 7, 1, 2]);
    expect(q.position).toBe(1);
    expect(q.skipped).toEqual([]);
  });

  it("is a no-op when nothing else is left", () => {
    const start = { ...initialQueue(beats.length), position: 7 };
    expect(canMoveCurrentExerciseToEnd(beats, start)).toBe(false);
    expect(moveCurrentExerciseToEnd(beats, start)).toBe(start);
  });

  it("moves one exercise of a superset out of its rounds", () => {
    const a = makeStep({ id: "a", repeat_group_id: 1, repeat_count: 2 });
    const b = makeStep({ id: "b", repeat_group_id: 1, repeat_count: 2 });
    const ss = buildSessionBeats([a, b]); // a1 b1 a2 b2
    const q = moveCurrentExerciseToEnd(ss, { ...initialQueue(ss.length), position: 1 });
    expect(q.order.map((i) => `${ss[i].step.id}${ss[i].roundNumber}`)).toEqual(["a1", "a2", "b1", "b2"]);
  });
});

describe("remainingCounts", () => {
  it("counts beats left in the set and the exercise, and sets left", () => {
    expect(remainingCounts(beats, { ...initialQueue(beats.length), position: 3 })).toEqual({ set: 2, step: 4, stepSets: 2 });
    expect(remainingCounts(beats, { ...initialQueue(beats.length), position: 2 })).toEqual({ set: 1, step: 1, stepSets: 1 });
  });
});

describe("restoreSkipped", () => {
  it("brings skipped beats back as the current beat, in original order", () => {
    const skipped = skipCurrentExercise(beats, { ...initialQueue(beats.length), position: 1 }); // skip squat 2-3
    const advanced = { ...skipped, position: 3 };
    const q = restoreSkipped(beats, advanced, squat);
    expect(q.order).toEqual([0, 3, 4, 1, 2, 5, 6, 7]);
    expect(q.position).toBe(3);
    expect(q.skipped).toEqual([]);
  });
});

describe("jumpToBeat", () => {
  it("moves to the beat's position, ignoring skipped beats", () => {
    const q = { order: [0, 3, 1], position: 0, skipped: [2] };
    expect(jumpToBeat(q, 1).position).toBe(2);
    expect(jumpToBeat(q, 2)).toBe(q);
  });
});

describe("isValidQueue", () => {
  it("accepts a queue covering every beat exactly once", () => {
    expect(isValidQueue({ order: [2, 0], position: 2, skipped: [1] }, 3)).toBe(true);
  });
  it("rejects missing, duplicated or out-of-range beats", () => {
    expect(isValidQueue({ order: [0, 1], position: 0, skipped: [] }, 3)).toBe(false);
    expect(isValidQueue({ order: [0, 0, 1], position: 0, skipped: [] }, 3)).toBe(false);
    expect(isValidQueue({ order: [0, 1, 5], position: 0, skipped: [] }, 3)).toBe(false);
    expect(isValidQueue({ order: [0, 1, 2], position: 4, skipped: [] }, 3)).toBe(false);
    expect(isValidQueue(null, 3)).toBe(false);
  });
});
