"use client";

import { useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { WorkoutType, RunType, CrossTrainType, WorkoutWithSteps, RunningPace } from "@/types/database";
import { DAY_NAMES, STEP_TYPE_LABELS, STRENGTH_TYPE_LABELS, STROKE_LABELS, BIKE_LOCATION_LABELS, CROSS_TRAIN_TYPE_LABELS, parsePace } from "@/lib/paceUtils";
import { type DistanceUnit, convertDistance, getStoredUnit, formatPaceForUnit } from "@/lib/unitUtils";
import { createPace } from "@/app/actions/paces";
import { splitSetWeights, resizeSetWeights, joinSetWeights } from "@/lib/workoutSteps";
import { ExercisePickerModal, type ExercisePickResult } from "@/components/ExercisePickerModal";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkoutStepFormRow {
  step_type: string;
  label: string;
  pace_type: string;
  duration_minutes: string;
  duration_unit: "min" | "sec";
  distance_miles: string;
  distance_unit: DistanceUnit;
  notes: string;
  repeat_group_id: number | null;
  repeat_count: number;
  exercise_id: string;
  group_name: string;
  sets: string;
  reps: string;
  weight_suggestion: string;
  video_url: string;
  both_sides: boolean;
  stroke_style: string;
}

export type StringStepKey =
  | "step_type"
  | "label"
  | "pace_type"
  | "duration_minutes"
  | "distance_miles"
  | "notes"
  | "sets"
  | "reps"
  | "weight_suggestion"
  | "video_url"
  | "stroke_style";

export interface WorkoutFormData {
  plan_id?: string;
  week_number?: number;
  day_of_week?: number;
  scheduled_date?: string;
  type: WorkoutType;
  run_type: RunType | "";
  strength_type: string;
  title: string;
  description: string;
  distance_miles: string;
  distance_unit: "mi" | "km";
  pace_type: string;
  duration_minutes: string;
  notes: string;
  sort_order: number;
  steps: WorkoutStepFormRow[];
  saveToLibrary?: boolean;
  bike_location: "indoor" | "outdoor" | "";
  cross_train_type: CrossTrainType | "";
  continuous_timers: boolean;
}

// ── Segment helpers ────────────────────────────────────────────────────────────

type RenderSegment =
  | { type: "step"; index: number }
  | { type: "group"; groupId: number; repeatCount: number; indices: number[] };

export function buildSegments(steps: WorkoutStepFormRow[]): RenderSegment[] {
  const segments: RenderSegment[] = [];
  let i = 0;
  while (i < steps.length) {
    const gid = steps[i].repeat_group_id;
    if (gid === null) {
      segments.push({ type: "step", index: i });
      i++;
    } else {
      const indices: number[] = [];
      while (i < steps.length && steps[i].repeat_group_id === gid) {
        indices.push(i);
        i++;
      }
      segments.push({
        type: "group",
        groupId: gid,
        repeatCount: steps[indices[0]].repeat_count,
        indices,
      });
    }
  }
  return segments;
}

function segmentId(seg: RenderSegment): string {
  return seg.type === "step" ? `step-${seg.index}` : `group-${seg.groupId}`;
}

const CUSTOM_PACE_RE = /^\d+:\d{2}$/;

function customPaceToSecPerMile(paceStr: string): number | null {
  const parsed = parsePace(paceStr);
  if (!parsed) return null;
  const unit = getStoredUnit();
  return unit === "km" ? Math.round(parsed * 1.60934) : parsed;
}

// Distance in miles for a single step, using pace to fill in when distance is absent
export function computeStepDistanceMi(step: WorkoutStepFormRow, paces: RunningPace[]): number {
  const d = parseFloat(step.distance_miles);
  if (!isNaN(d) && d > 0) return convertDistance(d, step.distance_unit, "mi");
  if (step.pace_type) {
    const dur = parseFloat(step.duration_minutes);
    const durSec = !isNaN(dur) && dur > 0
      ? (step.duration_unit === "sec" ? dur : dur * 60)
      : 0;
    if (durSec > 0) {
      if (CUSTOM_PACE_RE.test(step.pace_type)) {
        const secPerMile = customPaceToSecPerMile(step.pace_type);
        if (secPerMile) return durSec / secPerMile;
      } else {
        const pace = paces.find((p) => p.name.toLowerCase() === step.pace_type.toLowerCase());
        if (pace) return durSec / pace.pace_seconds_per_mile;
      }
    }
  }
  return 0;
}

// Duration in minutes for a single step, using pace to fill in when duration is absent
export function computeStepDurationMin(step: WorkoutStepFormRow, paces: RunningPace[]): number {
  const dur = parseFloat(step.duration_minutes);
  if (!isNaN(dur) && dur > 0) return step.duration_unit === "sec" ? dur / 60 : dur;
  if (step.pace_type) {
    const d = parseFloat(step.distance_miles);
    if (!isNaN(d) && d > 0) {
      const distMi = convertDistance(d, step.distance_unit, "mi");
      if (CUSTOM_PACE_RE.test(step.pace_type)) {
        const secPerMile = customPaceToSecPerMile(step.pace_type);
        if (secPerMile) return (distMi * secPerMile) / 60;
      } else {
        const pace = paces.find((p) => p.name.toLowerCase() === step.pace_type.toLowerCase());
        if (pace) return (distMi * pace.pace_seconds_per_mile) / 60;
      }
    }
  }
  return 0;
}

function blankStep(
  groupId: number | null = null,
  repeatCount = 1,
  unit: DistanceUnit = getStoredUnit(),
  groupName = ""
): WorkoutStepFormRow {
  return {
    step_type: "main",
    label: "",
    pace_type: "",
    duration_minutes: "",
    duration_unit: "min",
    distance_miles: "",
    distance_unit: unit,
    notes: "",
    repeat_group_id: groupId,
    repeat_count: repeatCount,
    group_name: groupName,
    exercise_id: "",
    sets: groupId === null ? "1" : "",
    reps: "",
    weight_suggestion: "",
    video_url: "",
    both_sides: false,
    stroke_style: "",
  };
}

// ── Grip icon ─────────────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" className="shrink-0">
      <circle cx="3" cy="2.5" r="1.5" />
      <circle cx="7" cy="2.5" r="1.5" />
      <circle cx="3" cy="7" r="1.5" />
      <circle cx="7" cy="7" r="1.5" />
      <circle cx="3" cy="11.5" r="1.5" />
      <circle cx="7" cy="11.5" r="1.5" />
    </svg>
  );
}

// ── Unit toggle ───────────────────────────────────────────────────────────────

