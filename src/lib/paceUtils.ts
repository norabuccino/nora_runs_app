import type { RunningPace, PaceType } from "@/types/database";

export function formatPace(secondsPerMile: number): string {
  const minutes = Math.floor(secondsPerMile / 60);
  const seconds = secondsPerMile % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function parsePace(paceString: string): number | null {
  const parts = paceString.split(":");
  if (parts.length !== 2) return null;
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  if (isNaN(minutes) || isNaN(seconds) || seconds >= 60) return null;
  return minutes * 60 + seconds;
}

export function estimateDuration(distanceMiles: number, paceSecondsPerMile: number): string {
  const totalSeconds = Math.round(distanceMiles * paceSecondsPerMile);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function findPaceForType(
  paces: RunningPace[],
  paceType: PaceType
): RunningPace | undefined {
  return paces.find((p) => p.name.toLowerCase() === paceType.toLowerCase());
}

export function getWorkoutEstimate(
  distance: number | null,
  distanceUnit: string,
  paceType: PaceType | null,
  durationMinutes: number | null,
  paces: RunningPace[]
): string | null {
  if (durationMinutes) return `~${durationMinutes}m`;
  // Convert to miles for duration estimation (paces stored as sec/mile)
  const KM_PER_MI = 1.60934;
  const M_PER_MI = 1609.34;
  const distanceMiles = distance
    ? distanceUnit === "km" ? distance / KM_PER_MI
    : distanceUnit === "m" ? distance / M_PER_MI
    : distance
    : null;
  if (distanceMiles && paceType) {
    const pace = findPaceForType(paces, paceType);
    if (pace) return estimateDuration(distanceMiles, pace.pace_seconds_per_mile);
  }
  if (distance) return `${distance} ${distanceUnit ?? "mi"}`;
  return null;
}

// Given a user_plan start_date and today's date, return which week/day we're on.
// Returns null if today is before start_date or past the plan's total_weeks.
export function getTodayPosition(
  startDate: string,
  totalWeeks: number
): { weekNumber: number; dayOfWeek: number } | null {
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);

  const daysElapsed = Math.floor((today.getTime() - start.getTime()) / 86400000);
  if (daysElapsed < 0) return null;

  const weekNumber = Math.floor(daysElapsed / 7) + 1;
  const dayOfWeek = daysElapsed % 7;

  if (weekNumber > totalWeeks) return null;
  return { weekNumber, dayOfWeek };
}

// Compute the calendar date for a given week/day slot in a plan.
export function scheduledDate(startDate: string, weekNumber: number, dayOfWeek: number): string {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const offset = (weekNumber - 1) * 7 + dayOfWeek;
  start.setDate(start.getDate() + offset);
  return start.toISOString().split("T")[0];
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const WORKOUT_TYPE_LABELS: Record<string, string> = {
  run: "Run",
  strength: "Strength",
  rest: "Rest",
  cross_train: "Cross-Train",
};

export const WORKOUT_TYPE_COLORS: Record<string, string> = {
  run: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  strength: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  rest: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  cross_train: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export const PLAN_TYPE_LABELS: Record<string, string> = {
  marathon: "Marathon",
  half_marathon: "Half Marathon",
  strength: "Strength",
  custom: "Custom",
};

export const RUN_TYPE_LABELS: Record<string, string> = {
  easy_run: "Easy Run",
  tempo_run: "Tempo Run",
  interval_run: "Interval Run",
  threshold_run: "Threshold Run",
  recovery_run: "Recovery Run",
  race: "Race",
  long_run: "Long Run",
};

export const STEP_TYPE_LABELS: Record<string, string> = {
  warmup: "Warm-up",
  main: "Main",
  interval: "Interval",
  recovery: "Recovery",
  cooldown: "Cool-down",
};
