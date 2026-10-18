// Reference text for each load format (keys of LOAD_FORMAT_LABELS): what a
// logged number means, when to pick it, and examples from the exercise library.
// Shown on /reference and from the exercise form's Load format field.

export interface GuideEntry {
  key: string;
  meaning: string;
  whenToUse: string;
  examples: string;
}

export const LOAD_FORMAT_GUIDE: GuideEntry[] = [
  {
    key: "single_db_kb",
    meaning: "One dumbbell or kettlebell — log its weight.",
    whenToUse: "A single weight, held in one hand or both: goblet, single-arm, suitcase and kickstand work.",
    examples: "Goblet squat, single-leg RDL, kettlebell swings, carries, chops",
  },
  {
    key: "per_hand",
    meaning: "A weight in each hand — log one hand (two 15 lb dumbbells = 15).",
    whenToUse: "Two dumbbells or kettlebells, one per hand.",
    examples: "Split squats with two dumbbells, rows, curls, presses, lateral raises",
  },
  {
    key: "per_side",
    meaning: "The load on each side — log one side.",
    whenToUse: "Plates loaded on each side of a bar or sled, when you think in per-side numbers.",
    examples: "Plate-loaded movements counted per side",
  },
  {
    key: "total",
    meaning: "The whole weight being moved — log the total.",
    whenToUse: "A single implement that isn't a dumbbell, kettlebell or barbell.",
    examples: "Weight plates, medicine balls, tib bar, sled, seated calf raise",
  },
  {
    key: "barbell_total",
    meaning: "Bar plus plates — log everything, including the bar (45 lb bar + two 25s = 95).",
    whenToUse: "Any barbell lift.",
    examples: "Back squat, deadlift, barbell split squat isos, barbell calf raise",
  },
  {
    key: "machine",
    meaning: "The number on the machine's stack or pin.",
    whenToUse: "Cable and selectorized machines.",
    examples: "Cable exercises, leg press",
  },
  {
    key: "bodyweight",
    meaning: "No added weight — just log reps.",
    whenToUse: "Bodyweight exercises you still want to track progress on.",
    examples: "Pushups, Nordic lean, sissy squats",
  },
  {
    key: "bodyweight_plus",
    meaning: "Bodyweight plus extra weight — log only the added weight.",
    whenToUse: "Bodyweight exercises you sometimes load with a vest, belt or dumbbell.",
    examples: "Pull up, chin up, single leg glute hip thrust",
  },
  {
    key: "band",
    meaning: "The band is the resistance — log the band level.",
    whenToUse: "Exercises where a band, not a weight, provides the load.",
    examples: "Mini band hip work, clamshells, monster walks, Paloff press, banded rotations",
  },
  {
    key: "other",
    meaning: "Anything that doesn't fit — logged as a plain number.",
    whenToUse: "Use the exercise notes to say what the number means.",
    examples: "—",
  },
];

/** Rule of thumb for the most common mix-up. */
export const LOAD_FORMAT_TIP =
  "Single vs. per hand: if the description says “the weight” or “a dumbbell”, it’s Single dumbbell/kettlebell; “weights” or “2 dumbbells” means Per hand.";
