import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatPace,
  parsePace,
  estimateDuration,
  getTodayPosition,
  scheduledDate,
  getWorkoutEstimate,
  defaultDayMapping,
  resolvePaceSecondsPerMile,
  stepDurationSeconds,
} from "@/lib/paceUtils";
import type { RunningPace } from "@/types/database";

// ── formatPace ─────────────────────────────────────────────────────────────────

describe("formatPace", () => {
  it("formats a round pace correctly", () => {
    expect(formatPace(480)).toBe("8:00");
  });

  it("pads seconds with a leading zero", () => {
    expect(formatPace(487)).toBe("8:07");
  });

  it("handles paces over 10 minutes", () => {
    expect(formatPace(630)).toBe("10:30");
  });

  it("handles zero seconds", () => {
    expect(formatPace(600)).toBe("10:00");
  });

  it("handles 59 seconds without rounding to next minute", () => {
    expect(formatPace(599)).toBe("9:59");
  });
});

// ── parsePace ──────────────────────────────────────────────────────────────────

describe("parsePace", () => {
  it("parses a valid pace string into seconds per mile", () => {
    expect(parsePace("8:00")).toBe(480);
  });

  it("parses a pace with non-zero seconds", () => {
    expect(parsePace("9:30")).toBe(570);
  });

  it("parses a sub-5 pace", () => {
    expect(parsePace("4:55")).toBe(295);
  });

  it("returns null for a string with no colon", () => {
    expect(parsePace("800")).toBeNull();
  });

  it("returns null for non-numeric parts", () => {
    expect(parsePace("a:bc")).toBeNull();
  });

  it("returns null when seconds >= 60", () => {
    expect(parsePace("8:60")).toBeNull();
    expect(parsePace("8:99")).toBeNull();
  });

  it("round-trips with formatPace", () => {
    const secondsPerMile = 510;
    expect(parsePace(formatPace(secondsPerMile))).toBe(secondsPerMile);
  });
});

// ── estimateDuration ───────────────────────────────────────────────────────────

describe("estimateDuration", () => {
  it("returns minutes only for sub-hour runs", () => {
    expect(estimateDuration(5, 480)).toBe("40m");
  });

  it("returns hours and minutes for long runs", () => {
    // 13.1 * 540 = 7074 sec → 1h 57m
    expect(estimateDuration(13.1, 540)).toBe("1h 57m");
  });

  it("returns hours and minutes for marathon effort", () => {
    expect(estimateDuration(26.2, 480)).toBe("3h 29m");
  });

  it("returns 0m for zero distance", () => {
    expect(estimateDuration(0, 480)).toBe("0m");
  });
});

// ── scheduledDate ──────────────────────────────────────────────────────────────

describe("scheduledDate", () => {
  it("returns the start date for week 1 day 0", () => {
    expect(scheduledDate("2026-06-29", 1, 0)).toBe("2026-06-29");
  });

  it("returns the correct date for week 1 day 1", () => {
    expect(scheduledDate("2026-06-29", 1, 1)).toBe("2026-06-30");
  });

  it("returns the correct date for the last day of week 1", () => {
    expect(scheduledDate("2026-06-29", 1, 6)).toBe("2026-07-05");
  });

  it("returns the correct date for the first day of week 2", () => {
    expect(scheduledDate("2026-06-29", 2, 0)).toBe("2026-07-06");
  });

  it("returns the correct date mid-plan", () => {
    expect(scheduledDate("2026-06-29", 4, 2)).toBe("2026-07-22");
  });

  it("handles month rollover correctly", () => {
    expect(scheduledDate("2026-12-28", 1, 6)).toBe("2027-01-03");
  });

  it("is not shifted by timezone — start date is treated as local date", () => {
    // Regression: new Date("2026-06-29") used to parse as UTC midnight,
    // rolling back to Jun 28 in US timezones after local normalization.
    const result = scheduledDate("2026-06-29", 1, 0);
    expect(result).toBe("2026-06-29");
  });
});

// ── getTodayPosition ───────────────────────────────────────────────────────────

