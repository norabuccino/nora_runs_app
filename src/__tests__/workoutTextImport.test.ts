import { describe, it, expect } from "vitest";
import {
  parseExerciseLine,
  parseWorkoutText,
  flattenExercises,
  describeParsedExercise,
  toFormSteps,
} from "@/lib/workoutTextImport";

const pick = (line: string) => {
  const ex = parseExerciseLine(line)!;
  return {
    name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    repsMax: ex.repsMax,
    sec: ex.durationSeconds,
    sides: ex.bothSides,
    weight: ex.weight,
    notes: ex.notes,
  };
};

describe("parseExerciseLine", () => {
  it("reads the sets/reps-range example", () => {
    expect(pick("push ups - 3 sets, 8-10 reps")).toMatchObject({ name: "push ups", sets: 3, reps: 8, repsMax: 10 });
  });

  it("reads NxM shorthand with or without a separator", () => {
    expect(pick("Goblet Squat 3x10")).toMatchObject({ name: "Goblet Squat", sets: 3, reps: 10 });
    expect(pick("Rows: 4 × 6-8")).toMatchObject({ name: "Rows", sets: 4, reps: 6, repsMax: 8 });
    expect(pick("Hip 90-90 3x5")).toMatchObject({ name: "Hip 90-90", sets: 3, reps: 5 });
  });

  it("reads durations", () => {
    expect(pick("Plank - 3x30s")).toMatchObject({ name: "Plank", sets: 3, sec: 30, reps: null });
    expect(pick("Wall sit 2 sets 1 min")).toMatchObject({ name: "Wall sit", sets: 2, sec: 60 });
    expect(pick("Side plank, 1:30")).toMatchObject({ sec: 90 });
  });

  it("reads sides, load and leftover notes", () => {
    expect(pick("Split squat - 3x8 each leg @ 20 lb (slow down)")).toMatchObject({
      name: "Split squat",
      sides: true,
      weight: "20 lb",
      notes: "slow down",
    });
    expect(pick("Pull ups, 3 sets, AMRAP, BW")).toMatchObject({ name: "Pull ups", sets: 3, weight: "Bodyweight", notes: "AMRAP" });
    expect(pick("Curls x12 heavy")).toMatchObject({ name: "Curls", reps: 12, weight: "heavy" });
  });

  it("reads a bare number as reps and strips list prefixes", () => {
    expect(pick("1. Push ups, 10")).toMatchObject({ name: "Push ups", reps: 10 });
    expect(pick("- Dead bugs")).toMatchObject({ name: "Dead bugs", sets: null, reps: null });
  });

  it("turns rest lines into rest steps", () => {
    const ex = parseExerciseLine("Rest 90s between rounds")!;
    expect([ex.isRest, ex.name, ex.durationSeconds, ex.notes]).toEqual([true, "Rest", 90, "between rounds"]);
  });

  it("returns null when there's no name", () => {
    expect(parseExerciseLine("3x10")).toBeNull();
  });
});

describe("parseWorkoutText", () => {
  it("splits on semicolons and newlines into standalone exercises", () => {
    const { blocks, unparsed } = parseWorkoutText("push ups - 3 sets, 8-10 reps; pull ups - 3 sets, 8-10 reps\nplank 3x30s");
    expect(blocks.map((b) => b.kind)).toEqual(["single", "single", "single"]);
    expect(flattenExercises(blocks).map((e) => e.name)).toEqual(["push ups", "pull ups", "plank"]);
    expect(unparsed).toEqual([]);
  });

  it("groups a superset header's lines, taking rounds from the header", () => {
    const { blocks } = parseWorkoutText("Superset A (3 rounds):\nPush ups x10\nRows x10\n\nPlank 30s");
    expect(blocks[0]).toMatchObject({ kind: "superset", name: "Superset A", rounds: 3 });
    expect(blocks[0].kind === "superset" && blocks[0].exercises.map((e) => [e.name, e.sets, e.reps])).toEqual([
      ["Push ups", null, 10],
      ["Rows", null, 10],
    ]);
    expect(blocks[1].kind).toBe("single");
  });

  it("accepts exercises after a superset header's colon", () => {
    const { blocks } = parseWorkoutText("Circuit x3: squats x15; lunges x10 each leg");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: "superset", rounds: 3 });
  });

  it("groups A1/A2 prefixes into supersets, rounds from the first exercise's sets", () => {
    const { blocks } = parseWorkoutText("A1. Bench 3x8\nA2. Row 3x8\nB1. Curl 2x12\nB2. Dips 2x10\nC1. Plank 3x30s");
    expect(blocks.map((b) => b.kind)).toEqual(["superset", "superset", "single"]);
    expect(blocks[0]).toMatchObject({ rounds: 3 });
    expect(blocks[1]).toMatchObject({ rounds: 2 });
  });

  it("treats other headers as named groups where exercises keep their sets", () => {
    const { blocks } = parseWorkoutText("Warm up:\nLeg swings 1x10 each side\nBand walks 2x15");
    expect(blocks[0]).toMatchObject({ kind: "group", name: "Warm up" });
    expect(blocks[0].kind === "group" && blocks[0].exercises.map((e) => e.sets)).toEqual([1, 2]);
  });

  it("reports lines it couldn't read", () => {
    expect(parseWorkoutText("Push ups 3x10\n3x10").unparsed).toEqual(["3x10"]);
  });
});

describe("describeParsedExercise", () => {
  it("summarizes what was understood", () => {
    expect(describeParsedExercise(parseExerciseLine("Split squat - 3x8-10 each leg @ 20 lb")!)).toBe(
      "3 × 8–10 reps · each side · 20 lb"
    );
    expect(describeParsedExercise(parseExerciseLine("Plank 3x45s")!, true)).toBe("45 sec");
  });
});

describe("toFormSteps", () => {
  it("builds standalone, superset and named-group rows with sequential group ids", () => {
    const { blocks } = parseWorkoutText(
      "Push ups - 3 sets, 8-10 reps\nSuperset (2 rounds):\nPlank 1 min\nRows x10\n\nWarm up:\nLeg swings 1x10"
    );
    const res = flattenExercises(blocks).map((e, i) => ({ exercise_id: `ex${i}`, label: `Lib ${e.name}`, video_url: "" }));
    const { steps, namedGroupIds } = toFormSteps(blocks, res, { startGroupId: 5, unit: "mi" });

    expect(steps[0]).toMatchObject({ label: "Lib Push ups", exercise_id: "ex0", sets: "3", reps: "8", notes: "8–10 reps", repeat_group_id: null });
    expect(steps[1]).toMatchObject({ repeat_group_id: 5, repeat_count: 2, sets: "", duration_minutes: "1", duration_unit: "min", group_name: "Superset" });
    expect(steps[2]).toMatchObject({ repeat_group_id: 5, reps: "10" });
    expect(steps[3]).toMatchObject({ repeat_group_id: 6, group_name: "Warm up", sets: "1", reps: "10" });
    expect(namedGroupIds).toEqual([6]);
  });

  it("keeps rest steps as unlinked 'Rest' rows with second durations", () => {
    const { blocks } = parseWorkoutText("Rest 45s");
    const { steps } = toFormSteps(blocks, [{ exercise_id: "x", label: "Whatever", video_url: "v" }], { startGroupId: 1, unit: "mi" });
    expect(steps[0]).toMatchObject({ label: "Rest", exercise_id: "", video_url: "", duration_minutes: "45", duration_unit: "sec" });
  });
});
