import { describe, it, expect } from "vitest";
import { parsePlanText, workoutFromText } from "@/lib/planTextImport";

const opts = { totalWeeks: 6, defaultWeek: 1 };

describe("parsePlanText", () => {
  it("reads week headers, days and AND/OR slots", () => {
    const { entries, unparsed } = parsePlanText(
      "Week 1\nMon: Easy run 4 miles\nTue: Track 200s + Upper body pull\nThu: Tempo 5 miles or Bike 45 min\n\nWeeks 2-3:\nMon/Wed/Fri: Easy 5 miles",
      opts
    );
    expect(unparsed).toEqual([]);
    expect(entries.map((e) => [e.weeks, e.day, e.workouts, e.logic])).toEqual([
      [[1], 0, ["Easy run 4 miles"], "and"],
      [[1], 1, ["Track 200s", "Upper body pull"], "and"],
      [[1], 3, ["Tempo 5 miles", "Bike 45 min"], "or"],
      [[2, 3], 0, ["Easy 5 miles"], "and"],
      [[2, 3], 2, ["Easy 5 miles"], "and"],
      [[2, 3], 4, ["Easy 5 miles"], "and"],
    ]);
  });

  it("accepts full day names, Day N, separators and inline week items", () => {
    const { entries } = parsePlanText("Week 4: Saturday - Long run 10 miles; Day 7 Rest", opts);
    expect(entries.map((e) => [e.weeks, e.day, e.workouts])).toEqual([
      [[4], 5, ["Long run 10 miles"]],
      [[4], 6, ["Rest"]],
    ]);
  });

  it("uses the default week without headers, expands every week, and flags weeks outside the plan", () => {
    expect(parsePlanText("Tue: Strides", { totalWeeks: 6, defaultWeek: 3 }).entries[0].weeks).toEqual([3]);
    expect(parsePlanText("Every week:\nSun: Rest", opts).entries[0].weeks).toEqual([1, 2, 3, 4, 5, 6]);
    const out = parsePlanText("Weeks 5-8\nMon: Easy 3", opts);
    expect(out.entries[0].weeks).toEqual([5, 6]);
    expect(out.outOfRangeWeeks).toEqual([7, 8]);
  });

  it("keeps a known workout name containing + or 'or' in one piece", () => {
    const known = (t: string) => t === "2-3x 1K at 5K + 4x 200 at 3K";
    expect(parsePlanText("Tue: 2-3x 1K at 5K + 4x 200 at 3K", { ...opts, isKnownWorkout: known }).entries[0].workouts).toEqual([
      "2-3x 1K at 5K + 4x 200 at 3K",
    ]);
  });

  it("reports lines without a day", () => {
    expect(parsePlanText("Easy run 4 miles", opts).unparsed).toEqual(["Easy run 4 miles"]);
  });
});

describe("workoutFromText", () => {
  it("infers type, sub-type, distance and time", () => {
    expect(workoutFromText("Long run 10 miles")).toMatchObject({ type: "run", run_type: "long_run", distance_miles: 10, distance_unit: "mi" });
    expect(workoutFromText("Upper body pull")).toMatchObject({ type: "strength", strength_type: "upper_body", distance_miles: null });
    expect(workoutFromText("Bike 45 min")).toMatchObject({ type: "bike", duration_minutes: 45 });
    expect(workoutFromText("Yoga")).toMatchObject({ type: "cross_train" });
    expect(workoutFromText("off")).toMatchObject({ type: "rest", title: "Rest" });
    expect(workoutFromText("Tempo 8 km at 10k pace")).toMatchObject({ type: "run", run_type: "threshold_run", distance_miles: 8, distance_unit: "km" });
  });
});
