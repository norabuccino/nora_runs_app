// One complete workout written as plain text — title, description, details
// and steps — turned into data that can be saved. Used by the admin bulk
// import (many library workouts, or a whole plan with workouts written out).
// Builds on the single-workout parsers: workoutTextDetails (title etc.),
// workoutTextImport (strength), runTextImport (run/swim) and planTextImport
// (type guessing for workouts without steps).

import type { WorkoutStepFormRow } from "@/components/WorkoutForm";
import type { WorkoutType, RunType } from "@/types/database";
import { convertDistance, type DistanceUnit } from "@/lib/unitUtils";
import { splitWorkoutText, inferRunType, inferStrengthType, type WorkoutTextDetails } from "@/lib/workoutTextDetails";
import { isExerciseLine, parseWorkoutText, toFormSteps, type ExerciseResolution, type ParsedWorkout } from "@/lib/workoutTextImport";
import { parseRunText, toRunFormSteps, type ParsedRunWorkout } from "@/lib/runTextImport";
import { inferWorkoutType, workoutFromText } from "@/lib/planTextImport";

export interface ParsedWorkoutBlock {
  type: WorkoutType;
  details: WorkoutTextDetails;
  /** Strength exercises (strength only). */
  strength: ParsedWorkout | null;
  /** Run or swim steps. */
  run: ParsedRunWorkout | null;
  /** Distance/time guessed from the text, for workouts without steps (bike, cross-train). */
  distance: number | null;
  distanceUnit: "mi" | "km";
  durationMinutes: number | null;
}

/** Splits pasted text into one chunk per workout, on lines of ---, === or ***. */
export function splitBulkWorkouts(text: string): string[] {
  return text
    .split(/^\s*(?:-{3,}|={3,}|\*{3,})\s*$/m)
    .map((b) => b.trim())
    .filter(Boolean);
}

const STRENGTH_SIGNS = [
  /\b\d+\s*[x×]\s*\d+(?:\s*[-–]\s*\d+)?\b(?!\s*(?:m|meters?|metres?|mi|miles?|km|k|yd|yards?|min|mins|minutes?|sec|s)\b)/i,
  /\b\d+\s*(?:sets?|reps?)\b/i,
  /\b(superset|circuit)\b/i,
  /@\s*\d+\s*(lb|lbs|kg)\b/i,
  /\beach (side|leg|arm)\b/i,
];
const RUN_SIGNS = [
  /\b\d+(?:\.\d+)?\s*(mi|miles?|km)\b/i,
  /\b\d+\s*m\b|\b\d+\s*[x×]\s*\d+\s*m\b/i,
  /\bpace\b/i,
  /\b(warm ?-?up|cool ?-?down|jog|strides|tempo|threshold)\b/i,
];
const SWIM_SIGNS = [/\b(free(style)?|backstroke|breaststroke|fly|butterfly|yd|yards|swim|kick|pull buoy)\b/i];

/**
 * The workout type of a pasted workout: an explicit "Type:" line wins, then the
 * steps' style (sets×reps vs. distances and paces vs. strokes), then keywords.
 */
export function detectWorkoutType(text: string): WorkoutType {
  const typeLine = text.match(/^\s*(?:type|workout type)\s*:\s*(.+)$/im);
  if (typeLine) {
    const t = typeLine[1].trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (["run", "strength", "bike", "swim", "cross_train", "rest"].includes(t)) return t as WorkoutType;
    const fromLabel = inferWorkoutType(typeLine[1]);
    if (fromLabel) return fromLabel;
  }
  const score = (signs: RegExp[]) => signs.filter((re) => re.test(text)).length;
  const swim = score(SWIM_SIGNS);
  const run = score(RUN_SIGNS);
  const strength = score(STRENGTH_SIGNS);
  if (swim > 0 && swim >= run) return "swim";
  if (strength > run) return "strength";
  if (run > 0) return "run";
  return inferWorkoutType(text) ?? "run";
}

export function parseWorkoutBlock(
  text: string,
  { paceNames, type: forcedType }: { paceNames: string[]; type?: WorkoutType }
): ParsedWorkoutBlock {
  const type = forcedType ?? detectWorkoutType(text);
  const runLike = type === "run" || type === "swim";
  const sport = type === "strength" ? "strength" : type === "swim" ? "swim" : "run";
  const isStepLine =
    type === "strength"
      ? isExerciseLine
      : runLike
      ? (line: string) => parseRunText(line, { sport: sport as "run" | "swim", paceNames }).blocks.length > 0
      : () => false;
  const { details, body } = splitWorkoutText(text, sport, isStepLine);
  // A "Type: strength" line is the workout type, not a run/strength sub-type — only keep inferred sub-types that fit.
  if (type !== "run") delete details.run_type;
  if (type !== "strength") delete details.strength_type;
  if (type === "run" && !details.run_type) details.run_type = inferRunType(`${details.title ?? ""} ${body}`) ?? undefined;
  if (type === "strength" && !details.strength_type) details.strength_type = inferStrengthType(details.title ?? "") ?? undefined;

  const guess = workoutFromText(`${details.title ?? ""} ${type === "bike" || type === "cross_train" ? body : ""}`);
  return {
    type,
    details,
    strength: type === "strength" ? parseWorkoutText(body) : null,
    run: runLike ? parseRunText(body, { sport: sport as "run" | "swim", paceNames }) : null,
    distance: runLike || type === "strength" ? null : guess.distance_miles,
    distanceUnit: guess.distance_unit,
    durationMinutes: runLike || type === "strength" ? null : guess.duration_minutes,
  };
}

