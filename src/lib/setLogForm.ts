import type { WorkoutStep, WorkoutSessionExerciseWithSets } from "@/types/database";
import { buildSessionBeats, stepTimedSeconds } from "@/lib/workoutSteps";

/**
 * Form state for logging a strength workout's sets after the fact (the "Log
 * sets" sheet) — every set of every library-linked exercise as one editable
 * row, instead of stepping through the live session player.
 */
export interface SetLogRow {
  setNumber: number;
  side: "left" | "right" | null;
  weight: string;
  reps: string;
  seconds: string;
  done: boolean;
  /** A workout_set_logs row already exists for this set (unticking it deletes it). */
  existing: boolean;
}

export interface SetLogExercise {
  stepId: string;
  sessionExerciseId: string;
  name: string;
  groupName: string | null;
  loadFormat: string | null;
  /** Mirrors the player: weight is logged when the exercise has a load format. */
  weighted: boolean;
  repsBased: boolean;
  timed: boolean;
  rows: SetLogRow[];
}

export interface SetLogUpsert {
  sessionExerciseId: string;
  setNumber: number;
  side: "left" | "right" | null;
  weight: number | null;
  reps_completed: number | null;
  duration_seconds: number | null;
}

export type SetLogRemoval = Pick<SetLogUpsert, "sessionExerciseId" | "setNumber" | "side">;

/**
 * One entry per library-linked exercise (in workout order), with a row per
 * set/round (and side, for `both_sides`) using the same set numbering as the
 * session player. Rows are prefilled from what's already logged; with nothing
 * logged yet every set starts ticked with the planned reps/time.
 */
export function buildSetLogForm(steps: WorkoutStep[], sessionExercises: WorkoutSessionExerciseWithSets[]): SetLogExercise[] {
  const byStepId = new Map(
    sessionExercises.filter((e) => e.source_workout_step_id).map((e) => [e.source_workout_step_id!, e])
  );
  const anyLogged = sessionExercises.some((e) => e.workout_set_logs.length > 0);
  const result = new Map<string, SetLogExercise>();

  for (const beat of buildSessionBeats(steps)) {
    const se = byStepId.get(beat.step.id);
    if (!se) continue;
    let entry = result.get(beat.step.id);
    if (!entry) {
      const timedSeconds = stepTimedSeconds(beat.step);
      entry = {
        stepId: beat.step.id,
        sessionExerciseId: se.id,
        name: beat.step.label || "Exercise",
        groupName: beat.groupName,
        loadFormat: se.load_format,
        weighted: se.load_format != null,
        repsBased: beat.step.reps != null,
        timed: beat.step.reps == null && timedSeconds != null,
        rows: [],
      };
      result.set(beat.step.id, entry);
    }
    const setNumber = beat.isSuperset ? beat.roundNumber! : beat.setNumber!;
    const log = se.workout_set_logs.find((l) => l.set_number === setNumber && l.side === beat.side);
    const plannedSeconds = stepTimedSeconds(beat.step);
    entry.rows.push({
      setNumber,
      side: beat.side,
      weight: log?.weight != null ? String(log.weight) : "",
      reps: log?.reps_completed != null ? String(log.reps_completed) : log ? "" : beat.step.reps != null ? String(beat.step.reps) : "",
      seconds: log?.duration_seconds != null ? String(log.duration_seconds) : log || plannedSeconds == null ? "" : String(plannedSeconds),
      done: !!log || !anyLogged,
      existing: !!log,
    });
  }
  return Array.from(result.values());
}

/**
 * Sets one field of one row. Weight carries down: later sets of the same
 * exercise that were blank, or matched this row's old weight, follow it — so
 * typing a weight once fills a straight-sets exercise.
 */
export function updateSetLogRow(
  form: SetLogExercise[],
  exerciseIndex: number,
  rowIndex: number,
  field: "weight" | "reps" | "seconds" | "done",
  value: string | boolean
): SetLogExercise[] {
  return form.map((ex, i) => {
    if (i !== exerciseIndex) return ex;
    const previous = ex.rows[rowIndex];
    return {
      ...ex,
      rows: ex.rows.map((row, j) => {
        if (j === rowIndex) return { ...row, [field]: value };
        if (field === "weight" && j > rowIndex && (row.weight === "" || row.weight === previous.weight)) {
          return { ...row, weight: value as string };
        }
        return row;
      }),
    };
  });
}

function parseNumber(value: string, parse: (s: string) => number): number | null {
  if (value.trim() === "") return null;
  const n = parse(value);
  return Number.isFinite(n) ? n : null;
}

/** Ticked rows become upserts; unticked rows that were already logged become deletions. */
export function setLogChanges(form: SetLogExercise[]): { upserts: SetLogUpsert[]; removals: SetLogRemoval[] } {
  const upserts: SetLogUpsert[] = [];
  const removals: SetLogRemoval[] = [];
  for (const ex of form) {
    for (const row of ex.rows) {
      const key = { sessionExerciseId: ex.sessionExerciseId, setNumber: row.setNumber, side: row.side };
      if (row.done) {
        upserts.push({
          ...key,
          weight: ex.weighted ? parseNumber(row.weight, parseFloat) : null,
          reps_completed: ex.repsBased ? parseNumber(row.reps, (s) => parseInt(s, 10)) : null,
          duration_seconds: ex.timed ? parseNumber(row.seconds, (s) => parseInt(s, 10)) : null,
        });
      } else if (row.existing) {
        removals.push(key);
      }
    }
  }
  return { upserts, removals };
}