describe("getTodayPosition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns week 1 day 0 when today is the start date", () => {
    vi.setSystemTime(new Date(2026, 5, 29)); // June 29, 2026
    expect(getTodayPosition("2026-06-29", 18)).toEqual({ weekNumber: 1, dayOfWeek: 0 });
  });

  it("returns week 1 day 1 on the second day", () => {
    vi.setSystemTime(new Date(2026, 5, 30)); // June 30
    expect(getTodayPosition("2026-06-29", 18)).toEqual({ weekNumber: 1, dayOfWeek: 1 });
  });

  it("returns week 1 day 6 on the last day of week 1", () => {
    vi.setSystemTime(new Date(2026, 6, 5)); // July 5
    expect(getTodayPosition("2026-06-29", 18)).toEqual({ weekNumber: 1, dayOfWeek: 6 });
  });

  it("returns week 2 day 0 on the first day of week 2", () => {
    vi.setSystemTime(new Date(2026, 6, 6)); // July 6
    expect(getTodayPosition("2026-06-29", 18)).toEqual({ weekNumber: 2, dayOfWeek: 0 });
  });

  it("returns null when today is before the start date", () => {
    vi.setSystemTime(new Date(2026, 5, 28)); // June 28 — one day before start
    expect(getTodayPosition("2026-06-29", 18)).toBeNull();
  });

  it("returns null when today is past the end of the plan", () => {
    // 18-week plan: last day = start + (18*7 - 1) = June 29 + 125 days = Nov 1, 2026
    // Day after = Nov 2, 2026
    vi.setSystemTime(new Date(2026, 10, 2)); // Nov 2 — one day after plan ends
    expect(getTodayPosition("2026-06-29", 18)).toBeNull();
  });

  it("returns position for the very last day of the plan", () => {
    // Last day = start + 18*7 - 1 = start + 125 days
    // June 29 + 125 = Oct 31... let me compute: June=1, July=32, Aug=63, Sep=94, Oct=125-1 = Oct 31
    // Actually: June 29 + 125 days:
    // June: 30-29=1 day remaining, July: 31, Aug: 31, Sep: 30, Oct: 31 -> 1+31+31+30=93 -> need 125-93=32 more -> Nov 1 + some
    // Let me just compute: June 29 + 125 = ?
    // 125 days = 4 months and a bit... let me just verify week 18 day 6
    const start = new Date(2026, 5, 29);
    const lastDay = new Date(start);
    lastDay.setDate(lastDay.getDate() + 17 * 7 + 6); // week 18, day 6
    vi.setSystemTime(lastDay);
    expect(getTodayPosition("2026-06-29", 18)).toEqual({ weekNumber: 18, dayOfWeek: 6 });
  });

  it("is not shifted by timezone — start date June 29 lands on week 1 day 0", () => {
    // Regression: if start "2026-06-29" was parsed as UTC midnight, it became
    // June 28 local in US timezones, so "today = June 29" would return day 1 not day 0.
    vi.setSystemTime(new Date(2026, 5, 29)); // local June 29
    expect(getTodayPosition("2026-06-29", 18)).toEqual({ weekNumber: 1, dayOfWeek: 0 });
  });

  it("works for a 1-week plan", () => {
    vi.setSystemTime(new Date(2026, 5, 29));
    expect(getTodayPosition("2026-06-29", 1)).toEqual({ weekNumber: 1, dayOfWeek: 0 });

    vi.setSystemTime(new Date(2026, 6, 5)); // last day of week 1
    expect(getTodayPosition("2026-06-29", 1)).toEqual({ weekNumber: 1, dayOfWeek: 6 });

    vi.setSystemTime(new Date(2026, 6, 6)); // day after plan ends
    expect(getTodayPosition("2026-06-29", 1)).toBeNull();
  });
});

// ── getWorkoutEstimate ─────────────────────────────────────────────────────────

describe("getWorkoutEstimate", () => {
  const paces: RunningPace[] = [
    { id: "1", user_id: "u", name: "easy", pace_seconds_per_mile: 540, created_at: "" },
    { id: "2", user_id: "u", name: "threshold", pace_seconds_per_mile: 420, created_at: "" },
  ];

  it("returns duration directly when duration_minutes is set", () => {
    expect(getWorkoutEstimate(5, "mi", "easy", 45, paces)).toBe("45m");
  });

  it("estimates from distance and named pace", () => {
    // 5 miles at 9:00/mi = 45 min
    expect(getWorkoutEstimate(5, "mi", "easy", null, paces)).toBe("45m");
  });

  it("returns raw distance string when pace is unknown", () => {
    expect(getWorkoutEstimate(5, "mi", "tempo", null, paces)).toBe("5 mi");
  });

  it("returns null when no distance or duration", () => {
    expect(getWorkoutEstimate(null, "mi", null, null, paces)).toBeNull();
  });

  it("converts km distance to miles for pace estimation", () => {
    // 8 km / 1.60934 ≈ 4.971 mi × 540 ≈ 2684 sec → floor(2684/60) = 44m
    const result = getWorkoutEstimate(8, "km", "easy", null, paces);
    expect(result).toBe("44m");
  });
});

// ── resolvePaceSecondsPerMile ───────────────────────────────────────────────────

// jsdom in this project's test environment doesn't provide window.localStorage,
// so stub a minimal in-memory implementation for tests that exercise getStoredUnit().
function stubLocalStorage() {
  const store: Record<string, string> = {};
  window.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    key: () => null,
    length: 0,
  } as Storage;
}

