import { describe, it, expect } from "vitest";
import {
  deriveEquipment,
  resolveEquipment,
  removedDerivedEquipment,
  addEquipment,
  removeEquipment,
  pruneAdjustments,
} from "@/lib/workoutEquipment";

const byExercise = {
  a: ["mini_band", "dumbbells"],
  b: ["dumbbells", "bench"],
  c: [],
};

describe("deriveEquipment", () => {
  it("unions exercise equipment in canonical order, ignoring unknown/missing exercises", () => {
    expect(deriveEquipment(["a", "b", "c", null, "zzz", ""], byExercise)).toEqual(["dumbbells", "mini_band", "bench"]);
  });

  it("is empty for workouts without library exercises", () => {
    expect(deriveEquipment([null, undefined], byExercise)).toEqual([]);
  });
});

describe("resolveEquipment", () => {
  it("applies additions and removals to the derived list", () => {
    expect(resolveEquipment(["dumbbells", "bench"], { added: ["mini_band"], removed: ["bench"] })).toEqual([
      "dumbbells",
      "mini_band",
    ]);
  });

  it("ignores removals of equipment that is no longer derived", () => {
    expect(resolveEquipment(["dumbbells"], { added: [], removed: ["bench"] })).toEqual(["dumbbells"]);
  });
});

describe("addEquipment / removeEquipment", () => {
  const derived = ["dumbbells", "bench"];

  it("removing a derived item records a removal; adding it back restores it", () => {
    const removed = removeEquipment({ added: [], removed: [] }, derived, "bench");
    expect(removed).toEqual({ added: [], removed: ["bench"] });
    expect(removedDerivedEquipment(derived, removed)).toEqual(["bench"]);
    expect(addEquipment(removed, derived, "bench")).toEqual({ added: [], removed: [] });
  });

  it("adding a non-derived item records an addition; removing it drops the addition", () => {
    const added = addEquipment({ added: [], removed: [] }, derived, "towel");
    expect(added).toEqual({ added: ["towel"], removed: [] });
    expect(removeEquipment(added, derived, "towel")).toEqual({ added: [], removed: [] });
  });
});

describe("pruneAdjustments", () => {
  it("drops additions now covered by exercises and removals no longer derived", () => {
    expect(pruneAdjustments({ added: ["dumbbells", "towel"], removed: ["bench", "sled"] }, ["dumbbells", "bench"])).toEqual({
      added: ["towel"],
      removed: ["bench"],
    });
  });
});
