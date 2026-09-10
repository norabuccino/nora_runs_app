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
 * exercise. Standalone exercises expand into one beat per set; superset
 * groups expand into one beat per exercise per round, looping through every
 * exercise in the group before repeating for the next round.
 */
export interface SessionBeat {
  step: WorkoutStep;
  setNumber: number | null;
  totalSets: number | null;
  roundNumber: number | null;
  totalRounds: number | null;
  groupName: string | null;
  isSuperset: boolean;
}

export function buildSessionBeats(steps: WorkoutStep[]): SessionBeat[] {
  const beats: SessionBeat[] = [];

  for (const segment of groupSteps(steps)) {
    if (segment.type === "step") {
      const totalSets = segment.step.sets && segment.step.sets > 0 ? segment.step.sets : 1;
      for (let setNumber = 1; setNumber <= totalSets; setNumber++) {
        beats.push({
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
      const totalRounds = segment.repeatCount && segment.repeatCount > 0 ? segment.repeatCount : 1;
      for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber++) {
        for (const step of segment.steps) {
          beats.push({
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

  return beats;
}
