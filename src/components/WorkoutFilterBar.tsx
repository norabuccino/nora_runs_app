"use client";

import type { WorkoutType, RunType, StrengthType, CrossTrainType } from "@/types/database";
import { WORKOUT_TYPE_LABELS, RUN_TYPE_LABELS, STRENGTH_TYPE_LABELS, CROSS_TRAIN_TYPE_LABELS } from "@/lib/paceUtils";
import {
  ActiveFilterChips,
  FilterPanel,
  FilterSelect,
  Pill,
  PillRow,
  activeFilterList,
  type ActiveFilter,
} from "@/components/FilterControls";

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

const RUN_TYPES: RunType[] = ["easy_run", "long_run", "mp_hmp_run", "interval_run", "threshold_run", "recovery_run", "boost_run", "race"];
const STRENGTH_TYPES: StrengthType[] = ["upper_body", "lower_body", "full_body", "core", "plyometrics", "mobility"];
const CROSS_TRAIN_TYPES: CrossTrainType[] = ["walk", "elliptical", "yoga", "mobility", "other"];

/** Filters shown as chips / counted on the Filters button (the type pills aren't counted). */
export function workoutActiveFilters(filter: WorkoutFilter, onChange: (filter: WorkoutFilter) => void): ActiveFilter[] {
  return activeFilterList([
    filter.type === "run" && filter.runType !== "all" && {
      key: "runType",
      label: RUN_TYPE_LABELS[filter.runType],
      clear: () => onChange({ ...filter, runType: "all" }),
    },
    filter.type === "strength" && filter.strengthType !== "all" && {
      key: "strengthType",
      label: STRENGTH_TYPE_LABELS[filter.strengthType],
      clear: () => onChange({ ...filter, strengthType: "all" }),
    },
    filter.type === "cross_train" && filter.crossTrainType !== "all" && {
      key: "crossTrainType",
      label: CROSS_TRAIN_TYPE_LABELS[filter.crossTrainType],
      clear: () => onChange({ ...filter, crossTrainType: "all" }),
    },
    filter.source !== "all" && {
      key: "source",
      label: filter.source === NO_SOURCE_SENTINEL ? "No source" : filter.source,
      clear: () => onChange({ ...filter, source: "all" }),
    },
  ]);
}

interface WorkoutFilterBarProps {
  filter: WorkoutFilter;
  onChange: (filter: WorkoutFilter) => void;
  sources?: string[];
  hasUnsourced?: boolean;
  /** Whether the dropdown panel (sub-type + source) is open — toggled by a FiltersButton the parent renders. */
  panelOpen: boolean;
  panelId: string;
  resultCount: number;
  /** Let the pill row bleed to the page edge on mobile (off inside modals with different padding). */
  bleed?: boolean;
}

export function WorkoutFilterBar({
  filter,
  onChange,
  sources = [],
  hasUnsourced = false,
  panelOpen,
  panelId,
  resultCount,
  bleed = true,
}: WorkoutFilterBarProps) {
  function setType(type: WorkoutType | "all") {
    onChange({ ...filter, type, runType: "all", strengthType: "all", crossTrainType: "all" });
  }

  const hasSources = sources.length > 0 || hasUnsourced;
  const active = workoutActiveFilters(filter, onChange);

  return (
    <div className="space-y-3">
      <PillRow bleed={bleed}>
        {TYPE_PILLS.map(({ value, label }) => (
          <Pill key={value} active={filter.type === value} onClick={() => setType(value)}>
            {label}
          </Pill>
        ))}
      </PillRow>

      {panelOpen && (
        <FilterPanel id={panelId}>
          {filter.type === "run" && (
            <FilterSelect label="Run type" value={filter.runType} onChange={(v) => onChange({ ...filter, runType: v as RunType | "all" })}>
              <option value="all">Any</option>
              {RUN_TYPES.map((t) => <option key={t} value={t}>{RUN_TYPE_LABELS[t]}</option>)}
            </FilterSelect>
          )}
          {filter.type === "strength" && (
            <FilterSelect
              label="Strength type"
              value={filter.strengthType}
              onChange={(v) => onChange({ ...filter, strengthType: v as StrengthType | "all" })}
            >
              <option value="all">Any</option>
              {STRENGTH_TYPES.map((t) => <option key={t} value={t}>{STRENGTH_TYPE_LABELS[t]}</option>)}
            </FilterSelect>
          )}
          {filter.type === "cross_train" && (
            <FilterSelect
              label="Cross-training type"
              value={filter.crossTrainType}
              onChange={(v) => onChange({ ...filter, crossTrainType: v as CrossTrainType | "all" })}
            >
              <option value="all">Any</option>
              {CROSS_TRAIN_TYPES.map((t) => <option key={t} value={t}>{CROSS_TRAIN_TYPE_LABELS[t]}</option>)}
            </FilterSelect>
          )}
          {hasSources && (
            <FilterSelect label="Source" value={filter.source} onChange={(v) => onChange({ ...filter, source: v })}>
              <option value="all">Any</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
              {hasUnsourced && <option value={NO_SOURCE_SENTINEL}>No source</option>}
            </FilterSelect>
          )}
          {!["run", "strength", "cross_train"].includes(filter.type) && (
            <p className="col-span-2 sm:col-span-2 self-end pb-1.5 text-xs text-[var(--muted)]">
              Pick Run, Strength or Cross-train above to filter by its sub-type.
            </p>
          )}
        </FilterPanel>
      )}

      <ActiveFilterChips
        count={resultCount}
        noun={["workout", "workouts"]}
        filters={active}
        onClearAll={() => onChange({ ...filter, runType: "all", strengthType: "all", crossTrainType: "all", source: "all" })}
      />
    </div>
  );
}
