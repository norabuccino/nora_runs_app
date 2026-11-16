import type { HistoryEntry } from "@/lib/workoutHistory";
import { addDays } from "@/lib/workoutHistory";
import { RUN_TYPE_LABELS, weekOverWeekIncreasePct } from "@/lib/paceUtils";
import { convertDistance, type DistanceUnit } from "@/lib/unitUtils";

/** Week-over-week increase (percent) above which a week is flagged — the "10% rule". */
export const MILEAGE_JUMP_PCT = 10;

/** Key for completed runs with no run type set. */
export const OTHER_RUN = "other";

/**
 * Fixed stacking/colour order for the weekly mileage chart — the most common
 * run types first so they sit at the bottom of each bar. Colour follows the
 * run type (slot N = --chart-series-N), never its rank in the current range.
 */
export const RUN_SERIES_ORDER = [
  "easy_run",
  "long_run",
  "interval_run",
  "threshold_run",
  "mp_hmp_run",
  "recovery_run",
  "race",
  "boost_run",
  OTHER_RUN,
] as const;

export function runSeriesLabel(key: string): string {
  return key === OTHER_RUN ? "Other run" : RUN_TYPE_LABELS[key] ?? key;
}

export function runSeriesColor(key: string): string {
  const slot = RUN_SERIES_ORDER.indexOf(key as (typeof RUN_SERIES_ORDER)[number]);
  return slot === -1 || key === OTHER_RUN ? "var(--chart-series-other)" : `var(--chart-series-${slot + 1})`;
}

export interface WeekMileage {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  /** Completed run miles for the week. */
  total: number;
  /** Miles per run type key (RUN_SERIES_ORDER), only types with mileage. */
  byType: Record<string, number>;
  /** Percent change vs the previous week, or null when the previous week had no mileage. */
  changePct: number | null;
  /** True when the week rose more than MILEAGE_JUMP_PCT over the previous one. */
  bigJump: boolean;
}

/** Miles a completed run counts for: logged actual distance, else the planned distance. */
export function completedRunMiles(entry: HistoryEntry): number {
  if (entry.workout.type !== "run" || !entry.log?.completed_at) return 0;
  if (entry.log.actual_distance_miles != null) return Number(entry.log.actual_distance_miles);
  const planned = entry.workout.distance_miles;
  if (!planned) return 0;
  return convertDistance(Number(planned), (entry.workout.distance_unit ?? "mi") as DistanceUnit, "mi");
}

/**
 * Totals completed run mileage per Monday-first week, broken down by run type.
 * `firstWeek` is a Monday; one extra week before it is read (when present in
 * `entriesByDate`) so the first week shown still gets a week-over-week change.
 */
export function buildWeeklyMileage(
  entriesByDate: Map<string, HistoryEntry[]>,
  firstWeek: string,
  weekCount: number
): WeekMileage[] {
  const weeks: WeekMileage[] = [];
  let previousTotal = 0;
  for (let i = -1; i < weekCount; i++) {
    const weekStart = addDays(firstWeek, i * 7);
    const byType: Record<string, number> = {};
    let total = 0;
    for (let d = 0; d < 7; d++) {
      for (const entry of entriesByDate.get(addDays(weekStart, d)) ?? []) {
        const miles = completedRunMiles(entry);
        if (miles <= 0) continue;
        const key = entry.workout.run_type && RUN_TYPE_LABELS[entry.workout.run_type] ? entry.workout.run_type : OTHER_RUN;
        byType[key] = (byType[key] ?? 0) + miles;
        total += miles;
      }
    }
    if (i >= 0) {
      const changePct = weekOverWeekIncreasePct({ low: previousTotal, high: previousTotal }, { low: total, high: total });
      weeks.push({ weekStart, total, byType, changePct, bigJump: changePct != null && changePct > MILEAGE_JUMP_PCT });
    }
    previousTotal = total;
  }
  return weeks;
}

/** Run types with mileage anywhere in `weeks`, in RUN_SERIES_ORDER. */
export function seriesInWeeks(weeks: WeekMileage[]): string[] {
  return RUN_SERIES_ORDER.filter((key) => weeks.some((w) => (w.byType[key] ?? 0) > 0));
}

/** A "nice" axis maximum (1/2/2.5/5 × 10^n) at or above `max`, and its tick step. */
export function niceAxis(max: number, targetTicks = 4): { max: number; step: number } {
  if (max <= 0) return { max: 10, step: 2.5 };
  const rough = max / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  return { max: Math.ceil(max / step) * step, step };
}
