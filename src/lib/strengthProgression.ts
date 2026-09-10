import type { WorkoutSetLog } from "@/types/database";

/**
 * Turns a raw weight number + load format into unambiguous display text —
 * the single place that decides whether "30" means 30 lb total or two
 * 30-lb dumbbells.
 */
export function formatLoad(weight: number | null, loadFormat: string | null): string | null {
  if (weight == null) return loadFormat === "bodyweight" ? "Bodyweight" : null;
  switch (loadFormat) {
    case "per_hand":
      return `${weight} lb/hand`;
    case "per_side":
      return `${weight} lb/side`;
    case "bodyweight":
      return "Bodyweight";
    case "bodyweight_plus":
      return `Bodyweight + ${weight} lb`;
    case "barbell_total":
      return `${weight} lb (bar total)`;
    case "machine":
      return `${weight} lb (machine)`;
    case "band":
      return `Band level ${weight}`;
    case "total":
    case "single_db_kb":
    case "other":
    default:
      return `${weight} lb`;
  }
}

/**
 * "Current load" for an exercise = the weight of the last logged set in the
 * most recent completed session for that exercise. Deliberately simple —
 * no 1RM/PR estimation.
 */
export function deriveCurrentLoad(sets: WorkoutSetLog[] | null | undefined): number | null {
  if (!sets || sets.length === 0) return null;
  const completed = [...sets].filter((s) => s.completed).sort((a, b) => a.set_number - b.set_number);
  if (completed.length === 0) return null;
  return completed[completed.length - 1].weight;
}

export type Trend = "up" | "down" | "same";

export function computeTrend(current: number | null, previous: number | null): Trend | null {
  if (current == null || previous == null) return null;
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "same";
}

export type RecommendationStatus = "hold" | "increase" | "build_reps" | "none";

export interface Recommendation {
  status: RecommendationStatus;
  suggestedWeight?: number;
}

export interface RecommendationInput {
  plannedReps: number | null;
  plannedDurationSeconds: number | null;
  sets: WorkoutSetLog[];
  currentWeight: number | null;
  previousWeight: number | null;
  defaultIncrement: number | null;
}

/**
 * Simple, transparent, conservative — never writes back to any stored
 * prescription or weight. Just a suggestion.
 */
export function computeRecommendation({
  plannedReps,
  plannedDurationSeconds,
  sets,
  currentWeight,
  previousWeight,
  defaultIncrement,
}: RecommendationInput): Recommendation {
  const completedSets = sets.filter((s) => s.completed);
  if (completedSets.length === 0 || currentWeight == null) return { status: "none" };

  let metTarget: boolean | null = null;
  if (plannedReps != null) {
    metTarget = completedSets.every((s) => (s.reps_completed ?? 0) >= plannedReps);
  } else if (plannedDurationSeconds != null) {
    metTarget = completedSets.every((s) => (s.duration_seconds ?? 0) >= plannedDurationSeconds);
  }

  if (metTarget === null) return { status: "none" };

  if (metTarget) {
    return {
      status: "increase",
      suggestedWeight: defaultIncrement != null ? currentWeight + defaultIncrement : undefined,
    };
  }

  if (previousWeight != null && previousWeight === currentWeight) {
    return { status: "build_reps" };
  }

  return { status: "hold" };
}
