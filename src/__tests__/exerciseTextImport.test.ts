import { describe, it, expect } from "vitest";
import { parseExerciseList, inferExerciseType } from "@/lib/exerciseTextImport";

describe("parseExerciseList", () => {
  it("reads a name + description paragraph with labels", () => {
    const [e] = parseExerciseList(
      "Goblet Squat\nHold a kettlebell at your chest and sit back between your heels.\nSource: Coach Sam; Book\nMuscles: thighs, hips & glutes"
    );
    expect(e).toMatchObject({
      name: "Goblet Squat",
      description: "Hold a kettlebell at your chest and sit back between your heels.",
      equipment: ["kettlebell"],
      muscle_groups: ["hips_glutes", "thighs"],
      sources: ["Coach Sam", "Book"],
      exercise_type: "lower_body",
      suggested: { equipment: true, muscle_groups: false, exercise_type: true },
    });
  });

  it("reads a list of short lines as one exercise each, splitting 'Name - description'", () => {
    const entries = parseExerciseList("Dead Bugs - Lie on your back and lower opposite arm and leg.\nClamshells\n1. Copenhagen Plank");
    expect(entries.map((e) => [e.name, e.description, e.exercise_type])).toEqual([
      ["Dead Bugs", "Lie on your back and lower opposite arm and leg.", "core"],
      ["Clamshells", null, "lower_body"],
      ["Copenhagen Plank", null, "lower_body"],
    ]);
    expect(entries[1].equipment).toEqual(["mini_band"]);
  });

  it("uses labeled type/equipment over suggestions and reports unknown values", () => {
    const [e] = parseExerciseList("Box Jumps\nType: Plyos\nEquipment: box; trampoline");
    expect(e).toMatchObject({ exercise_type: "plyos", equipment: ["box_step"], unknown: ["equipment “trampoline”"] });
  });
});

describe("inferExerciseType", () => {
  it("prefers name words, then body regions", () => {
    expect(inferExerciseType("Hip Flexor Stretch", ["hips_glutes"])).toBe("stretch");
    expect(inferExerciseType("Pogo Hops", ["lower_legs"])).toBe("plyos");
    expect(inferExerciseType("Thruster", ["thighs", "shoulders"])).toBe("full_body");
    expect(inferExerciseType("Mystery", [])).toBeNull();
  });
});
