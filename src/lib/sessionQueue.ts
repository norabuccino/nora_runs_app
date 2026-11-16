import type { SessionBeat } from "@/lib/workoutSteps";

/**
 * The strength player's running order, adjustable mid-workout: beats can be
 * skipped (a set, or the rest of an exercise) or an exercise's remaining beats
 * moved to the end. Beats are referred to by their index in
 * `buildSessionBeats`' list, which never changes during a session.
 */
export interface SessionQueue {
  /** Beat indices in the order they'll be done. Skipped beats are removed. */
  order: number[];
  /** Position in `order` of the current beat; `order.length` means nothing is left. */
  position: number;
  /** Beat indices skipped during the session (never logged). */
  skipped: number[];
}

export function initialQueue(beatCount: number, position = 0): SessionQueue {
  return { order: Array.from({ length: beatCount }, (_, i) => i), position, skipped: [] };
}

/** The set/round number a beat is logged under. */
function setKey(beat: SessionBeat): number | null {
  return beat.isSuperset ? beat.roundNumber : beat.setNumber;
}

/** Positions from the current one on whose beat matches `pick`. */
function remainingPositions(q: SessionQueue, match: (beatIndex: number) => boolean): number[] {
  const out: number[] = [];
  for (let p = q.position; p < q.order.length; p++) if (match(q.order[p])) out.push(p);
  return out;
}

function currentBeat(beats: SessionBeat[], q: SessionQueue): SessionBeat | null {
  const i = q.order[q.position];
  return i == null ? null : beats[i] ?? null;
}

/** Remaining positions of the current set (both sides of a `both_sides` set). */
function currentSetPositions(beats: SessionBeat[], q: SessionQueue): number[] {
  const cur = currentBeat(beats, q);
  if (!cur) return [];
  return remainingPositions(q, (i) => beats[i].step === cur.step && setKey(beats[i]) === setKey(cur));
}

/** Remaining positions (current included) of the current beat's exercise. */
function currentStepPositions(beats: SessionBeat[], q: SessionQueue): number[] {
  const cur = currentBeat(beats, q);
  if (!cur) return [];
  return remainingPositions(q, (i) => beats[i].step === cur.step);
}

function removePositions(q: SessionQueue, positions: number[]): SessionQueue {
  const drop = new Set(positions);
  return {
    order: q.order.filter((_, p) => !drop.has(p)),
    position: q.position, // every removed position is at or after the current one
    skipped: [...q.skipped, ...positions.map((p) => q.order[p])],
  };
}

/** How many beats of the current set, and of the current exercise, are still to do. */
export function remainingCounts(beats: SessionBeat[], q: SessionQueue): { set: number; step: number; stepSets: number } {
  const stepPositions = currentStepPositions(beats, q);
  const sets = new Set(stepPositions.map((p) => setKey(beats[q.order[p]])));
  return { set: currentSetPositions(beats, q).length, step: stepPositions.length, stepSets: sets.size };
}

/** Skip the current set (both sides of a `both_sides` set, from the current side on). */
export function skipCurrentSet(beats: SessionBeat[], q: SessionQueue): SessionQueue {
  return removePositions(q, currentSetPositions(beats, q));
}

/** Skip everything left of the current exercise. */
export function skipCurrentExercise(beats: SessionBeat[], q: SessionQueue): SessionQueue {
  return removePositions(q, currentStepPositions(beats, q));
}

/** Whether anything else is left to do, so moving the current exercise to the end changes something. */
export function canMoveCurrentExerciseToEnd(beats: SessionBeat[], q: SessionQueue): boolean {
  const cur = currentBeat(beats, q);
  if (!cur) return false;
  return remainingPositions(q, (i) => beats[i].step !== cur.step).length > 0;
}

/** Move what's left of the current exercise after everything else, keeping its own order. */
export function moveCurrentExerciseToEnd(beats: SessionBeat[], q: SessionQueue): SessionQueue {
  if (!canMoveCurrentExerciseToEnd(beats, q)) return q;
  const moving = new Set(currentStepPositions(beats, q));
  const kept = q.order.filter((_, p) => !moving.has(p));
  const moved = q.order.filter((_, p) => moving.has(p));
  return { order: [...kept, ...moved], position: q.position, skipped: q.skipped };
}

/** Bring back an exercise's skipped beats, in their original order, as the current beat. */
export function restoreSkipped(beats: SessionBeat[], q: SessionQueue, step: SessionBeat["step"]): SessionQueue {
  const restoring = q.skipped.filter((i) => beats[i]?.step === step).sort((a, b) => a - b);
  if (restoring.length === 0) return q;
  const back = new Set(restoring);
  return {
    order: [...q.order.slice(0, q.position), ...restoring, ...q.order.slice(q.position)],
    position: q.position,
    skipped: q.skipped.filter((i) => !back.has(i)),
  };
}

/** Move the current position to wherever a beat sits in the order (no-op if it was skipped). */
export function jumpToBeat(q: SessionQueue, beatIndex: number): SessionQueue {
  const p = q.order.indexOf(beatIndex);
  return p < 0 ? q : { ...q, position: p };
}

/** Whether a saved queue still fits this workout's beats (every beat exactly once, in order or skipped). */
export function isValidQueue(value: unknown, beatCount: number): value is SessionQueue {
  if (!value || typeof value !== "object") return false;
  const { order, position, skipped } = value as Partial<SessionQueue>;
  if (!Array.isArray(order) || !Array.isArray(skipped) || !Number.isInteger(position)) return false;
  const all = [...order, ...skipped];
  if (all.length !== beatCount) return false;
  const seen = new Set<number>();
  for (const i of all) {
    if (!Number.isInteger(i) || i < 0 || i >= beatCount || seen.has(i)) return false;
    seen.add(i);
  }
  return position! >= 0 && position! <= order.length;
}
