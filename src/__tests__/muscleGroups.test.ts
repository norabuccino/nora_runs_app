import { describe, it, expect } from "vitest";
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  sortMuscleGroups,
  toggleMuscleGroup,
  parseMuscleGroups,
  formatMuscleGroups,
  applyMuscleGroupChange,
} from "@/lib/muscleGroups";

describe("MUSCLE_GROUP_LABELS", () => {
  it("has the nine groups in head-to-toe order", () => {
    expect(MUSCLE_GROUPS.map((g) => MUSCLE_GROUP_LABELS[g])).toEqual([
      "Chest", "Shoulders", "Back & Spine", "Abdomen", "Arms",
      "Hips & Glutes", "Thighs", "Lower Legs", "Feet",
    ]);
  });
});

describe("sortMuscleGroups", () => {
  it("drops unknown keys, de-duplicates, and orders canonically", () => {
    expect(sortMuscleGroups(["feet", "chest", "bogus", "feet", "arms"])).toEqual(["chest", "arms", "feet"]);
  });

  it("handles null", () => {
    expect(sortMuscleGroups(null)).toEqual([]);
  });
});

describe("toggleMuscleGroup", () => {
  it("adds a group in canonical order", () => {
    expect(toggleMuscleGroup(["thighs"], "chest")).toEqual(["chest", "thighs"]);
  });

  it("removes a group that is already present", () => {
    expect(toggleMuscleGroup(["chest", "thighs"], "chest")).toEqual(["thighs"]);
  });
});

describe("parseMuscleGroups", () => {
  it("accepts labels and keys case-insensitively, separated by semicolons", () => {
    expect(parseMuscleGroups("hips & glutes; Thighs ;back_spine")).toEqual({
      groups: ["back_spine", "hips_glutes", "thighs"],
      unknown: [],
    });
  });

  it("tolerates label spelling variants like 'Back and Spine'", () => {
    expect(parseMuscleGroups("Back and Spine").groups).toEqual(["back_spine"]);
  });

  it("accepts a JSON array", () => {
    expect(parseMuscleGroups(["Chest", "lower_legs"]).groups).toEqual(["chest", "lower_legs"]);
  });

  it("reports unknown names separately", () => {
    expect(parseMuscleGroups("Chest; Neck")).toEqual({ groups: ["chest"], unknown: ["Neck"] });
  });

  it("returns nothing for empty input", () => {
    expect(parseMuscleGroups("")).toEqual({ groups: [], unknown: [] });
    expect(parseMuscleGroups(undefined)).toEqual({ groups: [], unknown: [] });
  });
});

describe("formatMuscleGroups", () => {
  it("formats as labels and round-trips through parseMuscleGroups", () => {
    const text = formatMuscleGroups(["thighs", "hips_glutes"]);
    expect(text).toBe("Hips & Glutes; Thighs");
    expect(parseMuscleGroups(text).groups).toEqual(["hips_glutes", "thighs"]);
  });
});

describe("applyMuscleGroupChange", () => {
  it("adds a group while keeping existing ones, in canonical order", () => {
    expect(applyMuscleGroupChange(["thighs"], { add: ["hips_glutes"] })).toEqual(["hips_glutes", "thighs"]);
  });

  it("does not duplicate a group that is already present", () => {
    expect(applyMuscleGroupChange(["thighs"], { add: ["thighs"] })).toEqual(["thighs"]);
  });

  it("removes a group and leaves the others", () => {
    expect(applyMuscleGroupChange(["chest", "arms"], { remove: ["chest"] })).toEqual(["arms"]);
  });

  it("removing a group the exercise doesn't have is a no-op", () => {
    expect(applyMuscleGroupChange(["arms"], { remove: ["feet"] })).toEqual(["arms"]);
  });

  it("handles null and ignores unknown groups", () => {
    expect(applyMuscleGroupChange(null, { add: ["feet", "neck"] })).toEqual(["feet"]);
  });
});
