import { describe, it, expect } from "vitest";
import { buildScheduledWeekDays } from "@/lib/scheduledWorkout";

interface FakeScheduledWorkout {
  id: string;
  scheduled_date: string;
}

function sw(id: string, scheduled_date: string): FakeScheduledWorkout {
  return { id, scheduled_date };
}

describe("buildScheduledWeekDays", () => {
  it("returns all 7 days of the week starting at weekStartISO, in order", () => {
    const days = buildScheduledWeekDays("2026-09-14", []);
    expect(days.map((d) => d.date)).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
  });

  it("returns an empty workouts array for days with nothing scheduled", () => {
    const days = buildScheduledWeekDays("2026-09-14", []);
    expect(days.every((d) => d.workouts.length === 0)).toBe(true);
  });

  it("buckets workouts under their matching day, including future days", () => {
    const days = buildScheduledWeekDays("2026-09-14", [
      sw("a", "2026-09-14"),
      sw("b", "2026-09-18"),
      sw("c", "2026-09-18"),
    ]);
    expect(days[0].workouts.map((w) => w.id)).toEqual(["a"]);
    expect(days[4].workouts.map((w) => w.id)).toEqual(["b", "c"]);
    expect(days[1].workouts).toEqual([]);
  });

  it("ignores workouts scheduled outside the given week", () => {
    const days = buildScheduledWeekDays("2026-09-14", [sw("a", "2026-09-21")]);
    expect(days.every((d) => d.workouts.length === 0)).toBe(true);
  });
});
