import type { WorkoutStep } from "@/types/database";

/**
 * Groups a flat, ordered list of workout steps into standalone steps and
 * repeat groups (interval repeats for runs, supersets for strength), based
 * on contiguous runs of the same `repeat_group_id`.
 */
export type StepSegment =
  | { type: "step"; step: WorkoutStep }
  | { type: "group"; repeatCount: number; steps: WorkoutStep[] };

export function groupSteps(steps: WorkoutStep[]): StepSegment[] {
  const segments: StepSegment[] = [];
  let i = 0;
  while (i < steps.length) {
    const gid = steps[i].repeat_group_id;
    if (gid === null) {
      segments.push({ type: "step", step: steps[i] });
      i++;
    } else {
      const group: WorkoutStep[] = [];
      while (i < steps.length && steps[i].repeat_group_id === gid) {
        group.push(steps[i]);
        i++;
      }
      segments.push({ type: "group", repeatCount: group[0].repeat_count, steps: group });
    }
  }
  return segments;
}

export function formatStepDuration(durationMinutes: number | null, durationUnit: string): string | null {
  if (!durationMinutes) return null;
  if (durationUnit === "sec") return `${Math.round(durationMinutes * 60)} sec`;
  return `${durationMinutes} min`;
}

/**
 * `weight_suggestion` is free text, but a comma-separated list is read as one
 * value per set ("BW, 20 lb, 20 lb"). Returns the suggestion that applies to
 * the given 1-based set/round; if the list is shorter than the number of sets
 * the last value carries forward. Text with no comma is returned unchanged.
 */
export function suggestedWeightForSet(weightSuggestion: string | null, setNumber: number | null): string | null {
  if (!weightSuggestion) return null;
  const parts = weightSuggestion.split(",").map((p) => p.trim());
  if (parts.length < 2 || setNumber == null) return weightSuggestion.trim() || null;
  const index = Math.min(Math.max(setNumber, 1), parts.length) - 1;
  return parts[index] || null;
}

/** Splits a stored `weight_suggestion` into one entry per set, carrying the last value forward. */
export function splitSetWeights(weightSuggestion: string, setCount: number): string[] {
  const parts = weightSuggestion.split(",").map((p) => p.trim());
  return resizeSetWeights(parts, setCount);
}

/** Pads (carrying the last value forward) or truncates a per-set list to `setCount` entries. */
export function resizeSetWeights(slots: string[], setCount: number): string[] {
  const count = Math.max(setCount, 1);
  const last = slots[slots.length - 1] ?? "";
  return Array.from({ length: count }, (_, i) => (i < slots.length ? slots[i] : last));
}

/** Joins per-set entries back into the stored comma-separated form ("" when every entry is blank). */
export function joinSetWeights(slots: string[]): string {
  const cleaned = slots.map((s) => s.replace(/,/g, " ").replace(/\s+/g, " ").trim());
  return cleaned.every((s) => s === "") ? "" : cleaned.join(", ");
}

/**
 * A step is timer-driven (a hold/plank/etc.) rather than rep-driven when it
 * has a duration and no rep count — mirrors the display precedence used
 * elsewhere (reps win over duration when both are somehow set).
 */
export function stepTimedSeconds(step: WorkoutStep): number | null {
  if (step.reps || !step.duration_minutes) return null;
  return Math.round(step.duration_minutes * 60);
}

/**
 * One atomic beat in a strength workout session: a single set of a single
 * exercise. Standalone exercises expand into one beat per set. A grouped
 * segment expands one of two ways depending on whether it's a true superset
 * or just a named group (see `buildSessionBeats`): round-robin through every
 * exercise once per round (superset), or each exercise's own sets in full
 * before moving to the next (named group) — same shape as a standalone step,
 * just carrying the shared `groupName`.
 *
 * A `both_sides` exercise splits every set/round into a left beat followed by
 * a right beat, so "3 x 10 each side" is six beats and each side is logged on
 * its own.
 */
export type StepSide = "left" | "right";

export interface SessionBeat {
  step: WorkoutStep;
  setNumber: number | null;
  totalSets: number | null;
  roundNumber: number | null;
  totalRounds: number | null;
  groupName: string | null;
  isSuperset: boolean;
  side: StepSide | null;
}

export function buildSessionBeats(steps: WorkoutStep[]): SessionBeat[] {
  const beats: SessionBeat[] = [];
  const push = (beat: Omit<SessionBeat, "side">) => {
    if (beat.step.both_sides) {
      beats.push({ ...beat, side: "left" }, { ...beat, side: "right" });
    } else {
      beats.push({ ...beat, side: null });
    }
  };

  for (const segment of groupSteps(steps)) {
    if (segment.type === "step") {
      const totalSets = segment.step.sets && segment.step.sets > 0 ? segment.step.sets : 1;
      for (let setNumber = 1; setNumber <= totalSets; setNumber++) {
        push({
          step: segment.step,
          setNumber,
          totalSets,
          roundNumber: null,
          totalRounds: null,
          groupName: null,
          isSuperset: false,
        });
      }
    } else {
      // WorkoutForm's "Per exercise" toggle marks a group as a named group
      // rather than a true superset — the exercises are just gathered under
      // a shared label, and each one carries its own `sets` value instead of
      // the group sharing one repeat_count. Detect that the same way the
      // form does (any step in the group has its own `sets`) and run each
      // exercise through all of its own sets before moving to the next,
      // instead of round-robin-ing between exercises.
      const isNamedGroup = segment.steps.some((s) => s.sets != null && s.sets > 0);
      if (isNamedGroup) {
        for (const step of segment.steps) {
          const totalSets = step.sets && step.sets > 0 ? step.sets : 1;
          for (let setNumber = 1; setNumber <= totalSets; setNumber++) {
            push({
              step,
              setNumber,
              totalSets,
              roundNumber: null,
              totalRounds: null,
              groupName: step.group_name ?? null,
              isSuperset: false,
            });
          }
        }
      } else {
        const totalRounds = segment.repeatCount && segment.repeatCount > 0 ? segment.repeatCount : 1;
        for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber++) {
          for (const step of segment.steps) {
            push({
              step,
              setNumber: null,
              totalSets: null,
              roundNumber,
              totalRounds,
              groupName: step.group_name ?? null,
              isSuperset: true,
            });
          }
        }
      }
    }
  }

  return beats;
}
