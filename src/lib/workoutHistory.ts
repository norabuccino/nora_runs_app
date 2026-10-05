import type { PlanWorkout, ScheduledWorkout, TrainingPlan, UserPlan, WorkoutLog } from "@/types/database";
import { formatDateLocal, parseDateLocal, scheduledDate, mondayOfWeek } from "@/lib/paceUtils";
import { adaptScheduledWorkout } from "@/lib/scheduledWorkout";

/**
 * One workout occurrence on a calendar date — either a plan workout placed on
 * a date by its user_plan's start_date, or an ad-hoc scheduled workout —
 * normalized into the PlanWorkout + WorkoutLog shape WorkoutCard renders.
 */
export interface HistoryEntry {
  key: string;
  date: string;
  source: "plan" | "scheduled";
  workout: PlanWorkout;
  /** Real log for plan workouts; synthetic `{ completed_at }` for scheduled ones. */
  log: WorkoutLog | null;
  /** Set for plan workouts — needed to mark them complete/incomplete. */
  userPlanId?: string;
  planName?: string;
}

export type UserPlanWithPlan = UserPlan & { training_plans: TrainingPlan };

export function addDays(iso: string, days: number): string {
  const d = parseDateLocal(iso);
  d.setDate(d.getDate() + days);
  return formatDateLocal(d);
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseDateLocal(toISO).getTime() - parseDateLocal(fromISO).getTime()) / 86400000);
}

/**
 * The plan weeks (1-based, inclusive) that overlap [rangeStart, rangeEnd] for
 * a plan starting on startDate, or null if the plan doesn't touch the range.
 */
export function planWeekRange(
  startDate: string,
  totalWeeks: number,
  rangeStart: string,
  rangeEnd: string
): { from: number; to: number } | null {
  const from = Math.max(1, Math.floor(daysBetween(startDate, rangeStart) / 7) + 1);
  const to = Math.min(totalWeeks, Math.floor(daysBetween(startDate, rangeEnd) / 7) + 1);
  return from <= to ? { from, to } : null;
}

/**
 * Merges plan workouts (with their logs) and scheduled workouts into
 * per-date entry lists for dates within [rangeStart, rangeEnd].
 *
 * Active plans contribute every workout (done or not, so missed workouts show
 * up); paused/completed plans contribute only workouts that were actually
 * completed, since their unfinished slots no longer reflect a real schedule.
 */
export function buildHistoryEntries(
  input: {
    userPlans: UserPlanWithPlan[];
    planWorkouts: PlanWorkout[];
    logs: WorkoutLog[];
    scheduled: ScheduledWorkout[];
  },
  rangeStart: string,
  rangeEnd: string
): Map<string, HistoryEntry[]> {
  const byDate = new Map<string, HistoryEntry[]>();
  const push = (entry: HistoryEntry) => {
    if (entry.date < rangeStart || entry.date > rangeEnd) return;
    const list = byDate.get(entry.date) ?? [];
    list.push(entry);
    byDate.set(entry.date, list);
  };

  for (const up of input.userPlans) {
    const plan = up.training_plans;
    const workouts = input.planWorkouts.filter((w) => w.plan_id === up.plan_id && w.week_number <= plan.total_weeks);
    for (const w of workouts) {
      const log = input.logs.find((l) => l.user_plan_id === up.id && l.plan_workout_id === w.id) ?? null;
      if (up.status !== "active" && !log?.completed_at) continue;
      push({
        key: `plan:${up.id}:${w.id}`,
        date: scheduledDate(up.start_date, w.week_number, w.day_of_week),
        source: "plan",
        workout: w,
        log,
        userPlanId: up.id,
        planName: plan.name,
      });
    }
  }

  for (const sw of input.scheduled) {
    push({
      key: `scheduled:${sw.id}`,
      date: sw.scheduled_date,
      source: "scheduled",
      workout: adaptScheduledWorkout(sw),
      log: sw.completed_at ? ({ completed_at: sw.completed_at } as WorkoutLog) : null,
    });
  }

  for (const list of byDate.values()) {
    list.sort((a, b) => a.workout.sort_order - b.workout.sort_order);
  }
  return byDate;
}

/**
 * All dates shown on a Monday-first month calendar for the given month
 * (0-based, like Date#getMonth): leading days from the previous month and
 * trailing days from the next, so the result is always whole weeks.
 */
export function monthGridDates(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = mondayOfWeek(first);
  const end = addDays(mondayOfWeek(last), 6);
  const dates: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d);
  return dates;
}

export interface HistorySummary {
  completed: number;
  scheduled: number;
  /** Miles across completed workouts — logged actual distance when set, else planned. */
  completedMiles: number;
}

export function summarizeHistory(entries: HistoryEntry[]): HistorySummary {
  let completed = 0;
  let scheduled = 0;
  let completedMiles = 0;
  for (const e of entries) {
    if (e.workout.type === "rest") continue;
    scheduled++;
    if (e.log?.completed_at) {
      completed++;
      completedMiles += e.log.actual_distance_miles ?? e.workout.distance_miles ?? 0;
    }
  }
  return { completed, scheduled, completedMiles };
}
