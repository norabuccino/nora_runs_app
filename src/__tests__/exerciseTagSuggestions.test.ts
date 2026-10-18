import { describe, it, expect } from "vitest";
import { suggestExerciseTags } from "@/lib/exerciseTagSuggestions";

describe("suggestExerciseTags", () => {
  it("suggests equipment named in the exercise", () => {
    expect(suggestExerciseTags("DB Box Step Up").equipment).toEqual(["dumbbells", "box_step"]);
    expect(suggestExerciseTags("Mini Band Monster Walk").equipment).toEqual(["mini_band"]);
    expect(suggestExerciseTags("Banded Pallof Press").equipment).toEqual(["resistance_band"]);
    expect(suggestExerciseTags("Barbell Back Squat").equipment).toEqual(["barbell"]);
  });

  it("suggests muscle groups from the movement", () => {
    expect(suggestExerciseTags("Single Leg Glute Bridge").muscle_groups).toEqual(["hips_glutes"]);
    expect(suggestExerciseTags("Dumbbell RDL").muscle_groups).toEqual(["hips_glutes", "thighs"]);
    expect(suggestExerciseTags("Push Ups").muscle_groups).toEqual(["chest"]);
    expect(suggestExerciseTags("Seated Calf Raise").muscle_groups).toEqual(["lower_legs"]);
  });

  it("avoids look-alike words", () => {
    expect(suggestExerciseTags("Dumbbell Bench Press").equipment).toEqual(["dumbbells"]);
    expect(suggestExerciseTags("Hamstring Curl on Sliders").muscle_groups).toEqual(["thighs"]);
    expect(suggestExerciseTags("Side Plank with Hip Dip").muscle_groups).not.toContain("chest");
    expect(suggestExerciseTags("Rear Foot Elevated Split Squat").muscle_groups).toEqual(["thighs"]);
  });

  it("suggests nothing for an empty or unrecognized name", () => {
    expect(suggestExerciseTags("")).toEqual({ equipment: [], muscle_groups: [] });
    expect(suggestExerciseTags("Zercher Thing")).toEqual({ equipment: [], muscle_groups: [] });
  });
});
