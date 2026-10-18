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

  it("suggests equipment the description says the exercise needs", () => {
    expect(suggestExerciseTags("Goblet Squat", "Hold a kettlebell at your chest and sit back.").equipment).toEqual(["kettlebell"]);
    expect(suggestExerciseTags("Fire Hydrants", "Start on all fours with a resistance band above both knees.").equipment).toEqual(["mini_band"]);
  });

  it("ignores optional, negated and verb-only mentions in the description", () => {
    const desc =
      "Step forward into a lunge. Modification: place a hand on the wall for balance. Progression: hold 2 dumbbells. No band needed.";
    expect(suggestExerciseTags("Reverse Lunge", desc).equipment).toEqual([]);
    expect(suggestExerciseTags("Heel Taps", "Stand with one foot on a step or block").equipment).toEqual(["box_step"]);
  });

  it("never suggests muscle groups from the description", () => {
    expect(suggestExerciseTags("Mystery Move", "Squeeze your glutes").muscle_groups).toEqual([]);
  });

  it("suggests nothing for an empty or unrecognized name", () => {
    expect(suggestExerciseTags("")).toEqual({ equipment: [], muscle_groups: [] });
    expect(suggestExerciseTags("Zercher Thing")).toEqual({ equipment: [], muscle_groups: [] });
  });
});
