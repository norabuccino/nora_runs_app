import { describe, it, expect } from "vitest";
import { applyNewWorkoutChoice, initialChoice } from "@/lib/planWorkoutChoice";
import { workoutFromText } from "@/lib/planTextImport";

const guess = workoutFromText("45-50 min easy w/ strides & drills");

describe("applyNewWorkoutChoice", () => {
  it("uses an edited name, ignoring a blank one", () => {
    expect(applyNewWorkoutChoice(guess, { kind: "new", title: "  Easy + strides " }, false).newWorkout).toMatchObject({
      title: "Easy + strides",
      duration_minutes: 50,
      notes: "Strides & drills",
    });
    expect(applyNewWorkoutChoice(guess, { kind: "new", title: "  " }, false).newWorkout.title).toBe("45-50 min easy");
  });

  it("follows the 'save all' default unless the row says otherwise", () => {
    expect(applyNewWorkoutChoice(guess, { kind: "new" }, true).saveToLibrary).toBe(true);
    expect(applyNewWorkoutChoice(guess, { kind: "new", saveToLibrary: false }, true).saveToLibrary).toBe(false);
    expect(applyNewWorkoutChoice(guess, { kind: "new", saveToLibrary: true }, false).saveToLibrary).toBe(true);
    expect(applyNewWorkoutChoice(guess, { kind: "skip" }, true).saveToLibrary).toBe(false);
  });

  it("keeps the edited name when the type changes", () => {
    const out = applyNewWorkoutChoice(guess, { kind: "new", type: "cross_train", title: "Walk" }, false).newWorkout;
    expect(out).toMatchObject({ type: "cross_train", run_type: null, title: "Walk" });
  });
});

describe("initialChoice", () => {
  const lib = (id: string) => ({ id, title: id, name: id });
  const exact = { status: "matched" as const, exercise: lib("Track 200s"), suggestions: [lib("Track 400s")] };

  it("defaults a named workout to its exact library match", () => {
    expect(initialChoice(exact, false)).toEqual({ match: exact, choice: { kind: "library", id: "Track 200s", title: "Track 200s" } });
  });

  it("defaults a written-out workout to new, offering the match first", () => {
    const out = initialChoice(exact, true);
    expect(out.choice).toEqual({ kind: "new" });
    expect(out.match.exercise).toBeNull();
    expect(out.match.suggestions.map((s) => s.id)).toEqual(["Track 200s", "Track 400s"]);
  });

  it("is new when nothing matches", () => {
    const none = { status: "none" as const, exercise: null, suggestions: [] };
    expect(initialChoice(none, false).choice).toEqual({ kind: "new" });
  });
});
