// Fixed list of muscle groups an exercise can be tagged with (multi-select).
// Keys match the CHECK constraint on exercises.muscle_groups.

import { createTagList } from "@/lib/tagList";

export const MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  back_spine: "Back & Spine",
  abdomen: "Abdomen",
  arms: "Arms",
  hips_glutes: "Hips & Glutes",
  thighs: "Thighs",
  lower_legs: "Lower Legs",
  feet: "Feet",
};

const muscleGroups = createTagList(MUSCLE_GROUP_LABELS);

export const MUSCLE_GROUPS = muscleGroups.keys;

// Keeps only valid keys, de-duplicated, in the canonical head-to-toe order.
export const sortMuscleGroups = muscleGroups.sort;
export const toggleMuscleGroup = muscleGroups.toggle;
export const applyMuscleGroupChange = muscleGroups.applyChange;
export const formatMuscleGroups = muscleGroups.format;

// Parses import input — "Chest; Arms", "hips_glutes", or a JSON array — accepting
// either keys or labels (case-insensitive). Unknown names are returned separately.
export function parseMuscleGroups(input: unknown): { groups: string[]; unknown: string[] } {
  const { tags, unknown } = muscleGroups.parse(input);
  return { groups: tags, unknown };
}
