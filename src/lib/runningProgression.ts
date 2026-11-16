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
  /** Upcoming (not yet completed) planned run miles — only when built with `today`. */
  planned: number;
  plannedByType: Record<string, number>;
  /** Percent change of completed + planned vs the previous week's, or null when the previous week had no mileage. */
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

/** Planned miles for a run that isn't completed yet. */
export function plannedRunMiles(entry: HistoryEntry): number {
  if (entry.workout.type !== "run" || entry.log?.completed_at) return 0;
  const planned = entry.workout.distance_miles;
  if (!planned) return 0;
  return convertDistance(Number(planned), (entry.workout.distance_unit ?? "mi") as DistanceUnit, "mi");
}

function runTypeKey(entry: HistoryEntry): string {
  return entry.workout.run_type && RUN_TYPE_LABELS[entry.workout.run_type] ? entry.workout.run_type : OTHER_RUN;
}

/**
 * The upcoming runs that count toward a day's planned mileage. Ad-hoc
 * scheduled runs all count. A plan day whose workouts are alternatives
 * (`day_logic` "or", read from its first workout like weekMileageRange does)
 * counts only its longest run — or nothing once one of them was completed.
 */
function plannedRunsForDay(entries: HistoryEntry[]): HistoryEntry[] {
  const result = entries.filter((e) => e.source === "scheduled" && plannedRunMiles(e) > 0);
  const byPlan = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    if (e.source !== "plan") continue;
    const key = e.userPlanId ?? "";
    byPlan.set(key, [...(byPlan.get(key) ?? []), e]);
  }
  for (const group of byPlan.values()) {
    const runs = group.filter((e) => plannedRunMiles(e) > 0);
    if (!runs.length) continue;
    const first = [...group].sort((a, b) => a.workout.sort_order - b.workout.sort_order)[0];
    if ((first.workout.day_logic ?? "or") === "and") {
      result.push(...runs);
    } else if (!group.some((e) => e.log?.completed_at)) {
      result.push(runs.reduce((a, b) => (plannedRunMiles(b) > plannedRunMiles(a) ? b : a)));
    }
  }
  return result;
}

/**
 * Totals completed run mileage per Monday-first week, broken down by run type.
 * `firstWeek` is a Monday; one extra week before it is read (when present in
 * `entriesByDate`) so the first week shown still gets a week-over-week change.
 * With `today`, runs on or after it that aren't completed yet count as planned
 * mileage, and the week-over-week change compares completed + planned.
 */
export function buildWeeklyMileage(
  entriesByDate: Map<string, HistoryEntry[]>,
  firstWeek: string,
  weekCount: number,
  today?: string
): WeekMileage[] {
  const weeks: WeekMileage[] = [];
  let previousTotal = 0;
  for (let i = -1; i < weekCount; i++) {
    const weekStart = addDays(firstWeek, i * 7);
    const byType: Record<string, number> = {};
    const plannedByType: Record<string, number> = {};
    let total = 0;
    let planned = 0;
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      const dayEntries = entriesByDate.get(date) ?? [];
      for (const entry of dayEntries) {
        const miles = completedRunMiles(entry);
        if (miles <= 0) continue;
        const key = runTypeKey(entry);
        byType[key] = (byType[key] ?? 0) + miles;
        total += miles;
      }
      if (today && date >= today) {
        for (const entry of plannedRunsForDay(dayEntries)) {
          const miles = plannedRunMiles(entry);
          const key = runTypeKey(entry);
          plannedByType[key] = (plannedByType[key] ?? 0) + miles;
          planned += miles;
        }
      }
    }
    const combined = total + planned;
    if (i >= 0) {
      const changePct = weekOverWeekIncreasePct({ low: previousTotal, high: previousTotal }, { low: combined, high: combined });
      weeks.push({ weekStart, total, byType, planned, plannedByType, changePct, bigJump: changePct != null && changePct > MILEAGE_JUMP_PCT });
    }
    previousTotal = combined;
  }
  return weeks;
}

/** Drops weeks after `lastPastWeek` from the end until one has planned mileage. */
export function trimEmptyFutureWeeks(weeks: WeekMileage[], lastPastWeek: string): WeekMileage[] {
  let end = weeks.length;
  while (end > 0 && weeks[end - 1].weekStart > lastPastWeek && weeks[end - 1].planned <= 0) end--;
  return weeks.slice(0, end);
}

/** Run types with mileage anywhere in `weeks`, in RUN_SERIES_ORDER. */
export function seriesInWeeks(weeks: WeekMileage[]): string[] {
  return RUN_SERIES_ORDER.filter((key) => weeks.some((w) => (w.byType[key] ?? 0) + (w.plannedByType[key] ?? 0) > 0));
}

/** A "nice" axis maximum (1/2/2.5/5 × 10^n) at or above `max`, and its tick step. */
export function niceAxis(max: number, targetTicks = 4): { max: number; step: number } {
  if (max <= 0) return { max: 10, step: 2.5 };
  const rough = max / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  return { max: Math.ceil(max / step) * step, step };
}