function UnitToggle<T extends string>({
  units,
  active,
  onChange,
  vertical = false,
}: {
  units: T[];
  active: T;
  onChange: (u: T) => void;
  vertical?: boolean;
}) {
  return (
    <div
      className={`${vertical ? "flex-col" : "flex"} flex rounded border border-[var(--border)] overflow-hidden shrink-0`}
      style={{ fontSize: "10px" }}
    >
      {units.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className={`px-1.5 leading-none transition-colors ${vertical ? "py-1" : "py-0.5"} ${
            active === u
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "bg-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

// ── SortableStepCard ──────────────────────────────────────────────────────────

interface StepCardProps {
  id: string;
  step: WorkoutStepFormRow;
  actualIndex: number;
  label: string;
  isStrength?: boolean;
  isSwim?: boolean;
  showSets?: boolean;
  paces: RunningPace[];
  onRemove: (i: number) => void;
  onUpdate: (i: number, key: StringStepKey, val: string) => void;
  onToggleBothSides: (i: number) => void;
  onSwitchUnit: (i: number, unit: DistanceUnit) => void;
  onSwitchDurationUnit: (i: number, unit: "min" | "sec") => void;
  onCreatePace: (name: string, secondsPerMile: number) => Promise<RunningPace>;
  onOpenPicker?: (stepIndex: number) => void;
  inputClass: string;
  labelClass: string;
}

export function SortableStepCard({
  id,
  step,
  actualIndex,
  label,
  isStrength = false,
  isSwim = false,
  showSets = false,
  paces,
  onRemove,
  onUpdate,
  onToggleBothSides,
  onSwitchUnit,
  onSwitchDurationUnit,
  onCreatePace,
  onOpenPicker,
  inputClass,
  labelClass,
}: StepCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const [addingPace, setAddingPace] = useState(false);
  const [newPaceName, setNewPaceName] = useState("");
  const [newPaceStr, setNewPaceStr] = useState("");
  const [paceError, setPaceError] = useState<string | null>(null);
  const [paceSaving, setPaceSaving] = useState(false);
  const [customPaceMode, setCustomPaceMode] = useState(() => /^\d+:\d{2}$/.test(step.pace_type));
  const [repTimeMode, setRepTimeMode] = useState<"reps" | "time">(() =>
    step.duration_minutes !== "" ? "time" : "reps"
  );
  const [showVideoInput, setShowVideoInput] = useState(() => step.video_url !== "");
  // Suggested weight is stored as one string; a comma-separated list means "one value per set".
  const [perSetWeights, setPerSetWeights] = useState(() => step.weight_suggestion.includes(","));
  // Local copy of the per-set entries so trailing spaces survive while typing (the stored string is trimmed).
  const [weightSlots, setWeightSlots] = useState<string[]>(() =>
    step.weight_suggestion.includes(",") ? step.weight_suggestion.split(",").map((p) => p.trim()) : []
  );

  function switchToCustom() {
    if (!/^\d+:\d{2}$/.test(step.pace_type)) onUpdate(actualIndex, "pace_type", "");
    setCustomPaceMode(true);
    setAddingPace(false);
  }

  function switchToSaved() {
    if (/^\d+:\d{2}$/.test(step.pace_type)) onUpdate(actualIndex, "pace_type", "");
    setCustomPaceMode(false);
  }

  async function handleSavePace() {
    if (!newPaceName.trim()) { setPaceError("Name required"); return; }
    const parsed = parsePace(newPaceStr.trim());
    if (!parsed) { setPaceError("Use MM:SS format"); return; }
    const unit = getStoredUnit();
    const secondsPerMile = unit === "km" ? Math.round(parsed * 1.60934) : parsed;
    setPaceSaving(true);
    setPaceError(null);
    try {
      const created = await onCreatePace(newPaceName.trim(), secondsPerMile);
      onUpdate(actualIndex, "pace_type", created.name);
      setAddingPace(false);
      setNewPaceName("");
      setNewPaceStr("");
    } catch (e) {
      setPaceError(e instanceof Error ? e.message : "Failed to save pace");
    }
    setPaceSaving(false);
  }

  const ci =
    "rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

  const unit = getStoredUnit();

  // ── Strength step layout ───────────────────────────────────────────────────
  if (isStrength) {
    const hasExercise = !!(step.exercise_id || step.label);

    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        <div className="rounded-lg border border-[var(--border)] p-2 space-y-1.5 bg-[var(--card)]">
          {/* Row 1: grip · exercise name/picker · × */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              {...listeners}
              className="text-[var(--muted)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing touch-none flex items-center shrink-0"
              aria-label="Drag to reorder"
            >
              <GripIcon />
            </button>

            {step.exercise_id ? (
              // Library exercise — show name + Change button
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-xs font-medium truncate flex-1">{step.label || "Exercise"}</span>
                <button
                  type="button"
                  onClick={() => onOpenPicker?.(actualIndex)}
                  className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Change
                </button>
              </div>
            ) : step.label ? (
              // Inline exercise (backward compat) — text input + library shortcut
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="Exercise name"
                  value={step.label}
                  onChange={(e) => onUpdate(actualIndex, "label", e.target.value)}
                  className={`${ci} flex-1 min-w-0`}
                />
                <button
                  type="button"
                  onClick={() => onOpenPicker?.(actualIndex)}
                  className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors whitespace-nowrap"
                >
                  Library
                </button>
              </div>
            ) : (
              // Empty — prompt to select
              <button
                type="button"
                onClick={() => onOpenPicker?.(actualIndex)}
                className="flex-1 rounded border border-dashed border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] text-left transition-colors"
              >
                Select exercise…
              </button>
            )}

            <button
              type="button"
              onClick={() => onRemove(actualIndex)}
              className="shrink-0 text-sm leading-none text-[var(--muted)] hover:text-red-500 transition-colors"
              aria-label="Remove exercise"
            >
              ×
            </button>
          </div>

          {/* Rows 2–4 only shown once an exercise is named */}
          {hasExercise && (
            <>
              {/* Row 2: sets × reps/time · both sides */}
              <div className="flex items-center gap-1.5">
                {(step.repeat_group_id === null || showSets) && (
                  <>
                    <input
                      type="number"
                      min="1"
                      placeholder="Sets"
                      value={step.sets}
                      onChange={(e) => onUpdate(actualIndex, "sets", e.target.value)}
                      className={`${ci} w-14 shrink-0`}
                    />
                    <span className="text-xs text-[var(--muted)] shrink-0">×</span>
                  </>
                )}
                <UnitToggle
                  units={["reps", "time"] as ("reps" | "time")[]}
                  active={repTimeMode}
                  onChange={(mode) => {
                    if (mode === "reps") {
                      onUpdate(actualIndex, "duration_minutes", "");
                      setRepTimeMode("reps");
                    } else {
                      onUpdate(actualIndex, "reps", "");
                      if (isStrength) onSwitchDurationUnit(actualIndex, "sec");
                      setRepTimeMode("time");
                    }
                  }}
                />
                {repTimeMode === "reps" ? (
                  <input
                    type="number"
                    min="1"
                    placeholder="Reps"
                    value={step.reps}
                    onChange={(e) => onUpdate(actualIndex, "reps", e.target.value)}
                    className={`${ci} w-14`}
                  />
                ) : (
                  <>
                    <input
                      type="number"
                      min="0"
                      step={step.duration_unit === "sec" ? "1" : "0.5"}
                      placeholder={step.duration_unit}
                      value={step.duration_minutes}
                      onChange={(e) => onUpdate(actualIndex, "duration_minutes", e.target.value)}
                      className={`${ci} w-14`}
                    />
                    <UnitToggle
                      units={["min", "sec"]}
                      active={step.duration_unit}
                      onChange={(u) => onSwitchDurationUnit(actualIndex, u)}
                    />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onToggleBothSides(actualIndex)}
                  className={`shrink-0 px-2 py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap ${
                    step.both_sides
                      ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
                  }`}
                >
                  Both sides
                </button>
              </div>

              {/* Row 3: weight suggestion — one value, or one per set */}
              {(() => {
                const setCount =
                  step.repeat_group_id === null || showSets
                    ? Math.max(parseInt(step.sets, 10) || 1, 1)
                    : Math.max(step.repeat_count || 1, 1);
                const canSplit = setCount > 1;
                const bySet = perSetWeights && canSplit;
                const slots = resizeSetWeights(weightSlots, setCount);

                function toggleBySet() {
                  if (bySet) {
                    onUpdate(actualIndex, "weight_suggestion", slots[0]?.trim() ?? "");
                    setPerSetWeights(false);
                  } else {
                    const next = splitSetWeights(step.weight_suggestion, setCount);
                    setWeightSlots(next);
                    onUpdate(actualIndex, "weight_suggestion", joinSetWeights(next));
                    setPerSetWeights(true);
                  }
                }

                function updateSlot(i: number, value: string) {
                  const next = [...slots];
                  next[i] = value;
                  setWeightSlots(next);
                  onUpdate(actualIndex, "weight_suggestion", joinSetWeights(next));
                }

                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      {bySet ? (
                        <span className="flex-1 text-xs text-[var(--muted)]">Suggested weight per set</span>
                      ) : (
                        <input
                          type="text"
                          placeholder="Suggested weight (e.g. 135 lbs, bodyweight)"
                          value={step.weight_suggestion}
                          onChange={(e) => onUpdate(actualIndex, "weight_suggestion", e.target.value)}
                          className={`${ci} flex-1 min-w-0`}
                        />
                      )}
                      {canSplit && (
                        <button
                          type="button"
                          onClick={toggleBySet}
                          aria-pressed={bySet}
                          className={`shrink-0 px-2 py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap ${
                            bySet
                              ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                              : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
                          }`}
                        >
                          By set
                        </button>
                      )}
                    </div>
                    {bySet && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {slots.map((value, i) => (
                          <label key={i} className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs text-[var(--muted)] shrink-0 w-9">Set {i + 1}</span>
                            <input
                              type="text"
                              placeholder="e.g. BW"
                              value={value}
                              onChange={(e) => updateSlot(i, e.target.value)}
                              className={`${ci} flex-1 min-w-0`}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Row 4: notes */}
              <input
                type="text"
                placeholder="Notes (optional)"
                value={step.notes}
                onChange={(e) => onUpdate(actualIndex, "notes", e.target.value)}
                className={`${ci} w-full`}
              />

              {/* Row 5: video link — only for inline exercises */}
              {!step.exercise_id && (
                showVideoInput ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="url"
                      placeholder="Video URL"
                      value={step.video_url}
                      onChange={(e) => onUpdate(actualIndex, "video_url", e.target.value)}
                      className={`${ci} flex-1 min-w-0`}
                    />
                    <button
                      type="button"
                      onClick={() => { onUpdate(actualIndex, "video_url", ""); setShowVideoInput(false); }}
                      className="shrink-0 text-sm leading-none text-[var(--muted)] hover:text-red-500 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowVideoInput(true)}
                    className="text-xs text-[var(--accent)] hover:underline text-left"
                  >
                    + Add video link
                  </button>
                )
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Swim interval step layout ────────────────────────────────────────────
  if (isSwim) {
    const isRecovery = step.step_type === "recovery";
    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        <div className="rounded-lg border border-[var(--border)] p-2 space-y-1.5 bg-[var(--card)]">
          {/* Row 1: grip · step type · × */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              {...listeners}
              className="text-[var(--muted)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing touch-none flex items-center shrink-0"
              aria-label="Drag to reorder"
            >
              <GripIcon />
            </button>
            <select
              value={step.step_type}
              onChange={(e) => onUpdate(actualIndex, "step_type", e.target.value)}
              className={`${ci} flex-1 min-w-0`}
            >
              {Object.entries(STEP_TYPE_LABELS).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onRemove(actualIndex)}
              className="shrink-0 text-sm leading-none text-[var(--muted)] hover:text-red-500 transition-colors"
              aria-label="Remove step"
            >
              ×
            </button>
          </div>

          {/* Row 2: distance (yd) · stroke */}
          {!isRecovery && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                step="25"
                placeholder="dist"
                value={step.distance_miles}
                onChange={(e) => onUpdate(actualIndex, "distance_miles", e.target.value)}
                className={`${ci} flex-1 min-w-0`}
              />
              <span className="text-xs text-[var(--muted)] shrink-0">yd</span>
              <select
                value={step.stroke_style}
                onChange={(e) => onUpdate(actualIndex, "stroke_style", e.target.value)}
                className={`${ci} flex-1 min-w-0`}
              >
                <option value="">Stroke: any</option>
                {Object.entries(STROKE_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl}</option>
                ))}
              </select>
            </div>
          )}

          {/* Row 3: duration — "on" interval time for a swim step, rest time for Recovery */}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              step={step.duration_unit === "sec" ? "1" : "0.5"}
              placeholder={isRecovery ? "rest" : "on (e.g. 2:00)"}
              value={step.duration_minutes}
              onChange={(e) => onUpdate(actualIndex, "duration_minutes", e.target.value)}
              className={`${ci} flex-1 min-w-0`}
            />
            <UnitToggle
              units={["min", "sec"]}
              active={step.duration_unit}
              onChange={(u) => onSwitchDurationUnit(actualIndex, u)}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Run / default step layout ──────────────────────────────────────────────
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="rounded-lg border border-[var(--border)] p-2 space-y-1.5 bg-[var(--card)]">
        {/* Row 1: grip · step type · × */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            {...listeners}
            className="text-[var(--muted)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing touch-none flex items-center shrink-0"
            aria-label="Drag to reorder"
          >
            <GripIcon />
          </button>
          <select
            value={step.step_type}
            onChange={(e) => onUpdate(actualIndex, "step_type", e.target.value)}
            className={`${ci} flex-1 min-w-0`}
          >
            {Object.entries(STEP_TYPE_LABELS).map(([val, lbl]) => (
              <option key={val} value={val}>{lbl}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onRemove(actualIndex)}
            className="shrink-0 text-sm leading-none text-[var(--muted)] hover:text-red-500 transition-colors"
            aria-label="Remove step"
          >
            ×
          </button>
        </div>

        {/* Row 2: pace (saved or custom) */}
        <div className="flex items-center gap-1">
          {customPaceMode ? (
            <input
              type="text"
              placeholder="MM:SS"
              value={step.pace_type}
              onChange={(e) => onUpdate(actualIndex, "pace_type", e.target.value)}
              className={`${ci} flex-1 min-w-0 font-mono`}
            />
          ) : (
            <select
              value={step.pace_type}
              onChange={(e) => onUpdate(actualIndex, "pace_type", e.target.value)}
              className={`${ci} flex-1 min-w-0`}
            >
              <option value="">Pace: none</option>
              {paces.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name} · {formatPaceForUnit(p.pace_seconds_per_mile, unit)}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={customPaceMode ? switchToSaved : switchToCustom}
            className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--foreground)] leading-none whitespace-nowrap"
          >
            {customPaceMode ? "Saved" : "Custom"}
          </button>
          {!customPaceMode && (
            <button
              type="button"
              onClick={() => { setAddingPace((v) => !v); setPaceError(null); }}
              className="shrink-0 text-xs text-[var(--accent)] hover:underline leading-none"
            >
              + New
            </button>
          )}
        </div>

        {/* Inline pace creation */}
        {addingPace && (
          <div className="rounded border border-[var(--accent)] p-1.5 space-y-1">
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Name (e.g. Marathon)"
                value={newPaceName}
                onChange={(e) => setNewPaceName(e.target.value)}
                className={`${ci} flex-1 min-w-0`}
              />
              <input
                type="text"
                placeholder={`MM:SS /${unit}`}
                value={newPaceStr}
                onChange={(e) => setNewPaceStr(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSavePace(); } }}
                className={`${ci} w-20 font-mono`}
              />
              <button
                type="button"
                onClick={handleSavePace}
                disabled={paceSaving}
                className="shrink-0 text-xs text-[var(--accent)] hover:underline disabled:opacity-50"
              >
                {paceSaving ? "…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => { setAddingPace(false); setPaceError(null); }}
                className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                ×
              </button>
            </div>
            {paceError && <p className="text-xs text-red-500">{paceError}</p>}
          </div>
        )}

        {/* Row 3: duration + min/sec toggle · distance + dist unit toggle */}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min="0"
            step={step.duration_unit === "sec" ? "1" : "0.5"}
            placeholder={step.duration_unit}
            value={step.duration_minutes}
            onChange={(e) => onUpdate(actualIndex, "duration_minutes", e.target.value)}
            className={`${ci} flex-1 min-w-0`}
          />
          <UnitToggle
            units={["min", "sec"]}
            active={step.duration_unit}
            onChange={(u) => onSwitchDurationUnit(actualIndex, u)}
          />
          <input
            type="number"
            min="0"
            step={step.distance_unit === "m" ? "10" : "0.1"}
            placeholder="dist"
            value={step.distance_miles}
            onChange={(e) => onUpdate(actualIndex, "distance_miles", e.target.value)}
            className={`${ci} flex-1 min-w-0`}
          />
          <UnitToggle
            units={["mi", "km", "m"]}
            active={step.distance_unit}
            onChange={(u) => onSwitchUnit(actualIndex, u)}
          />
        </div>
      </div>
    </div>
  );
}

// ── SortableGroupContainer ────────────────────────────────────────────────────

interface GroupContainerProps {
  id: string;
  groupId: number;
  repeatCount: number;
  groupName: string;
  indices: number[];
  steps: WorkoutStepFormRow[];
  isStrength?: boolean;
  isSwim?: boolean;
  perExerciseSets?: boolean;
  paces: RunningPace[];
  onUpdateRepeatCount: (groupId: number, count: number) => void;
  onUpdateGroupName: (groupId: number, name: string) => void;
  onTogglePerExerciseSets?: (groupId: number) => void;
  onUngroup: (groupId: number) => void;
  onAddStepToGroup: (groupId: number) => void;
  onOpenPicker?: (stepIndex: number) => void;
  onGroupDragEnd: (event: DragEndEvent) => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, key: StringStepKey, val: string) => void;
  onToggleBothSides: (i: number) => void;
  onSwitchUnit: (i: number, unit: DistanceUnit) => void;
  onSwitchDurationUnit: (i: number, unit: "min" | "sec") => void;
  onCreatePace: (name: string, secondsPerMile: number) => Promise<RunningPace>;
  inputClass: string;
  labelClass: string;
}

export function SortableGroupContainer({
  id,
  groupId,
  repeatCount,
  groupName,
  indices,
  steps,
  isStrength = false,
  isSwim = false,
  perExerciseSets = false,
  paces,
  onUpdateRepeatCount,
  onUpdateGroupName,
  onTogglePerExerciseSets,
  onUngroup,
  onAddStepToGroup,
  onOpenPicker,
  onGroupDragEnd,
  onRemove,
  onUpdate,
  onToggleBothSides,
  onSwitchUnit,
  onSwitchDurationUnit,
  onCreatePace,
  inputClass,
  labelClass,
}: GroupContainerProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const innerSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const stepIds = indices.map((i) => `step-${i}`);

  const addLabel = isStrength ? "+ Add exercise to group" : "+ Add step to group";

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="rounded-xl border-2 border-[var(--accent)] p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            {...listeners}
            className="text-[var(--muted)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing touch-none flex items-center"
            aria-label="Drag group to reorder"
          >
            <GripIcon />
          </button>
          {isStrength ? (
            <input
              type="text"
              placeholder="Group name (e.g. Warm Up, Main Set)"
              value={groupName}
              onChange={(e) => onUpdateGroupName(groupId, e.target.value)}
              className="flex-1 min-w-0 rounded border border-[var(--accent)] bg-[var(--background)] px-2 py-0.5 text-xs font-semibold text-[var(--accent)] placeholder:font-normal placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          ) : (
            <span className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wide">
              Repeat
            </span>
          )}
          {(!isStrength || !perExerciseSets) && (
            <>
              <span className="text-xs text-[var(--accent)]">×</span>
              <input
                type="number"
                min="1"
                value={repeatCount}
                onChange={(e) => onUpdateRepeatCount(groupId, parseInt(e.target.value) || 1)}
                className="w-14 rounded border border-[var(--accent)] bg-[var(--background)] px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <span className="text-xs text-[var(--muted)]">{isStrength ? "sets" : "times"}</span>
            </>
          )}
          {isStrength && (
            <button
              type="button"
              onClick={() => onTogglePerExerciseSets?.(groupId)}
              className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                perExerciseSets
                  ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
              }`}
              title={perExerciseSets ? "Switch back to a shared set count for all exercises" : "Give each exercise its own set count"}
            >
              {perExerciseSets ? "Per exercise ✓" : "Per exercise"}
            </button>
          )}
          <button
            type="button"
            onClick={() => onUngroup(groupId)}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Ungroup
          </button>
        </div>

        <DndContext
          sensors={innerSensors}
          collisionDetection={closestCenter}
          onDragEnd={onGroupDragEnd}
        >
          <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 pl-2 border-l-2 border-[var(--accent)]">
              {indices.map((actualIndex, j) => (
                <SortableStepCard
                  key={`${actualIndex}-${steps[actualIndex].exercise_id}`}
                  id={`step-${actualIndex}`}
                  step={steps[actualIndex]}
                  actualIndex={actualIndex}
                  label={`Step ${j + 1}`}
                  isStrength={isStrength}
                  isSwim={isSwim}
                  showSets={perExerciseSets}
                  paces={paces}
                  onRemove={onRemove}
                  onUpdate={onUpdate}
                  onToggleBothSides={onToggleBothSides}
                  onSwitchUnit={onSwitchUnit}
                  onSwitchDurationUnit={onSwitchDurationUnit}
                  onCreatePace={onCreatePace}
                  onOpenPicker={onOpenPicker}
                  inputClass={inputClass}
                  labelClass={labelClass}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={() => onAddStepToGroup(groupId)}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}

// ── WorkoutForm ───────────────────────────────────────────────────────────────

interface WorkoutFormProps {
  // Plan-linked mode: provide planId + weekNumber + dayOfWeek
  planId?: string;
  weekNumber?: number;
  dayOfWeek?: number;
  // Ad-hoc mode: provide scheduledDate instead
  scheduledDate?: string;
  existing?: WorkoutWithSteps | null;
  paces?: RunningPace[];
  showSaveToLibrary?: boolean;
  onSave: (data: WorkoutFormData) => Promise<void>;
  onCancel: () => void;
  onBack?: () => void;
}

export function WorkoutForm({
  planId,
  weekNumber,
  dayOfWeek,
  scheduledDate,
  existing,
  paces = [],
  showSaveToLibrary = false,
  onSave,
  onCancel,
  onBack,
}: WorkoutFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [localPaces, setLocalPaces] = useState<RunningPace[]>(paces);
  const [perExerciseSetsGroupIds, setPerExerciseSetsGroupIds] = useState<Set<number>>(() => {
    const init = new Set<number>();
    if (existing?.workout_steps) {
      for (const s of existing.workout_steps) {
        if (s.repeat_group_id !== null && s.sets !== null) {
          init.add(s.repeat_group_id);
        }
      }
    }
    return init;
  });

  const [form, setForm] = useState<WorkoutFormData>(() => ({
    plan_id: planId,
    week_number: weekNumber,
    day_of_week: dayOfWeek,
    scheduled_date: scheduledDate,
    type: existing?.type ?? "run",
    run_type: existing?.run_type ?? "",
    strength_type: existing?.strength_type ?? "",
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    distance_miles: existing?.distance_miles?.toString() ?? "",
    distance_unit: (existing?.distance_unit as "mi" | "km") ?? getStoredUnit(),
    pace_type: existing?.pace_type ?? "",
    duration_minutes: existing?.duration_minutes?.toString() ?? "",
    notes: existing?.notes ?? "",
    sort_order: existing?.sort_order ?? 0,
    steps:
      existing?.workout_steps?.map((s) => ({
        step_type: s.step_type,
        label: s.label ?? "",
        pace_type: s.pace_type ?? "",
        duration_unit: (s.duration_unit === "sec" ? "sec" : "min") as "min" | "sec",
        duration_minutes: (() => {
          if (s.duration_minutes == null) return "";
          const mins = parseFloat(String(s.duration_minutes));
          if (isNaN(mins)) return "";
          return s.duration_unit === "sec" ? String(Math.round(mins * 60)) : String(mins);
        })(),
        distance_miles: s.distance_miles?.toString() ?? "",
        distance_unit: (s.distance_unit as DistanceUnit) ?? "mi",
        notes: s.notes ?? "",
        repeat_group_id: s.repeat_group_id ?? null,
        repeat_count: s.repeat_count ?? 1,
        group_name: s.group_name ?? "",
        exercise_id: s.exercise_id ?? "",
        sets: s.sets?.toString() ?? "",
        reps: s.reps?.toString() ?? "",
        weight_suggestion: s.weight_suggestion ?? "",
        video_url: s.video_url ?? "",
        both_sides: s.both_sides ?? false,
        stroke_style: s.stroke_style ?? "",
      })) ?? [blankStep()],
    bike_location: (existing?.bike_location as "indoor" | "outdoor" | null) ?? "",
    cross_train_type: (existing?.cross_train_type as CrossTrainType | null) ?? "",
    continuous_timers: existing?.continuous_timers ?? false,
  }));

  // ── Step handlers ──

  function updateStep(index: number, key: StringStepKey, value: string) {
    setForm((prev) => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], [key]: value };
      return { ...prev, steps };
    });
  }

  function toggleBothSides(index: number) {
    setForm((prev) => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], both_sides: !steps[index].both_sides };
      return { ...prev, steps };
    });
  }

  function switchStepUnit(index: number, newUnit: DistanceUnit) {
    setForm((prev) => {
      const steps = [...prev.steps];
      const cur = steps[index];
      const raw = parseFloat(cur.distance_miles);
      const converted =
        !isNaN(raw) && raw > 0
          ? String(parseFloat(convertDistance(raw, cur.distance_unit, newUnit).toFixed(4)))
          : cur.distance_miles;
      steps[index] = { ...cur, distance_unit: newUnit, distance_miles: converted };
      return { ...prev, steps };
    });
  }

  function switchStepDurationUnit(index: number, newUnit: "min" | "sec") {
    setForm((prev) => {
      const steps = [...prev.steps];
      const cur = steps[index];
      const raw = parseFloat(cur.duration_minutes);
      let converted = cur.duration_minutes;
      if (!isNaN(raw) && raw > 0) {
        if (cur.duration_unit === "min" && newUnit === "sec") {
          converted = String(Math.round(raw * 60));
        } else if (cur.duration_unit === "sec" && newUnit === "min") {
          converted = String(parseFloat((raw / 60).toFixed(2)));
        }
      }
      steps[index] = { ...cur, duration_unit: newUnit, duration_minutes: converted };
      return { ...prev, steps };
    });
  }

  function addStep() {
    setForm((prev) => ({
      ...prev,
      steps: [...prev.steps, blankStep(null, 1, prev.distance_unit as DistanceUnit)],
    }));
  }

  function removeStep(index: number) {
    setForm((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
  }

  function addRepeatGroup() {
    setForm((prev) => {
      const nextGroupId = Math.max(0, ...prev.steps.map((s) => s.repeat_group_id ?? 0)) + 1;
      const unit = prev.distance_unit as DistanceUnit;
      const isStrength = prev.type === "strength";
      // Swim intervals default to a single step per rep — the "on 2:00" send-off
      // convention already bakes in recovery, so a separate rest step would be
      // the exception; add one via "+ Add step to group" when it's needed.
      if (prev.type === "swim") {
        return { ...prev, steps: [...prev.steps, blankStep(nextGroupId, 2, unit)] };
      }
      return {
        ...prev,
        steps: [
          ...prev.steps,
          blankStep(nextGroupId, 2, unit),
          isStrength
            ? blankStep(nextGroupId, 2, unit)
            : { ...blankStep(nextGroupId, 2, unit), step_type: "recovery" },
        ],
      };
    });
  }

  function addStepToGroup(groupId: number) {
    setForm((prev) => {
      const steps = [...prev.steps];
      let lastIdx = -1;
      for (let i = 0; i < steps.length; i++) {
        if (steps[i].repeat_group_id === groupId) lastIdx = i;
      }
      const rc = lastIdx >= 0 ? steps[lastIdx].repeat_count : 2;
      const unit = lastIdx >= 0 ? steps[lastIdx].distance_unit : (prev.distance_unit as DistanceUnit);
      steps.splice(lastIdx + 1, 0, blankStep(groupId, rc, unit));
      return { ...prev, steps };
    });
  }

  function updateGroupRepeatCount(groupId: number, count: number) {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.repeat_group_id === groupId ? { ...s, repeat_count: count } : s
      ),
    }));
  }

  function updateGroupName(groupId: number, name: string) {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.repeat_group_id === groupId ? { ...s, group_name: name } : s
      ),
    }));
  }

  function addSection() {
    setForm((prev) => {
      const nextGroupId = Math.max(0, ...prev.steps.map((s) => s.repeat_group_id ?? 0)) + 1;
      const unit = prev.distance_unit as DistanceUnit;
      return {
        ...prev,
        steps: [...prev.steps, blankStep(nextGroupId, 1, unit)],
      };
    });
  }

  function ungroup(groupId: number) {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.repeat_group_id === groupId ? { ...s, repeat_group_id: null, repeat_count: 1 } : s
      ),
    }));
  }

  function togglePerExerciseSets(groupId: number) {
    const isCurrentlyOn = perExerciseSetsGroupIds.has(groupId);
    setPerExerciseSetsGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
    if (isCurrentlyOn) {
      setForm((prev) => ({
        ...prev,
        steps: prev.steps.map((s) =>
          s.repeat_group_id === groupId ? { ...s, sets: "" } : s
        ),
      }));
    }
  }

  async function handleCreatePace(name: string, secondsPerMile: number): Promise<RunningPace> {
    const created = await createPace(name, secondsPerMile);
    setLocalPaces((prev) => [...prev, created]);
    return created;
  }

  // ── Exercise picker (strength workouts) ──

  type PickerState =
    | { action: "add" }
    | { action: "addToGroup"; groupId: number }
    | { action: "replace"; stepIndex: number };

  const [exercisePicker, setExercisePicker] = useState<PickerState | null>(null);

  function handlePickerSelect(result: ExercisePickResult) {
    if (!exercisePicker) return;
    const step = blankStep(null, 1, form.distance_unit as DistanceUnit);
    const filled: WorkoutStepFormRow = {
      ...step,
      exercise_id: result.exercise_id,
      label: result.name,
      video_url: result.video_url,
    };

    setForm((prev) => {
      if (exercisePicker.action === "add") {
        return { ...prev, steps: [...prev.steps, filled] };
      }
      if (exercisePicker.action === "addToGroup") {
        const { groupId } = exercisePicker;
        const steps = [...prev.steps];
        let lastIdx = -1;
        for (let i = 0; i < steps.length; i++) {
          if (steps[i].repeat_group_id === groupId) lastIdx = i;
        }
        const rc = lastIdx >= 0 ? steps[lastIdx].repeat_count : 2;
        const gName = lastIdx >= 0 ? steps[lastIdx].group_name : "";
        const u = lastIdx >= 0 ? steps[lastIdx].distance_unit : (prev.distance_unit as DistanceUnit);
        const newStep = { ...blankStep(groupId, rc, u, gName), ...filled, repeat_group_id: groupId, repeat_count: rc, group_name: gName };
        steps.splice(lastIdx + 1, 0, newStep);
        return { ...prev, steps };
      }
      if (exercisePicker.action === "replace") {
        const steps = [...prev.steps];
        steps[exercisePicker.stepIndex] = {
          ...steps[exercisePicker.stepIndex],
          exercise_id: result.exercise_id,
          label: result.name,
          video_url: result.video_url,
          reps: "",
          duration_minutes: "",
          weight_suggestion: "",
          notes: "",
          both_sides: false,
        };
        return { ...prev, steps };
      }
      return prev;
    });
    setExercisePicker(null);
  }

  // ── Workout-level unit ──

  function switchWorkoutUnit(newUnit: "mi" | "km") {
    setForm((prev) => {
      const raw = parseFloat(prev.distance_miles);
      const converted =
        !isNaN(raw) && raw > 0
          ? String(parseFloat(convertDistance(raw, prev.distance_unit, newUnit).toFixed(4)))
          : prev.distance_miles;
      return { ...prev, distance_unit: newUnit, distance_miles: converted };
    });
  }

  // ── Drag-and-drop ──

  const outerSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function onSegmentDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const segs = buildSegments(form.steps);
    const oldIdx = segs.findIndex((s) => segmentId(s) === active.id);
    const newIdx = segs.findIndex((s) => segmentId(s) === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(segs, oldIdx, newIdx);
    const newSteps: WorkoutStepFormRow[] = [];
    for (const seg of reordered) {
      if (seg.type === "step") newSteps.push(form.steps[seg.index]);
      else seg.indices.forEach((i) => newSteps.push(form.steps[i]));
    }
    setForm((prev) => ({ ...prev, steps: newSteps }));
  }

  function onGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeIdx = parseInt((active.id as string).split("-")[1]);
    const overIdx = parseInt((over.id as string).split("-")[1]);
    if (isNaN(activeIdx) || isNaN(overIdx)) return;
    setForm((prev) => ({ ...prev, steps: arrayMove(prev.steps, activeIdx, overIdx) }));
  }

  // ── Computed totals from steps (run workouts only) ──

  const isRun = form.type === "run";
  const isStrength = form.type === "strength";
  const isBike = form.type === "bike";
  const isSwim = form.type === "swim";
  const isRest = form.type === "rest";
  const isCrossTrain = form.type === "cross_train";
  // Types that get a Steps/Exercises builder at all — everyone else (bike,
  // cross_train, rest) is a single top-level field or two.
  const showSteps = isRun || isStrength || isSwim;

  const { totalDistInUnit, totalDurationMin } = (() => {
    // Only run workouts derive their total distance/duration from steps —
    // swim intervals are tracked per-step (yards, not miles) and everything
    // else has no steps to sum.
    if (!isRun) return { totalDistInUnit: 0, totalDurationMin: 0 };
    const segs = buildSegments(form.steps);
    let distMiSum = 0;
    let durSum = 0;
    for (const seg of segs) {
      if (seg.type === "step") {
        distMiSum += computeStepDistanceMi(form.steps[seg.index], localPaces);
        durSum += computeStepDurationMin(form.steps[seg.index], localPaces);
      } else {
        let groupDistMi = 0;
        let groupDur = 0;
        seg.indices.forEach((i) => {
          groupDistMi += computeStepDistanceMi(form.steps[i], localPaces);
          groupDur += computeStepDurationMin(form.steps[i], localPaces);
        });
        distMiSum += groupDistMi * seg.repeatCount;
        durSum += groupDur * seg.repeatCount;
      }
    }
    return {
      totalDistInUnit: convertDistance(distMiSum, "mi", form.distance_unit as DistanceUnit),
      totalDurationMin: durSum,
    };
  })();

  // ── Submit ──

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        distance_miles: isRun
          ? (totalDistInUnit > 0 ? String(parseFloat(totalDistInUnit.toFixed(4))) : form.distance_miles)
          : (isStrength || isSwim ? "" : form.distance_miles),
        duration_minutes: isRun
          ? (totalDurationMin > 0 ? String(totalDurationMin) : form.duration_minutes)
          : (isStrength || isSwim ? "" : form.duration_minutes),
        bike_location: isBike ? form.bike_location : "",
        cross_train_type: isCrossTrain ? form.cross_train_type : "",
        continuous_timers: isStrength && form.continuous_timers,
        // Types without a Steps builder (bike, cross_train, rest) never get a
        // chance to clear the default blank step — drop it here instead of
        // silently persisting it, and clear out any steps left over from
        // before the workout was switched to one of these types.
        steps: showSteps ? form.steps : [],
        saveToLibrary: showSaveToLibrary ? saveToLibrary : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
  const labelClass = "text-xs text-[var(--muted)]";

  const segments = buildSegments(form.steps);
  const segmentIds = segments.map(segmentId);

  const addStepLabel = isStrength ? "+ Add exercise" : "+ Add step";
  const addGroupLabel = isStrength ? "+ Add superset" : "+ Add repeats";

  function handleAddStep() {
    if (isStrength) {
      setExercisePicker({ action: "add" });
    } else {
      addStep();
    }
  }

  function handleAddStepToGroup(groupId: number) {
    if (isStrength) {
      setExercisePicker({ action: "addToGroup", groupId });
    } else {
      addStepToGroup(groupId);
    }
  }

  function handleAddSection() {
    const nextGroupId = Math.max(0, ...form.steps.map((s) => s.repeat_group_id ?? 0)) + 1;
    setForm((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        { ...blankStep(nextGroupId, 1, prev.distance_unit as DistanceUnit), sets: "1" },
      ],
    }));
    // Named groups run each exercise through its own set count rather than a
    // shared repeat_count, so default "Per exercise" on for a newly created
    // named group (a superset created via addRepeatGroup defaults it off).
    setPerExerciseSetsGroupIds((prev) => new Set(prev).add(nextGroupId));
  }
  const stepsEmptyText = isStrength
    ? "No exercises yet. Add exercises below, or create a named group (e.g. Warm Up) to organize them."
    : "No steps yet. Add steps to structure this workout (warm-up, intervals, cool-down, etc.).";

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90dvh] sm:max-h-[90vh]">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  title="Back"
                >
                  ←
                </button>
              )}
              <h2 className="font-semibold">
                {existing ? "Edit" : "Add"} workout —{" "}
                {scheduledDate
                  ? new Date(scheduledDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : `Wk ${weekNumber}, ${DAY_NAMES[dayOfWeek ?? 0]}`}
              </h2>
            </div>
            <button
              onClick={onCancel}
              className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Type */}
            <div className="space-y-1">
              <label className={labelClass}>Type</label>
              <select
                value={form.type}
                onChange={(e) => {
                  const newType = e.target.value as WorkoutType;
                  setForm((p) => ({
                    ...p,
                    type: newType,
                    run_type: newType !== "run" ? "" : p.run_type,
                    strength_type: newType !== "strength" ? "" : p.strength_type,
                    bike_location: newType !== "bike" ? "" : p.bike_location,
                    cross_train_type: newType !== "cross_train" ? "" : p.cross_train_type,
                  }));
                }}
                className={inputClass}
              >
                <option value="run">Run</option>
                <option value="strength">Strength</option>
                <option value="bike">Bike</option>
                <option value="swim">Swim</option>
                <option value="cross_train">Cross-Train</option>
                <option value="rest">Rest</option>
              </select>
            </div>

            {isRun && (
              <div className="space-y-1">
                <label className={labelClass}>Run type</label>
                <select
                  value={form.run_type}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, run_type: e.target.value as RunType | "" }))
                  }
                  className={inputClass}
                >
                  <option value="">— Select —</option>
                  <option value="easy_run">Easy Run</option>
                  <option value="long_run">Long Run</option>
                  <option value="mp_hmp_run">MP/HMP Run</option>
                  <option value="interval_run">Interval Run</option>
                  <option value="threshold_run">Threshold Run</option>
                  <option value="recovery_run">Recovery Run</option>
                  <option value="boost_run">Boost Run</option>
                  <option value="race">Race</option>
                </select>
              </div>
            )}

            {isStrength && (
              <div className="space-y-1">
                <label className={labelClass}>Strength type</label>
                <select
                  value={form.strength_type}
                  onChange={(e) => setForm((p) => ({ ...p, strength_type: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">— Select —</option>
                  {Object.entries(STRENGTH_TYPE_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Title */}
            <div className="space-y-1">
              <label className={labelClass}>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder={
                  isStrength ? "e.g. Upper body push day"
                  : isRun ? "e.g. Easy run"
                  : isRest ? "e.g. Rest day"
                  : "e.g. Workout title"
                }
                className={inputClass}
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className={labelClass}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={isStrength ? 2 : 4}
                className={`${inputClass} resize-y`}
              />
            </div>

            {isBike && (
              <div className="space-y-1">
                <label className={labelClass}>Location</label>
                <div className="flex rounded-lg border border-[var(--border)] overflow-hidden w-fit">
                  {Object.entries(BIKE_LOCATION_LABELS).map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, bike_location: val as "indoor" | "outdoor" }))}
                      className={`px-3 py-1.5 text-sm transition-colors ${
                        form.bike_location === val
                          ? "bg-[var(--foreground)] text-[var(--background)]"
                          : "text-[var(--muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isBike && (
              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <label className={labelClass}>Duration (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.duration_minutes}
                    onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label className={labelClass}>Distance</label>
                    <UnitToggle
                      units={["mi", "km"]}
                      active={form.distance_unit}
                      onChange={(u) => setForm((p) => ({ ...p, distance_unit: u as "mi" | "km" }))}
                    />
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.distance_miles}
                    onChange={(e) => setForm((p) => ({ ...p, distance_miles: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {isCrossTrain && (
              <div className="space-y-1">
                <label className={labelClass}>Cross Training Type</label>
                <select
                  value={form.cross_train_type}
                  onChange={(e) => setForm((p) => ({ ...p, cross_train_type: e.target.value as CrossTrainType | "" }))}
                  className={inputClass}
                >
                  <option value="">— Select —</option>
                  {Object.entries(CROSS_TRAIN_TYPE_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
            )}

            {isCrossTrain && (
              <div className="space-y-1">
                <label className={labelClass}>Duration (min)</label>
                <input
                  type="number"
                  min="0"
                  value={form.duration_minutes}
                  onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                  className={inputClass}
                />
              </div>
            )}

            {/* Steps */}
            {showSteps && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                  {isStrength ? "Exercises" : "Steps"}
                </span>

                {form.steps.length === 0 && (
                  <p className="text-xs text-[var(--muted)] italic">{stepsEmptyText}</p>
                )}

                <DndContext
                  sensors={outerSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onSegmentDragEnd}
                >
                  <SortableContext items={segmentIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {segments.map((seg, si) => {
                        if (seg.type === "step") {
                          return (
                            <SortableStepCard
                              key={`step-${seg.index}-${form.steps[seg.index].exercise_id}`}
                              id={`step-${seg.index}`}
                              step={form.steps[seg.index]}
                              actualIndex={seg.index}
                              label={`Step ${si + 1}`}
                              isStrength={isStrength}
                              isSwim={isSwim}
                              paces={localPaces}
                              onRemove={removeStep}
                              onUpdate={updateStep}
                              onToggleBothSides={toggleBothSides}
                              onSwitchUnit={switchStepUnit}
                              onSwitchDurationUnit={switchStepDurationUnit}
                              onCreatePace={handleCreatePace}
                              onOpenPicker={(idx) => setExercisePicker({ action: "replace", stepIndex: idx })}
                              inputClass={inputClass}
                              labelClass={labelClass}
                            />
                          );
                        }
                        return (
                          <SortableGroupContainer
                            key={`group-${seg.groupId}`}
                            id={`group-${seg.groupId}`}
                            groupId={seg.groupId}
                            repeatCount={seg.repeatCount}
                            groupName={form.steps[seg.indices[0]]?.group_name ?? ""}
                            indices={seg.indices}
                            steps={form.steps}
                            isStrength={isStrength}
                            isSwim={isSwim}
                            perExerciseSets={perExerciseSetsGroupIds.has(seg.groupId)}
                            paces={localPaces}
                            onUpdateRepeatCount={updateGroupRepeatCount}
                            onUpdateGroupName={updateGroupName}
                            onTogglePerExerciseSets={togglePerExerciseSets}
                            onUngroup={ungroup}
                            onAddStepToGroup={handleAddStepToGroup}
                            onOpenPicker={(idx) => setExercisePicker({ action: "replace", stepIndex: idx })}
                            onGroupDragEnd={onGroupDragEnd}
                            onRemove={removeStep}
                            onUpdate={updateStep}
                            onToggleBothSides={toggleBothSides}
                            onSwitchUnit={switchStepUnit}
                            onSwitchDurationUnit={switchStepDurationUnit}
                            onCreatePace={handleCreatePace}
                            inputClass={inputClass}
                            labelClass={labelClass}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>

                <div className="flex gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    {addStepLabel}
                  </button>
                  <button
                    type="button"
                    onClick={addRepeatGroup}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    {addGroupLabel}
                  </button>
                  {isStrength && (
                    <button
                      type="button"
                      onClick={handleAddSection}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      + Add named group
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Continuous timers (strength only) */}
            {isStrength && (
              <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.continuous_timers}
                  onChange={(e) => setForm((p) => ({ ...p, continuous_timers: e.target.checked }))}
                  className="mt-0.5 rounded border-[var(--border)] accent-[var(--accent)]"
                />
                <span>
                  Continuous timers
                  <span className="block text-xs text-[var(--muted)]">
                    When a timed exercise or rest ends, automatically move on and start the next timer — no tapping between them.
                  </span>
                </span>
              </label>
            )}

            {/* Totals (run workouts only) */}
            {isRun && (
              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2">
                {(totalDistInUnit > 0 || totalDurationMin > 0) && (
                  <div className="flex flex-wrap gap-4">
                    {totalDistInUnit > 0 && (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={labelClass}>Total distance</span>
                          <UnitToggle
                            units={["mi", "km"]}
                            active={form.distance_unit}
                            onChange={(u) =>
                              setForm((p) => ({ ...p, distance_unit: u as "mi" | "km" }))
                            }
                          />
                        </div>
                        <p className="text-sm font-medium">
                          {parseFloat(totalDistInUnit.toFixed(2))} {form.distance_unit}
                        </p>
                      </div>
                    )}
                    {totalDurationMin > 0 && (
                      <div className="space-y-0.5">
                        <span className={labelClass}>Total duration</span>
                        <p className="text-sm font-medium">{Math.round(totalDurationMin)} min</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <label className={labelClass}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>

            {showSaveToLibrary && !existing && (
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveToLibrary}
                  onChange={(e) => setSaveToLibrary(e.target.checked)}
                  className="rounded border-[var(--border)] accent-[var(--accent)]"
                />
                Save to workout library
              </label>
            )}

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? "Saving…" : existing ? "Save changes" : "Add workout"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-4 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    {exercisePicker && (
      <ExercisePickerModal
        onSelect={handlePickerSelect}
        onCancel={() => setExercisePicker(null)}
      />
    )}
  </>
  );
}
