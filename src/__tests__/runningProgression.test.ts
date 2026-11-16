import { describe, it, expect } from "vitest";
import type { PlanWorkout, WorkoutLog } from "@/types/database";
import type { HistoryEntry } from "@/lib/workoutHistory";
import {
  OTHER_RUN,
  buildWeeklyMileage,
  completedRunMiles,
  niceAxis,
  runSeriesColor,
  seriesInWeeks,
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
    expect(weeks.map((w) => w.bigJump)).toEqual([false, true, false, false]);
    expect(weeks[0].changePct).toBeCloseTo(10);
    expect(weeks[1].changePct).toBeCloseTo(13.64, 1);
    // Zero-mileage week before: no baseline, no flag.
    expect(weeks[3].total).toBe(0);
  });

  it("doesn't flag a week after a zero week", () => {
    const weeks = buildWeeklyMileage(byDate([entry("2026-11-09", { distance_miles: 10 })]), "2026-11-02", 2);
    expect(weeks[1].changePct).toBeNull();
    expect(weeks[1].bigJump).toBe(false);
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
