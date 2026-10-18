import { describe, it, expect } from "vitest";
import { splitBulkWorkouts, detectWorkoutType, parseWorkoutBlock, buildWorkoutPayload, runTotals } from "@/lib/workoutTextBlock";
import { flattenExercises } from "@/lib/workoutTextImport";

const paces = [
  { name: "Easy", pace_seconds_per_mile: 540 },
  { name: "Recovery", pace_seconds_per_mile: 600 },
  { name: "3K", pace_seconds_per_mile: 415 },
];
const paceNames = paces.map((p) => p.name);

describe("splitBulkWorkouts", () => {
  it("splits on separator lines", () => {
    expect(splitBulkWorkouts("A\nx\n---\nB\n\n===\nC")).toEqual(["A\nx", "B", "C"]);
  });
});

describe("detectWorkoutType", () => {
  it("uses a Type: line, then the style of the steps, then keywords", () => {
    expect(detectWorkoutType("Leg day\nType: strength\nSquats 3x8")).toBe("strength");
    expect(detectWorkoutType("Upper body pull\npull ups 3x8\nrows 3x10")).toBe("strength");
    expect(detectWorkoutType("Track 200s\nwarm up 2 miles, 8x200m at 3K pace")).toBe("run");
    expect(detectWorkoutType("Pool day\n4x100 free on 1:45")).toBe("swim");
    expect(detectWorkoutType("Zwift ride 45 min")).toBe("bike");
    expect(detectWorkoutType("Yoga flow")).toBe("cross_train");
  });
});

describe("parseWorkoutBlock + buildWorkoutPayload", () => {
  it("builds a run with steps, totals and inferred run type", () => {
    const block = parseWorkoutBlock("Track 200s\n\nFast turnover.\n\nWarm up 2 miles, then 8x200m at 3K pace with 200m recovery. Cool down 2 miles", { paceNames });
    const payload = buildWorkoutPayload(block, [], { paces });
    expect(payload).toMatchObject({ type: "run", run_type: "interval_run", title: "Track 200s", description: "Fast turnover." });
    expect(payload.steps.map((s) => s.step_type)).toEqual(["warmup", "interval", "recovery", "cooldown"]);
    expect(payload.distance_miles).toBeCloseTo(4 + (8 * 400) / 1609.344, 1);
  });

  it("builds a strength workout from resolved exercises", () => {
    const block = parseWorkoutBlock("Upper body pull\nNotes: slow lowering\npull ups 3x8\nrows 3x10", { paceNames });
    const res = flattenExercises(block.strength!.blocks).map((e, i) => ({ exercise_id: `e${i}`, label: e.name, video_url: "" }));
    const payload = buildWorkoutPayload(block, res, { paces });
    expect(payload).toMatchObject({ type: "strength", strength_type: "upper_body", title: "Upper body pull", notes: "slow lowering" });
    expect(payload.steps.map((s) => [s.exercise_id, s.sets, s.reps])).toEqual([
      ["e0", 3, 8],
      ["e1", 3, 10],
    ]);
  });

  it("gives step-less workouts their distance/time from the text", () => {
    const payload = buildWorkoutPayload(parseWorkoutBlock("Zwift ride\nEasy spin 45 min", { paceNames }), [], { paces });
    expect(payload).toMatchObject({ type: "bike", title: "Zwift ride", duration_minutes: 45, steps: [] });
  });
});

describe("runTotals", () => {
  it("fills distance from time and time from distance with paces", () => {
    const row = (o: object) => ({ step_type: "main", label: "", pace_type: "Easy", duration_minutes: "", duration_unit: "min" as const, distance_miles: "", distance_unit: "mi" as const, notes: "", repeat_group_id: null, repeat_count: 1, exercise_id: "", group_name: "", sets: "", reps: "", weight_suggestion: "", video_url: "", both_sides: false, stroke_style: "", ...o });
    expect(runTotals([row({ distance_miles: "2" }), row({ duration_minutes: "18" })], paces)).toEqual({ miles: 4, minutes: 36 });
  });
});
