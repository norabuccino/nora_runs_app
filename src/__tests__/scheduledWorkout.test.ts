import { describe, it, expect } from "vitest";
import { groupScheduledWorkoutHistory } from "@/lib/scheduledWorkout";

interface FakeScheduledWorkout {
  id: string;
  scheduled_date: string;
}

function sw(id: string, scheduled_date: string): FakeScheduledWorkout {
  return { id, scheduled_date };
}

describe("groupScheduledWorkoutHistory", () => {
  it("separates today's workouts from prior days", () => {
    const { today, history } = groupScheduledWorkoutHistory(
      [sw("a", "2026-09-14"), sw("b", "2026-09-13")],
      "2026-09-14"
    );
    expect(today.map((w) => w.id)).toEqual(["a"]);
    expect(history).toHaveLength(1);
    expect(history[0].date).toBe("2026-09-13");
    expect(history[0].workouts.map((w) => w.id)).toEqual(["b"]);
  });

  it("groups multiple workouts on the same past day together", () => {
    const { history } = groupScheduledWorkoutHistory(
      [sw("a", "2026-09-12"), sw("b", "2026-09-12")],
      "2026-09-14"
    );
    expect(history).toHaveLength(1);
    expect(history[0].workouts.map((w) => w.id)).toEqual(["a", "b"]);
  });

  it("orders past days most-recent-first", () => {
    const { history } = groupScheduledWorkoutHistory(
      [sw("a", "2026-09-09"), sw("b", "2026-09-13"), sw("c", "2026-09-11")],
      "2026-09-14"
    );
    expect(history.map((d) => d.date)).toEqual(["2026-09-13", "2026-09-11", "2026-09-09"]);
  });

  it("returns empty today and history when there are no scheduled workouts", () => {
    const { today, history } = groupScheduledWorkoutHistory([], "2026-09-14");
    expect(today).toEqual([]);
    expect(history).toEqual([]);
  });
});
