"use client";

import type { WorkoutType, RunType } from "@/types/database";
import { WORKOUT_TYPE_LABELS, RUN_TYPE_LABELS } from "@/lib/paceUtils";

export interface WorkoutFilter {
  type: WorkoutType | "all";
  runType: RunType | "all";
  source: string | "all";
}

export const DEFAULT_FILTER: WorkoutFilter = { type: "all", runType: "all", source: "all" };

export function applyWorkoutFilter<
  T extends { type: string; run_type?: string | null; source?: string | null }
>(items: T[], filter: WorkoutFilter): T[] {
  return items.filter((w) => {
    if (filter.type !== "all" && w.type !== filter.type) return false;
    if (filter.type === "run" && filter.runType !== "all" && w.run_type !== filter.runType)
      return false;
    if (filter.source !== "all" && (w.source ?? null) !== filter.source) return false;
    return true;
  });
}

const TYPE_PILLS: { value: WorkoutType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "run", label: WORKOUT_TYPE_LABELS.run },
  { value: "strength", label: WORKOUT_TYPE_LABELS.strength },
  { value: "bike", label: WORKOUT_TYPE_LABELS.bike },
  { value: "swim", label: WORKOUT_TYPE_LABELS.swim },
  { value: "yoga", label: WORKOUT_TYPE_LABELS.yoga },
  { value: "elliptical", label: WORKOUT_TYPE_LABELS.elliptical },
  { value: "cross_train", label: WORKOUT_TYPE_LABELS.cross_train },
  { value: "rest", label: WORKOUT_TYPE_LABELS.rest },
];

const RUN_TYPE_PILLS: { value: RunType | "all"; label: string }[] = [
  { value: "all", label: "All runs" },
  { value: "easy_run", label: RUN_TYPE_LABELS.easy_run },
  { value: "long_run", label: RUN_TYPE_LABELS.long_run },
  { value: "interval_run", label: RUN_TYPE_LABELS.interval_run },
  { value: "threshold_run", label: RUN_TYPE_LABELS.threshold_run },
  { value: "recovery_run", label: RUN_TYPE_LABELS.recovery_run },
  { value: "race", label: RUN_TYPE_LABELS.race },
];

interface WorkoutFilterBarProps {
  filter: WorkoutFilter;
  onChange: (filter: WorkoutFilter) => void;
  sources?: string[];
}

export function WorkoutFilterBar({ filter, onChange, sources = [] }: WorkoutFilterBarProps) {
  function setType(type: WorkoutType | "all") {
    onChange({ ...filter, type, runType: "all" });
  }

  function setRunType(runType: RunType | "all") {
    onChange({ ...filter, runType });
  }

  function setSource(source: string | "all") {
    onChange({ ...filter, source });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {TYPE_PILLS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setType(value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter.type === value
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filter.type === "run" && (
        <div className="flex flex-wrap gap-1.5">
          {RUN_TYPE_PILLS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRunType(value)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                filter.runType === value
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSource("all")}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              filter.source === "all"
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
            }`}
          >
            All sources
          </button>
          {sources.map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                filter.source === s
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
