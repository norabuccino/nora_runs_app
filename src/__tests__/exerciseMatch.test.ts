import { describe, it, expect } from "vitest";
import { matchExercise, normalizeExerciseName } from "@/lib/exerciseMatch";

const library = [
  { id: "1", name: "Push Up" },
  { id: "2", name: "Pull Up" },
  { id: "3", name: "Dumbbell RDL" },
  { id: "4", name: "Single Leg Glute Bridge" },
  { id: "5", name: "Copenhagen Holds" },
  { id: "6", name: "Dumbbell Pullover" },
  { id: "7", name: "Single Leg Dumbbell RDL" },
  { id: "8", name: "Single Leg Paloff Press" },
  { id: "9", name: "Push Press" },
];

describe("normalizeExerciseName", () => {
  it("lowercases, strips punctuation, expands abbreviations and drops plurals", () => {
    expect(normalizeExerciseName("Push-Ups")).toBe("push up");
    expect(normalizeExerciseName("DB RDLs")).toBe("dumbbell rdl");
    expect(normalizeExerciseName("SL Glute Bridges")).toBe("single leg glute bridge");
  });
});

describe("matchExercise", () => {
  it("matches regardless of case, hyphens, spacing, plurals and abbreviations", () => {
    expect(matchExercise("push ups", library).exercise?.id).toBe("1");
    expect(matchExercise("pushups", library).exercise?.id).toBe("1");
    expect(matchExercise("Pull-ups", library).exercise?.id).toBe("2");
    expect(matchExercise("db rdl", library).exercise?.id).toBe("3");
    expect(matchExercise("copenhagen hold", library).status).toBe("matched");
  });

  it("suggests close names without auto-matching them", () => {
    const m = matchExercise("glute bridge", library);
    expect(m.status).toBe("suggested");
    expect(m.suggestions[0].id).toBe("4");
  });

  it("ranks names containing every typed word first, tolerating small typos", () => {
    const withoutExact = library.filter((e) => e.id !== "3");
    expect(matchExercise("db rdl", withoutExact).suggestions[0].id).toBe("7");
    expect(matchExercise("pallof press", library).suggestions[0].id).toBe("8");
  });

  it("reports no match for unrelated names", () => {
    expect(matchExercise("bulgarian split squat", library)).toEqual({ status: "none", exercise: null, suggestions: [] });
  });
});
