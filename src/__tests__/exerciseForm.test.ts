import { describe, it, expect } from "vitest";
import { EMPTY_EXERCISE_FORM, exerciseFormToPayload } from "@/lib/exerciseForm";

describe("exerciseFormToPayload", () => {
  it("trims text, nulls blanks and normalizes tag lists", () => {
    const payload = exerciseFormToPayload({
      ...EMPTY_EXERCISE_FORM,
      name: "  Goblet Squat ",
      description: "   ",
      sources: ["Coach", "coach "],
      muscle_groups: ["thighs", "hips_glutes", "bogus"],
      equipment: ["kettlebell", "dumbbells"],
    });
    expect(payload).toMatchObject({
      name: "Goblet Squat",
      description: null,
      video_url: null,
      exercise_type: null,
      sources: ["Coach"],
      muscle_groups: ["hips_glutes", "thighs"],
      equipment: ["dumbbells", "kettlebell"],
    });
  });

  it("only keeps load format and increment when tracking load", () => {
    const base = { ...EMPTY_EXERCISE_FORM, name: "Row", load_format: "per_hand", default_increment: "2.5" };
    expect(exerciseFormToPayload({ ...base, track_load: true })).toMatchObject({ load_format: "per_hand", default_increment: 2.5 });
    expect(exerciseFormToPayload(base)).toMatchObject({ load_format: null, default_increment: null });
  });
});
