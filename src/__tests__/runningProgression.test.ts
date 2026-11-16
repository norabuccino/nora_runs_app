import { describe, it, expect } from "vitest";
import type { PlanWorkout, WorkoutLog } from "@/types/database";
import type { HistoryEntry } from "@/lib/workoutHistory";
import {
  OTHER_RUN,
  buildWeeklyMileage,
  classifyJump,
  completedRunMiles,
  niceAxis,
  plannedRunMiles,
  runSeriesColor,
  seriesInWeeks,
  trimEmptyFutureWeeks,
} from "@/lib/runningProgression";

let n = 0;
function entry(
  date: string,
  extra: Partial<PlanWorkout> = {},
  log: Partial<WorkoutLog> | null = { completed_at: `${date}T12:00:00Z` }
): HistoryEntry {
  n++;
  return {
    key: `e${n}`,
    date,
    source: "scheduled",
    workout: { id: `w${n}`, type: "run", run_type: "easy_run", distance_miles: 5, sort_order: 0, ...extra } as PlanWorkout,
    log: log as WorkoutLog | null,
  };
}

function byDate(entries: HistoryEntry[]): Map<string, HistoryEntry[]> {
  const map = new Map<string, HistoryEntry[]>();
  for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e]);
  return map;
}

describe("completedRunMiles", () => {
  it("uses logged distance over planned", () => {
    expect(completedRunMiles(entry("2026-11-02", {}, { completed_at: "x", actual_distance_miles: 6.2 }))).toBe(6.2);
  });
  it("falls back to planned distance, converting km", () => {
    expect(completedRunMiles(entry("2026-11-02", { distance_miles: 5 }))).toBe(5);
    expect(completedRunMiles(entry("2026-11-02", { distance_miles: 10, distance_unit: "km" }))).toBeCloseTo(6.21, 2);
  });
  it("ignores incomplete runs and non-runs", () => {
    expect(completedRunMiles(entry("2026-11-02", {}, null))).toBe(0);
    expect(completedRunMiles(entry("2026-11-02", { type: "bike", distance_miles: 20 }))).toBe(0);
  });
});

describe("buildWeeklyMileage", () => {
  it("totals Monday-first weeks by run type", () => {
    const weeks = buildWeeklyMileage(
      byDate([
        entry("2026-11-02", { run_type: "easy_run", distance_miles: 4 }),
        entry("2026-11-08", { run_type: "long_run", distance_miles: 10 }), // Sunday, same week
        entry("2026-11-09", { run_type: null, distance_miles: 3 }), // next Monday
      ]),
      "2026-11-02",
      2
    );
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-11-02", "2026-11-09"]);
    expect(weeks[0].total).toBe(14);
    expect(weeks[0].byType).toEqual({ easy_run: 4, long_run: 10 });
    expect(weeks[1].byType).toEqual({ [OTHER_RUN]: 3 });
  });

  it("flags weeks up more than 10%, using the week before the range for the first", () => {
    const weeks = buildWeeklyMileage(
      byDate([
        entry("2026-10-26", { distance_miles: 20 }), // week before range
        entry("2026-11-02", { distance_miles: 22 }), // +10% exactly — not flagged
        entry("2026-11-09", { distance_miles: 25 }), // +13.6%
        entry("2026-11-16", { distance_miles: 20 }), // down
      ]),
      "2026-11-02",
      4
    );
    expect(weeks.map((w) => w.jump)).toEqual(["none", "moderate", "none", "none"]);
    expect(weeks[0].changePct).toBeCloseTo(10);
    expect(weeks[1].changePct).toBeCloseTo(13.64, 1);
    // Zero-mileage week before: no baseline, no flag.
    expect(weeks[3].total).toBe(0);
  });

  it("doesn't flag a week after a zero week", () => {
    const weeks = buildWeeklyMileage(byDate([entry("2026-11-09", { distance_miles: 10 })]), "2026-11-02", 2);
    expect(weeks[1].changePct).toBeNull();
    expect(weeks[1].jump).toBe("none");
  });
});

function planEntry(date: string, extra: Partial<PlanWorkout> = {}, completed = false, userPlanId = "up1"): HistoryEntry {
  return { ...entry(date, extra, completed ? { completed_at: `${date}T12:00:00Z` } : null), source: "plan", userPlanId };
}

describe("jump levels", () => {
  it("classifies by the increase over the previous week", () => {
    expect(classifyJump(null, 10, 0)).toBe("none");
    expect(classifyJump(10, 22, 20)).toBe("none");
    expect(classifyJump(12, 22.4, 20)).toBe("moderate");
    expect(classifyJump(15, 23, 20)).toBe("moderate");
    expect(classifyJump(16, 23.2, 20)).toBe("large");
  });

  it("calls a jump back to within 10% of the recent high a rebound", () => {
    expect(classifyJump(40, 21, 20)).toBe("rebound");
    expect(classifyJump(40, 22, 20)).toBe("rebound");
    expect(classifyJump(40, 22.5, 20)).toBe("large");
  });

  it("measures rebounds against the highest of the last 3 weeks", () => {
    const weeks = buildWeeklyMileage(
      byDate([
        entry("2026-10-12", { distance_miles: 30 }), // 4 weeks before — outside the lookback
        entry("2026-10-19", { distance_miles: 20 }),
        entry("2026-10-26", { distance_miles: 21 }),
        entry("2026-11-02", { distance_miles: 14 }), // cutback
        entry("2026-11-09", { distance_miles: 22 }), // +57%, but within 10% of 21
        entry("2026-11-16", { distance_miles: 14 }), // cutback
        entry("2026-11-23", { distance_miles: 26 }), // +86%, 18% above 22
      ]),
      "2026-11-02",
      4
    );
    expect(weeks.map((w) => w.jump)).toEqual(["none", "rebound", "none", "large"]);
    expect(weeks[1].recentPeak).toBe(21);
  });
});

