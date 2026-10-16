import { describe, it, expect } from "vitest";
import { isUpdateImport, parseExerciseUpdateRecords, matchExerciseUpdates } from "@/lib/exerciseUpdateImport";

describe("isUpdateImport", () => {
  it("is true only when there is an id column", () => {
    expect(isUpdateImport(["id", "name", "equipment"])).toBe(true);
    expect(isUpdateImport([" ID "])).toBe(true);
    expect(isUpdateImport(["name", "equipment"])).toBe(false);
  });
});

describe("parseExerciseUpdateRecords", () => {
  it("parses equipment and loading category by key or label", () => {
    const [row] = parseExerciseUpdateRecords([
      { id: "e1", name: "Curtsy Lunges", equipment: "Dumbbells; Box / step", loading_category: "Unilateral Squat / Knee Dominant" },
    ]);
    expect(row).toEqual({
      id: "e1",
      name: "Curtsy Lunges",
      fields: { equipment: ["dumbbells", "box_step"], loading_category: "unilateral_squat" },
    });
  });

  it("leaves blank cells out so they don't change the exercise", () => {
    const [row] = parseExerciseUpdateRecords([{ id: "e1", name: "x", equipment: "", loading_category: "  " }]);
    expect(row.fields).toEqual({});
  });

  it("parses the other updatable columns", () => {
    const [row] = parseExerciseUpdateRecords([
      {
        id: "e1",
        exercise_type: "Lower Body",
        source: "Coach; Book",
        muscle_groups: "Thighs",
        track_load: "yes",
        load_format: "per_hand",
        default_increment: "2.5",
      },
    ]);
    expect(row.fields).toEqual({
      exercise_type: "lower_body",
      sources: ["Coach", "Book"],
      muscle_groups: ["thighs"],
      track_load: true,
      load_format: "per_hand",
      default_increment: 2.5,
    });
  });

  it("rejects invalid values with the spreadsheet row number", () => {
    expect(() => parseExerciseUpdateRecords([{ id: "e1", loading_category: "Leg day" }])).toThrow(
      'Row 2: unknown loading category "Leg day"'
    );
    expect(() => parseExerciseUpdateRecords([{ id: "e1" }, { id: "e2", equipment: "Rowing machine" }])).toThrow(
      'Row 3: unknown equipment "Rowing machine"'
    );
    expect(() => parseExerciseUpdateRecords([{ id: "e1", track_load: "maybe" }])).toThrow("track_load");
    expect(() => parseExerciseUpdateRecords([{ id: "e1", default_increment: "-5" }])).toThrow("default_increment");
  });

  it("requires an id or a name", () => {
    expect(() => parseExerciseUpdateRecords([{ id: "", name: "", equipment: "TRX" }])).toThrow("needs an id or a name");
  });
});

describe("matchExerciseUpdates", () => {
  const existing = [
    { id: "e1", name: "Squats" },
    { id: "e2", name: "Copenhagen" },
    { id: "e3", name: "Copenhagen" },
  ];

  it("matches by id first", () => {
    const r = matchExerciseUpdates([{ id: "e1", name: "Renamed", fields: { equipment: ["trx"] } }], existing);
    expect(r).toEqual({ matched: [{ id: "e1", fields: { equipment: ["trx"] } }], unmatched: [] });
  });

  it("falls back to a unique case-insensitive name match when id is blank", () => {
    const r = matchExerciseUpdates([{ id: null, name: "squats", fields: {} }], existing);
    expect(r.matched).toEqual([{ id: "e1", fields: {} }]);
  });

  it("skips ambiguous names and unknown ids", () => {
    const r = matchExerciseUpdates(
      [
        { id: null, name: "Copenhagen", fields: {} },
        { id: "nope", name: "Squats", fields: {} },
      ],
      existing
    );
    expect(r).toEqual({ matched: [], unmatched: ["Copenhagen", "Squats"] });
  });
});
