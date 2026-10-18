// Form state for creating/editing a library exercise, shared by the Exercises
// page and the workout builder's exercise picker so both offer the same fields.

import type { Exercise } from "@/types/database";
import { normalizeSources } from "@/lib/exerciseSources";
import { sortMuscleGroups } from "@/lib/muscleGroups";
import { sortEquipment } from "@/lib/equipment";

export interface ExerciseFormData {
  name: string;
  description: string;
  video_url: string;
  exercise_type: string;
  sources: string[];
  muscle_groups: string[];
  equipment: string[];
  is_private: boolean;
  loading_category: string;
  track_load: boolean;
  load_format: string;
  default_increment: string;
}

export const EMPTY_EXERCISE_FORM: ExerciseFormData = {
  name: "",
  description: "",
  video_url: "",
  exercise_type: "",
  sources: [],
  muscle_groups: [],
  equipment: [],
  is_private: false,
  loading_category: "",
  track_load: false,
  load_format: "",
  default_increment: "",
};

export function exerciseToForm(exercise: Exercise): ExerciseFormData {
  return {
    name: exercise.name,
    description: exercise.description ?? "",
    video_url: exercise.video_url ?? "",
    exercise_type: exercise.exercise_type ?? "",
    sources: exercise.sources ?? [],
    muscle_groups: exercise.muscle_groups ?? [],
    equipment: exercise.equipment ?? [],
    is_private: exercise.is_private,
    loading_category: exercise.loading_category ?? "",
    track_load: exercise.track_load,
    load_format: exercise.load_format ?? "",
    default_increment: exercise.default_increment != null ? String(exercise.default_increment) : "",
  };
}

/** Normalized values for createExercise/updateExercise. Load settings are cleared when not tracking load. */
export function exerciseFormToPayload(data: ExerciseFormData) {
  return {
    name: data.name.trim(),
    description: data.description.trim() || null,
    video_url: data.video_url.trim() || null,
    exercise_type: data.exercise_type || null,
    sources: normalizeSources(data.sources),
    muscle_groups: sortMuscleGroups(data.muscle_groups),
    equipment: sortEquipment(data.equipment),
    is_private: data.is_private,
    loading_category: data.loading_category || null,
    track_load: data.track_load,
    load_format: data.track_load ? data.load_format || null : null,
    default_increment: data.track_load && data.default_increment ? parseFloat(data.default_increment) : null,
  };
}
