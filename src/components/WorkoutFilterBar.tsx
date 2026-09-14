"use client";

import type { WorkoutType, RunType, StrengthType, CrossTrainType } from "@/types/database";
import { WORKOUT_TYPE_LABELS, RUN_TYPE_LABELS, STRENGTH_TYPE_LABELS, CROSS_TRAIN_TYPE_LABELS } from "@/lib/paceUtils";

export interface WorkoutFilter {
  type: WorkoutType | "all";
  runType: RunType | "all";
  strengthType: StrengthType | "all";
  crossTrainType: CrossTrainType | "all";
  source: string | "all";
}

export const DEFAULT_FILTER: WorkoutFilter = {
  type: "all",
  runType: "all",
  strengthType: "all",
  crossTrainType: "all",
  source: "all",
};

export const NO_SOURCE_SENTINEL = "__none__";

export function applyWorkoutFilter<
  T extends {
    type: string;
    run_type?: string | null;
    strength_type?: string | null;
    cross_train_type?: string | null;
    source?: string | null;
  }
>(items: T[], filter: WorkoutFilter): T[] {
  return items.filter((w) => {
    if (filter.type !== "all" && w.type !== filter.type) return false;
    if (filter.type === "run" && filter.runType !== "all" && w.run_type !== filter.runType)
      return false;
    if (filter.type === "strength" && filter.strengthType !== "all" && w.strength_type !== filter.strengthType)
      return false;
    if (filter.type === "cross_train" && filter.crossTrainType !== "all" && w.cross_train_type !== filter.crossTrainType)
      return false;
    if (filter.source === NO_SOURCE_SENTINEL && w.source) return false;
    if (filter.source !== "all" && filter.source !== NO_SOURCE_SENTINEL && (w.source ?? null) !== filter.source) return false;
    return true;
  });
}

const TYPE_PILLS: { value: WorkoutType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "run", label: WORKOUT_TYPE_LABELS.run },
  { value: "strength", label: WORKOUT_TYPE_LABELS.strength },
  { value: "bike", label: WORKOUT_TYPE_LABELS.bike },
  { value: "swim", label: WORKOUT_TYPE_LABELS.swim },
  { value: "cross_train", label: WORKOUT_TYPE_LABELS.cross_train },
  { value: "rest", label: WORKOUT_TYPE_LABELS.rest },
];

const RUN_TYPE_PILLS: { value: RunType | "all"; label: string }[] = [
  { value: "all", label: "All runs" },
  { value: "easy_run", label: RUN_TYPE_LABELS.easy_run },
  { value: "long_run", label: RUN_TYPE_LABELS.long_run },
  { value: "mp_hmp_run", label: RUN_TYPE_LABELS.mp_hmp_run },
  { value: "interval_run", label: RUN_TYPE_LABELS.interval_run },
  { value: "threshold_run", label: RUN_TYPE_LABELS.threshold_run },
  { value: "recovery_run", label: RUN_TYPE_LABELS.recovery_run },
  { value: "boost_run", label: RUN_TYPE_LABELS.boost_run },
  { value: "race", label: RUN_TYPE_LABELS.race },
];

const STRENGTH_TYPE_PILLS: { value: StrengthType | "all"; label: string }[] = [
  { value: "all", label: "All strength" },
  { value: "upper_body", label: STRENGTH_TYPE_LABELS.upper_body },
  { value: "lower_body", label: STRENGTH_TYPE_LABELS.lower_body },
  { value: "full_body", label: STRENGTH_TYPE_LABELS.full_body },
  { value: "core", label: STRENGTH_TYPE_LABELS.core },
  { value: "plyometrics", label: STRENGTH_TYPE_LABELS.plyometrics },
  { value: "mobility", label: STRENGTH_TYPE_LABELS.mobility },
];

const CROSS_TRAIN_TYPE_PILLS: { value: CrossTrainType | "all"; label: string }[] = [
  { value: "all", label: "All cross-training" },
  { value: "walk", label: CROSS_TRAIN_TYPE_LABELS.walk },
  { value: "elliptical", label: CROSS_TRAIN_TYPE_LABELS.elliptical },
  { value: "yoga", label: CROSS_TRAIN_TYPE_LABELS.yoga },
  { value: "mobility", label: CROSS_TRAIN_TYPE_LABELS.mobility },
  { value: "other", label: CROSS_TRAIN_TYPE_LABELS.other },
];

interface WorkoutFilterBarProps {
  filter: WorkoutFilter;
  onChange: (filter: WorkoutFilter) => void;
  sources?: string[];
  hasUnsourced?: boolean;
}

export function WorkoutFilterBar({ filter, onChange, sources = [], hasUnsourced = false }: WorkoutFilterBarProps) {
  function setType(type: WorkoutType | "all") {
    onChange({ ...filter, type, runType: "all", strengthType: "all", crossTrainType: "all" });
  }

  function setRunType(runType: RunType | "all") {
    onChange({ ...filter, runType });
  }

  function setStrengthType(strengthType: StrengthType | "all") {
    onChange({ ...filter, strengthType });
  }

  function setCrossTrainType(crossTrainType: CrossTrainType | "all") {
    onChange({ ...filter, crossTrainType });
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

      {filter.type === "strength" && (
        <div className="flex flex-wrap gap-1.5">
          {STRENGTH_TYPE_PILLS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStrengthType(value)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                filter.strengthType === value
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {filter.type === "cross_train" && (
        <div className="flex flex-wrap gap-1.5">
          {CROSS_TRAIN_TYPE_PILLS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setCrossTrainType(value)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                filter.crossTrainType === value
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {(sources.length > 0 || hasUnsourced) && (
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
          {hasUnsourced && (
            <button
              onClick={() => setSource(NO_SOURCE_SENTINEL)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                filter.source === NO_SOURCE_SENTINEL
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
              }`}
            >
              No source
            </button>
          )}
        </div>
      )}
    </div>
  );
}