describe("resolvePaceSecondsPerMile", () => {
  const paces: RunningPace[] = [
    { id: "1", user_id: "u", name: "10K Pace", pace_seconds_per_mile: 440, created_at: "" },
    { id: "2", user_id: "u", name: "Recovery", pace_seconds_per_mile: 600, created_at: "" },
  ];

  beforeEach(() => {
    stubLocalStorage();
  });

  it("returns null for a null pace_type", () => {
    expect(resolvePaceSecondsPerMile(null, paces)).toBeNull();
  });

  it("looks up a named pace case-insensitively", () => {
    expect(resolvePaceSecondsPerMile("10k pace", paces)).toBe(440);
  });

  it("returns null for an unknown named pace", () => {
    expect(resolvePaceSecondsPerMile("tempo", paces)).toBeNull();
  });

  it("parses a custom M:SS pace as seconds/mile when unit pref is miles", () => {
    expect(resolvePaceSecondsPerMile("7:20", paces)).toBe(440);
  });

  it("converts a custom M:SS pace from seconds/km to seconds/mile when unit pref is km", () => {
    window.localStorage.setItem("unitPref", "km");
    // 7:20/km → 440 * 1.60934 ≈ 708 sec/mile
    expect(resolvePaceSecondsPerMile("7:20", paces)).toBe(Math.round(440 * 1.60934));
  });
});

// ── stepDurationSeconds ──────────────────────────────────────────────────────────

describe("stepDurationSeconds", () => {
  const paces: RunningPace[] = [
    { id: "1", user_id: "u", name: "10K Pace", pace_seconds_per_mile: 440, created_at: "" },
    { id: "2", user_id: "u", name: "Recovery", pace_seconds_per_mile: 600, created_at: "" },
  ];

  beforeEach(() => {
    stubLocalStorage();
  });

  it("prefers an explicit duration in minutes", () => {
    const step = { distance_miles: null, distance_unit: "mi", duration_minutes: 3, duration_unit: "min", pace_type: null };
    expect(stepDurationSeconds(step, paces)).toBe(180);
  });

  it("prefers an explicit duration already in seconds", () => {
    const step = { distance_miles: null, distance_unit: "mi", duration_minutes: 90, duration_unit: "sec", pace_type: null };
    expect(stepDurationSeconds(step, paces)).toBe(90);
  });

  it("derives duration from a 600m interval at 10K pace (treadmill mode example)", () => {
    const step = { distance_miles: 600, distance_unit: "m", duration_minutes: null, duration_unit: "min", pace_type: "10K Pace" };
    // 600m ≈ 0.3728mi × 440 sec/mi ≈ 164s → "2:44"
    const seconds = stepDurationSeconds(step, paces);
    expect(seconds).toBe(164);
    expect(formatPace(seconds!)).toBe("2:44");
  });

  it("derives duration from a 400m recovery interval at recovery pace", () => {
    const step = { distance_miles: 400, distance_unit: "m", duration_minutes: null, duration_unit: "min", pace_type: "Recovery" };
    const seconds = stepDurationSeconds(step, paces);
    expect(seconds).toBe(149);
    expect(formatPace(seconds!)).toBe("2:29");
  });

  it("derives duration from a custom M:SS pace_type", () => {
    const step = { distance_miles: 1, distance_unit: "mi", duration_minutes: null, duration_unit: "min", pace_type: "8:00" };
    expect(stepDurationSeconds(step, paces)).toBe(480);
  });

  it("returns null when there is no distance and no duration", () => {
    const step = { distance_miles: null, distance_unit: "mi", duration_minutes: null, duration_unit: "min", pace_type: "10K Pace" };
    expect(stepDurationSeconds(step, paces)).toBeNull();
  });

  it("returns null when distance is present but the pace can't be resolved", () => {
    const step = { distance_miles: 1, distance_unit: "mi", duration_minutes: null, duration_unit: "min", pace_type: "tempo" };
    expect(stepDurationSeconds(step, paces)).toBeNull();
  });
});

// ── defaultDayMapping ──────────────────────────────────────────────────────────

describe("defaultDayMapping", () => {
  it("returns [1,3] for 2 days per week", () => {
    expect(defaultDayMapping(2)).toEqual([1, 3]);
  });

  it("returns [0,2,4] for 3 days per week", () => {
    expect(defaultDayMapping(3)).toEqual([0, 2, 4]);
  });

  it("returns all 7 days for 7 days per week", () => {
    expect(defaultDayMapping(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("falls back to sequential days for unknown count", () => {
    expect(defaultDayMapping(1)).toEqual([0]);
  });
});
