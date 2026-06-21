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
  run: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  strength: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  rest: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  cross_train: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  bike: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  swim: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  yoga: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  elliptical: "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200",
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
  marathon: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  half_marathon: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "5k_10k": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  base_building: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  strength: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  custom: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
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
  easy_run: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  interval_run: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  threshold_run: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  recovery_run: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  race: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  long_run: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  mp_hmp_run: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

export const EXERCISE_TYPE_LABELS: Record<string, string> = {
  warm_up: "Warm Up",
  stretch: "Stretch",
  lift: "Lift",
  mobility: "Mobility",
};

// Colors distinct from all workout_type and run_type colors.
// Tailwind has 22 color families for 25 label slots; the 3 unavoidable overlaps
// land only between exercise_type and run_type, which never appear on the same card.
export const EXERCISE_TYPE_COLORS: Record<string, string> = {
  warm_up: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
  stretch: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  lift: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  mobility: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export const STRENGTH_TYPE_LABELS: Record<string, string> = {
  upper_body: "Upper Body",
  lower_body: "Lower Body",
  full_body: "Full Body",
  core: "Core",
  plyometrics: "Plyometrics",
  mobility: "Mobility",
};

// All distinct from workout_type (blue/orange/gray/teal/cyan/sky/violet/lime)
// and from run_type (green/red/amber/purple/pink/indigo/yellow).
export const STRENGTH_TYPE_COLORS: Record<string, string> = {
  upper_body: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  lower_body: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  full_body: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200",
  core: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  plyometrics: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  mobility: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export const STEP_TYPE_LABELS: Record<string, string> = {
  warmup: "Warm-up",
  main: "Main",
  interval: "Interval",
  recovery: "Recovery",
  cooldown: "Cool-down",
};