describe("planned mileage", () => {
  const today = "2026-11-12"; // Thursday

  it("counts upcoming uncompleted runs from today on, not missed ones", () => {
    const weeks = buildWeeklyMileage(
      byDate([
        entry("2026-11-10", { distance_miles: 4 }), // done
        entry("2026-11-11", { distance_miles: 3 }, null), // missed — not counted
        entry("2026-11-12", { distance_miles: 5 }, null), // today, planned
        entry("2026-11-15", { run_type: "long_run", distance_miles: 10 }, null),
        entry("2026-11-16", { distance_miles: 6 }, null), // next week
        entry("2026-11-17", { type: "strength", distance_miles: null }, null),
      ]),
      "2026-11-09",
      2,
      today
    );
    expect(weeks[0].total).toBe(4);
    expect(weeks[0].planned).toBe(15);
    expect(weeks[0].plannedByType).toEqual({ easy_run: 5, long_run: 10 });
    expect(weeks[1].planned).toBe(6);
  });

  it("ignores planned runs without `today`", () => {
    const weeks = buildWeeklyMileage(byDate([entry("2026-11-16", { distance_miles: 6 }, null)]), "2026-11-16", 1);
    expect(weeks[0].planned).toBe(0);
  });

  it("flags planned jumps against completed + planned of the week before", () => {
    const weeks = buildWeeklyMileage(
      byDate([
        entry("2026-11-10", { distance_miles: 10 }),
        entry("2026-11-14", { distance_miles: 10 }, null), // this week: 20 total
        entry("2026-11-17", { distance_miles: 23 }, null), // +15%
        entry("2026-11-24", { distance_miles: 24 }, null), // +4%
      ]),
      "2026-11-09",
      3,
      today
    );
    expect(weeks.map((w) => w.jump)).toEqual(["none", "moderate", "none"]);
    expect(weeks[1].changePct).toBeCloseTo(15);
  });

  it("counts only the longest run on an OR plan day, all runs on an AND day", () => {
    const orWeeks = buildWeeklyMileage(
      byDate([
        planEntry("2026-11-16", { distance_miles: 5, sort_order: 0, day_logic: "or" }),
        planEntry("2026-11-16", { distance_miles: 8, sort_order: 1, day_logic: "or" }),
      ]),
      "2026-11-16",
      1,
      today
    );
    expect(orWeeks[0].planned).toBe(8);
    const andWeeks = buildWeeklyMileage(
      byDate([
        planEntry("2026-11-16", { distance_miles: 5, sort_order: 0, day_logic: "and" }),
        planEntry("2026-11-16", { distance_miles: 3, sort_order: 1, day_logic: "and" }),
      ]),
      "2026-11-16",
      1,
      today
    );
    expect(andWeeks[0].planned).toBe(8);
  });

  it("drops an OR day's planned alternatives once one is completed", () => {
    const weeks = buildWeeklyMileage(
      byDate([
        planEntry("2026-11-12", { type: "cross_train", distance_miles: null, sort_order: 0, day_logic: "or" }, true),
        planEntry("2026-11-12", { distance_miles: 6, sort_order: 1, day_logic: "or" }),
      ]),
      "2026-11-09",
      1,
      today
    );
    expect(weeks[0].planned).toBe(0);
  });

  it("plannedRunMiles is zero for completed runs", () => {
    expect(plannedRunMiles(entry("2026-11-16", { distance_miles: 6 }))).toBe(0);
    expect(plannedRunMiles(entry("2026-11-16", { distance_miles: 6 }, null))).toBe(6);
  });

  it("trims empty future weeks off the end only", () => {
    const weeks = buildWeeklyMileage(
      byDate([entry("2026-11-10", { distance_miles: 4 }), entry("2026-11-23", { distance_miles: 6 }, null)]),
      "2026-11-02",
      6,
      today
    );
    expect(trimEmptyFutureWeeks(weeks, "2026-11-09").map((w) => w.weekStart)).toEqual([
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
    ]);
  });
});

describe("seriesInWeeks / runSeriesColor", () => {
  it("lists present run types in fixed order, colour by type not rank", () => {
    const weeks = buildWeeklyMileage(
      byDate([entry("2026-11-02", { run_type: "long_run" }), entry("2026-11-03", { run_type: null })]),
      "2026-11-02",
      1
    );
    expect(seriesInWeeks(weeks)).toEqual(["long_run", OTHER_RUN]);
    expect(runSeriesColor("long_run")).toBe("var(--chart-series-2)");
    expect(runSeriesColor(OTHER_RUN)).toBe("var(--chart-series-other)");
  });
});

describe("niceAxis", () => {
  it("rounds up to a nice maximum", () => {
    expect(niceAxis(37)).toEqual({ max: 40, step: 10 });
    expect(niceAxis(9)).toEqual({ max: 10, step: 2.5 });
    expect(niceAxis(0)).toEqual({ max: 10, step: 2.5 });
  });
});
