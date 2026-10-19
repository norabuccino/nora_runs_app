// How /progression derives its trend and suggestion columns, and the icons it
// shows for each suggestion. Shown as a legend under the table and on
// /reference — keep the text in step with computeTrend / computeRecommendation
// in strengthProgression.ts.

import type { RecommendationStatus } from "@/lib/strengthProgression";

export interface SuggestionIndicator {
  icon: string;
  label: string;
  /** Tailwind text color classes. */
  color: string;
  meaning: string;
}

export const SUGGESTION_INDICATORS: Record<RecommendationStatus, SuggestionIndicator> = {
  increase: {
    icon: "↑",
    label: "Increase",
    color: "text-green-600 dark:text-green-400",
    meaning:
      "Every completed set in your latest session hit the planned reps (or planned hold time). The suggested load is your current load plus the exercise's default increment — the next band up for bands, and less assistance (never below 0) for assisted machines. With no default increment set, it just says to go up.",
  },
  build_reps: {
    icon: "+",
    label: "Build reps",
    color: "text-[var(--accent)]",
    meaning:
      "At least one set fell short of the target, at the same load as the session before. Stay at this load and add reps until every set hits the target.",
  },
  hold: {
    icon: "=",
    label: "Hold",
    color: "text-[var(--muted)]",
    meaning:
      "At least one set fell short of the target, and the load is new (it changed since last time, or this is the first session). Repeat it before deciding.",
  },
  none: {
    icon: "—",
    label: "No suggestion",
    color: "text-[var(--muted)]",
    meaning: "The workout has no planned reps or hold time to compare against, or nothing was logged with a load.",
  },
};

/** Order suggestions appear in legends. */
export const SUGGESTION_ORDER: RecommendationStatus[] = ["increase", "build_reps", "hold", "none"];

export const PROGRESSION_BASICS: { term: string; meaning: string }[] = [
  {
    term: "Current load",
    meaning: "The load on the last logged set of your most recent completed session. No 1-rep-max or PR estimates.",
  },
  {
    term: "Previous load",
    meaning: "The same thing for the completed session before that.",
  },
  {
    term: "Trend",
    meaning:
      "Current vs. previous load: ↑ is progress (heavier, or less assistance on an assisted machine), ↓ is lighter, → is the same. No trend is shown across a switch to or from the assisted load format.",
  },
  {
    term: "Suggestion",
    meaning:
      "Compares your latest session's sets with the workout's planned reps or hold time. Suggestions are display-only — they never change a workout's prescription.",
  },
];
