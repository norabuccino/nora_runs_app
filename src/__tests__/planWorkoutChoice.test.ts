import { describe, it, expect } from "vitest";
import { applyNewWorkoutChoice } from "@/lib/planWorkoutChoice";
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
