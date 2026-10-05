import { describe, it, expect } from "vitest";
import type { PlanWorkout, ScheduledWorkout, WorkoutLog } from "@/types/database";
import {
  addDays,
  planWeekRange,
  buildHistoryEntries,
  monthGridDates,
  summarizeHistory,
  type HistoryEntry,
  type UserPlanWithPlan,
} from "@/lib/workoutHistory";

function userPlan(id: string, planId: string, startDate: string, status: "active" | "paused" | "completed" = "active", totalWeeks = 4): UserPlanWithPlan {
  return {
    id,
    user_id: "u1",
    plan_id: planId,
    start_date: startDate,
    status,
    created_at: "",
    training_plans: { id: planId, name: `Plan ${planId}`, total_weeks: totalWeeks } as UserPlanWithPlan["training_plans"],
  };
}

function planWorkout(id: string, planId: string, week: number, day: number, extra: Partial<PlanWorkout> = {}): PlanWorkout {
  return { id, plan_id: planId, week_number: week, day_of_week: day, type: "run", title: id, sort_order: 0, distance_miles: null, ...extra } as PlanWorkout;
}

function log(userPlanId: string, planWorkoutId: string, completed: boolean, actualMiles: number | null = null): WorkoutLog {
  return {
    user_plan_id: userPlanId,
    plan_workout_id: planWorkoutId,
    completed_at: completed ? "2026-09-01T12:00:00Z" : null,
    actual_distance_miles: actualMiles,
  } as WorkoutLog;
}

function scheduled(id: string, date: string, completed = false): ScheduledWorkout {
  return { id, scheduled_date: date, type: "strength", title: id, sort_order: 0, completed_at: completed ? "2026-09-01T12:00:00Z" : null } as ScheduledWorkout;
}

describe("addDays", () => {
  it("adds and subtracts days across month boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("planWeekRange", () => {
  it("returns the weeks overlapping the range", () => {
    // Plan starts Mon Sep 7; Sep 14–20 is week 2, Sep 21 is week 3
    expect(planWeekRange("2026-09-07", 10, "2026-09-14", "2026-09-21")).toEqual({ from: 2, to: 3 });
  });

  it("clamps to week 1 and total_weeks", () => {
    expect(planWeekRange("2026-09-07", 2, "2026-08-01", "2026-12-31")).toEqual({ from: 1, to: 2 });
  });

  it("returns null when the plan doesn't overlap the range", () => {
    expect(planWeekRange("2026-09-07", 2, "2026-10-01", "2026-10-31")).toBeNull();
    expect(planWeekRange("2026-09-07", 2, "2026-08-01", "2026-09-06")).toBeNull();
  });
});

describe("buildHistoryEntries", () => {
  const range = ["2026-09-01", "2026-09-30"] as const;

  it("places plan workouts on their calendar date with their log", () => {
    const up = userPlan("up1", "p1", "2026-09-07");
    const byDate = buildHistoryEntries(
      { userPlans: [up], planWorkouts: [planWorkout("w1", "p1", 2, 3)], logs: [log("up1", "w1", true)], scheduled: [] },
      ...range
    );
    const entries = byDate.get("2026-09-17")!;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ source: "plan", userPlanId: "up1", planName: "Plan p1" });
    expect(entries[0].log?.completed_at).toBeTruthy();
  });

  it("includes incomplete workouts for active plans", () => {
    const byDate = buildHistoryEntries(
      { userPlans: [userPlan("up1", "p1", "2026-09-07")], planWorkouts: [planWorkout("w1", "p1", 1, 0)], logs: [], scheduled: [] },
      ...range
    );
    expect(byDate.get("2026-09-07")).toHaveLength(1);
  });

  it("only includes completed workouts for non-active plans", () => {
    const up = userPlan("up1", "p1", "2026-09-07", "completed");
    const byDate = buildHistoryEntries(
      {
        userPlans: [up],
        planWorkouts: [planWorkout("done", "p1", 1, 0), planWorkout("skipped", "p1", 1, 1)],
        logs: [log("up1", "done", true)],
        scheduled: [],
      },
      ...range
    );
    expect(byDate.get("2026-09-07")?.map((e) => e.workout.id)).toEqual(["done"]);
    expect(byDate.has("2026-09-08")).toBe(false);
  });

  it("matches logs to the right user_plan when a plan was run twice", () => {
    const byDate = buildHistoryEntries(
      {
        userPlans: [userPlan("old", "p1", "2026-09-07", "completed"), userPlan("new", "p1", "2026-09-21")],
        planWorkouts: [planWorkout("w1", "p1", 1, 0)],
        logs: [log("old", "w1", true)],
        scheduled: [],
      },
      ...range
    );
    expect(byDate.get("2026-09-07")?.[0].log?.completed_at).toBeTruthy();
    expect(byDate.get("2026-09-21")?.[0].log).toBeNull();
  });

  it("drops entries outside the range and weeks beyond total_weeks", () => {
    const byDate = buildHistoryEntries(
      {
        userPlans: [userPlan("up1", "p1", "2026-08-31", "active", 1)],
        planWorkouts: [planWorkout("aug", "p1", 1, 0), planWorkout("beyond", "p1", 2, 0)],
        logs: [],
        scheduled: [scheduled("s-oct", "2026-10-01")],
      },
      ...range
    );
    expect([...byDate.keys()]).toEqual([]);
  });

  it("includes scheduled workouts with a synthetic completion log", () => {
    const byDate = buildHistoryEntries(
      { userPlans: [], planWorkouts: [], logs: [], scheduled: [scheduled("s1", "2026-09-10", true), scheduled("s2", "2026-09-10")] },
      ...range
    );
    const entries = byDate.get("2026-09-10")!;
    expect(entries.map((e) => [e.source, !!e.log?.completed_at])).toEqual([
      ["scheduled", true],
      ["scheduled", false],
    ]);
    expect(entries[0].userPlanId).toBeUndefined();
  });
});

describe("monthGridDates", () => {
  it("covers whole Monday-first weeks around the month", () => {
    // October 2026: Thu 1st … Sat 31st
    const dates = monthGridDates(2026, 9);
    expect(dates[0]).toBe("2026-09-28");
    expect(dates[dates.length - 1]).toBe("2026-11-01");
    expect(dates.length % 7).toBe(0);
  });

  it("has no leading days when the month starts on a Monday", () => {
    // June 2026 starts on a Monday
    expect(monthGridDates(2026, 5)[0]).toBe("2026-06-01");
  });
});

describe("summarizeHistory", () => {
  it("counts non-rest workouts and sums completed miles, preferring actual distance", () => {
    const entries = [
      { workout: planWorkout("a", "p", 1, 0, { distance_miles: 5 }), log: log("u", "a", true, 6.2) },
      { workout: planWorkout("b", "p", 1, 1, { distance_miles: 3 }), log: log("u", "b", true) },
      { workout: planWorkout("c", "p", 1, 2, { distance_miles: 10 }), log: null },
      { workout: planWorkout("r", "p", 1, 3, { type: "rest" }), log: null },
    ] as HistoryEntry[];
    const summary = summarizeHistory(entries);
    expect(summary.completed).toBe(2);
    expect(summary.scheduled).toBe(3);
    expect(summary.completedMiles).toBeCloseTo(9.2);
  });
});
