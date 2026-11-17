import { describe, it, expect } from "vitest";
import { defaultSubType, filterLibrary, subTypeOptions, subTypeOf } from "@/lib/libraryPicker";

const w = (id: string, type: string, sub: Partial<Record<"run_type" | "strength_type" | "cross_train_type", string>> = {}) => ({
  id,
  title: id,
  type,
  run_type: null,
  strength_type: null,
  cross_train_type: null,
  ...sub,
});
const library = [
  w("Easy 5", "run", { run_type: "easy_run" }),
  w("Long 14", "run", { run_type: "long_run" }),
  w("Easy 3", "run", { run_type: "easy_run" }),
  w("Untyped run", "run"),
  w("Upper pull", "strength", { strength_type: "upper_body" }),
  w("Flow", "cross_train", { cross_train_type: "yoga" }),
  w("Spin", "bike"),
];

describe("library picker filtering", () => {
  it("reads the sub-type for each workout type", () => {
    expect(library.map(subTypeOf)).toEqual(["easy_run", "long_run", "easy_run", null, "upper_body", "yoga", null]);
  });

  it("lists only sub-types the library uses, in label order", () => {
    expect(subTypeOptions(library, "run").map((o) => o.value)).toEqual(["easy_run", "long_run"]);
    expect(subTypeOptions(library, "run")[0].label).toBe("Easy Run");
    expect(subTypeOptions(library, "bike")).toEqual([]);
  });

  it("filters by type and optional sub-type", () => {
    expect(filterLibrary(library, "run", "").map((x) => x.id)).toEqual(["Easy 5", "Long 14", "Easy 3", "Untyped run"]);
    expect(filterLibrary(library, "run", "easy_run").map((x) => x.id)).toEqual(["Easy 5", "Easy 3"]);
    expect(filterLibrary(library, "bike", "").map((x) => x.id)).toEqual(["Spin"]);
  });

  it("starts on the guessed sub-type only when the library has it", () => {
    expect(defaultSubType(library, "run", { run_type: "easy_run" })).toBe("easy_run");
    expect(defaultSubType(library, "run", { run_type: "interval_run" })).toBe("");
    expect(defaultSubType(library, "cross_train", { title: "Yoga" })).toBe("yoga");
    expect(defaultSubType(library, "bike", { title: "Bike 45 min" })).toBe("");
  });
});
