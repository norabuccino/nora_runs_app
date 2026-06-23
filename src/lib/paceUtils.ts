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

export const DAY_NAMES = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];

export const WORKOUT_TYPE_LABELS: Record<string, string> = {
  run: "Run",
  strength: "Strength",
  rest: "Rest",
  cross_train: "Cross-Train",
  bike: "Bike",
  swim: "Swim",
  yoga: "Yoga",
  elliptical: "Elliptical",
};

export const WORKOUT_TYPE_COLORS: Record<string, string> = {
  run: "bg-[var(--badge-workout-run-bg)] text-[var(--badge-workout-run-text)]",
  strength: "bg-[var(--badge-workout-strength-bg)] text-[var(--badge-workout-strength-text)]",
  rest: "bg-[var(--badge-workout-rest-bg)] text-[var(--badge-workout-rest-text)]",
  cross_train: "bg-[var(--badge-workout-cross-train-bg)] text-[var(--badge-workout-cross-train-text)]",
  bike: "bg-[var(--badge-workout-bike-bg)] text-[var(--badge-workout-bike-text)]",
  swim: "bg-[var(--badge-workout-swim-bg)] text-[var(--badge-workout-swim-text)]",
  yoga: "bg-[var(--badge-workout-yoga-bg)] text-[var(--badge-workout-yoga-text)]",
  elliptical: "bg-[var(--badge-workout-elliptical-bg)] text-[var(--badge-workout-elliptical-text)]",
};

export const PLAN_TYPE_LABELS: Record<string, string> = {
  marathon: "Marathon",
  half_marathon: "Half Marathon",
  "5k_10k": "5K / 10K",
  base_building: "Base Building",
  strength: "Strength",
  custom: "Custom",
};

export const PLAN_TYPE_COLORS: Record<string, string> = {
  marathon: "bg-[var(--badge-plan-marathon-bg)] text-[var(--badge-plan-marathon-text)]",
  half_marathon: "bg-[var(--badge-plan-half-marathon-bg)] text-[var(--badge-plan-half-marathon-text)]",
  "5k_10k": "bg-[var(--badge-plan-5k-10k-bg)] text-[var(--badge-plan-5k-10k-text)]",
  base_building: "bg-[var(--badge-plan-base-building-bg)] text-[var(--badge-plan-base-building-text)]",
  strength: "bg-[var(--badge-plan-strength-bg)] text-[var(--badge-plan-strength-text)]",
  custom: "bg-[var(--badge-plan-custom-bg)] text-[var(--badge-plan-custom-text)]",
};

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DEFAULT_DAY_MAPPINGS: Record<number, number[]> = {
  2: [1, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};
export function defaultDayMapping(daysPerWeek: number): number[] {
  return DEFAULT_DAY_MAPPINGS[daysPerWeek] ?? Array.from({ length: daysPerWeek }, (_, i) => i);
}

export const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  intermediate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  advanced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export const RUN_TYPE_LABELS: Record<string, string> = {
  easy_run: "Easy Run",
  interval_run: "Interval Run",
  threshold_run: "Threshold Run",
  recovery_run: "Recovery Run",
  race: "Race",
  long_run: "Long Run",
  mp_hmp_run: "MP/HMP Run",
};

export const RUN_TYPE_COLORS: Record<string, string> = {
  easy_run: "bg-[var(--badge-run-easy-run-bg)] text-[var(--badge-run-easy-run-text)]",
  interval_run: "bg-[var(--badge-run-interval-run-bg)] text-[var(--badge-run-interval-run-text)]",
  threshold_run: "bg-[var(--badge-run-threshold-run-bg)] text-[var(--badge-run-threshold-run-text)]",
  recovery_run: "bg-[var(--badge-run-recovery-run-bg)] text-[var(--badge-run-recovery-run-text)]",
  race: "bg-[var(--badge-run-race-bg)] text-[var(--badge-run-race-text)]",
  long_run: "bg-[var(--badge-run-long-run-bg)] text-[var(--badge-run-long-run-text)]",
  mp_hmp_run: "bg-[var(--badge-run-mp-hmp-run-bg)] text-[var(--badge-run-mp-hmp-run-text)]",
};

export const EXERCISE_TYPE_LABELS: Record<string, string> = {
  warm_up: "Warm Up",
  stretch: "Stretch",
  lift: "Lift",
  plyos: "Plyos",
  core: "Core",
  mobility: "Mobility",
};

export const EXERCISE_TYPE_COLORS: Record<string, string> = {
  warm_up: "bg-[var(--badge-exercise-warm-up-bg)] text-[var(--badge-exercise-warm-up-text)]",
  stretch: "bg-[var(--badge-exercise-stretch-bg)] text-[var(--badge-exercise-stretch-text)]",
  lift: "bg-[var(--badge-exercise-lift-bg)] text-[var(--badge-exercise-lift-text)]",
  plyos: "bg-[var(--badge-exercise-plyos-bg)] text-[var(--badge-exercise-plyos-text)]",
  core: "bg-[var(--badge-exercise-core-bg)] text-[var(--badge-exercise-core-text)]",
  mobility: "bg-[var(--badge-exercise-mobility-bg)] text-[var(--badge-exercise-mobility-text)]",
};

export const STRENGTH_TYPE_LABELS: Record<string, string> = {
  upper_body: "Upper Body",
  lower_body: "Lower Body",
  full_body: "Full Body",
  core: "Core",
  plyometrics: "Plyometrics",
  mobility: "Mobility",
};

export const STRENGTH_TYPE_COLORS: Record<string, string> = {
  upper_body: "bg-[var(--badge-strength-upper-body-bg)] text-[var(--badge-strength-upper-body-text)]",
  lower_body: "bg-[var(--badge-strength-lower-body-bg)] text-[var(--badge-strength-lower-body-text)]",
  full_body: "bg-[var(--badge-strength-full-body-bg)] text-[var(--badge-strength-full-body-text)]",
  core: "bg-[var(--badge-strength-core-bg)] text-[var(--badge-strength-core-text)]",
  plyometrics: "bg-[var(--badge-strength-plyometrics-bg)] text-[var(--badge-strength-plyometrics-text)]",
  mobility: "bg-[var(--badge-strength-mobility-bg)] text-[var(--badge-strength-mobility-text)]",
};

export const STEP_TYPE_LABELS: Record<string, string> = {
  warmup: "Warm-up",
  main: "Main",
  interval: "Interval",
  recovery: "Recovery",
  cooldown: "Cool-down",
};