/** Saved shape of a step, as the workout forms send it to the server actions. */
export interface StepData {
  step_type: string;
  label: string | null;
  pace_type: string | null;
  duration_minutes: number | null;
  duration_unit: string;
  distance_miles: number | null;
  distance_unit: string;
  notes: string | null;
  repeat_group_id: number | null;
  repeat_count: number;
  group_name: string | null;
  sets: number | null;
  reps: number | null;
  weight_suggestion: string | null;
  video_url: string | null;
  exercise_id: string | null;
  both_sides: boolean;
  stroke_style: string | null;
}

/** Same conversion the workout forms do on save (durations stored in minutes). */
export function formRowsToStepData(rows: WorkoutStepFormRow[]): StepData[] {
  return rows.map((s) => {
    const rawDur = s.duration_minutes ? parseFloat(s.duration_minutes) : null;
    return {
      step_type: s.step_type,
      label: s.label || null,
      pace_type: s.pace_type || null,
      duration_minutes: rawDur != null ? (s.duration_unit === "sec" ? rawDur / 60 : rawDur) : null,
      duration_unit: s.duration_unit ?? "min",
      distance_miles: s.distance_miles ? parseFloat(s.distance_miles) : null,
      distance_unit: s.distance_unit ?? "mi",
      notes: s.notes || null,
      repeat_group_id: s.repeat_group_id ?? null,
      repeat_count: s.repeat_count ?? 1,
      group_name: s.group_name || null,
      sets: s.sets ? parseInt(s.sets, 10) : null,
      reps: s.reps ? parseInt(s.reps, 10) : null,
      weight_suggestion: s.weight_suggestion || null,
      video_url: s.video_url || null,
      exercise_id: s.exercise_id || null,
      both_sides: s.both_sides ?? false,
      stroke_style: s.stroke_style || null,
    };
  });
}

/** Run totals from steps — distance in miles and minutes — using paces to fill in whichever is missing. */
export function runTotals(rows: WorkoutStepFormRow[], paces: { name: string; pace_seconds_per_mile: number }[]) {
  let miles = 0;
  let minutes = 0;
  const seen = new Set<number>();
  for (const row of rows) {
    const reps = row.repeat_group_id != null ? row.repeat_count || 1 : 1;
    if (row.repeat_group_id != null) seen.add(row.repeat_group_id);
    const pace = paces.find((p) => p.name.toLowerCase() === row.pace_type.toLowerCase())?.pace_seconds_per_mile ?? null;
    const dist = parseFloat(row.distance_miles);
    const durRaw = parseFloat(row.duration_minutes);
    const distMi = !isNaN(dist) && dist > 0 ? convertDistance(dist, row.distance_unit, "mi") : null;
    const durMin = !isNaN(durRaw) && durRaw > 0 ? (row.duration_unit === "sec" ? durRaw / 60 : durRaw) : null;
    miles += (distMi ?? (durMin != null && pace ? (durMin * 60) / pace : 0)) * reps;
    minutes += (durMin ?? (distMi != null && pace ? (distMi * pace) / 60 : 0)) * reps;
  }
  return { miles: Math.round(miles * 100) / 100, minutes: Math.round(minutes) };
}

export interface WorkoutPayload {
  type: WorkoutType;
  run_type: RunType | null;
  strength_type: string | null;
  title: string;
  description: string | null;
  notes: string | null;
  source: string | null;
  distance_miles: number | null;
  distance_unit: string;
  duration_minutes: number | null;
  steps: StepData[];
}

/**
 * Everything needed to save a parsed workout. `resolutions[i]` is the exercise
 * chosen for the i-th strength exercise (flattenExercises order).
 */
export function buildWorkoutPayload(
  block: ParsedWorkoutBlock,
  resolutions: ExerciseResolution[],
  { paces, unit = "mi" }: { paces: { name: string; pace_seconds_per_mile: number }[]; unit?: DistanceUnit }
): WorkoutPayload {
  const rows: WorkoutStepFormRow[] = block.strength
    ? toFormSteps(block.strength.blocks, resolutions, { startGroupId: 1, unit }).steps
    : block.run
    ? toRunFormSteps(block.run.blocks, { startGroupId: 1, defaultUnit: block.type === "swim" ? "yd" : unit })
    : [];
  const totals = block.type === "run" && rows.length ? runTotals(rows, paces) : null;
  const d = block.details;
  return {
    type: block.type,
    run_type: block.type === "run" ? d.run_type ?? null : null,
    strength_type: block.type === "strength" ? d.strength_type ?? null : null,
    title: d.title ?? "Untitled workout",
    description: d.description ?? null,
    notes: d.notes ?? null,
    source: d.source ?? null,
    distance_miles: totals ? totals.miles || null : block.distance,
    distance_unit: totals ? "mi" : block.distanceUnit,
    duration_minutes: totals ? totals.minutes || null : block.durationMinutes,
    steps: formRowsToStepData(rows),
  };
}
