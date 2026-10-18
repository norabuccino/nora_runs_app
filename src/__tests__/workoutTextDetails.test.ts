import { describe, it, expect } from "vitest";
import { splitWorkoutText, inferRunType, inferStrengthType } from "@/lib/workoutTextDetails";
import { isExerciseLine } from "@/lib/workoutTextImport";
import { parseRunText } from "@/lib/runTextImport";

const runLine = (l: string) => parseRunText(l, { sport: "run", paceNames: ["Easy", "3K"] }).blocks.length > 0;

describe("splitWorkoutText", () => {
  it("takes a title line and description paragraph ahead of run steps", () => {
    const { details, body } = splitWorkoutText(
      "Track 200s\n\nTwo sets of fast 200s to work on turnover.\n\nWarm up 2 miles, then 8x200m at 3K pace.\nCool down 2 miles",
      "run",
      runLine
    );
    expect(details).toEqual({ title: "Track 200s", description: "Two sets of fast 200s to work on turnover.", run_type: "interval_run" });
    expect(body).toBe("Warm up 2 miles, then 8x200m at 3K pace.\nCool down 2 miles");
  });

  it("takes a title directly above strength exercises", () => {
    const { details, body } = splitWorkoutText("Upper body pull\nPull ups 3x8\nRows 3x10", "strength", isExerciseLine);
    expect(details).toEqual({ title: "Upper body pull", strength_type: "upper_body" });
    expect(body).toBe("Pull ups 3x8\nRows 3x10");
  });

  it("reads labeled lines anywhere and keeps them out of the body", () => {
    const { details, body } = splitWorkoutText(
      "Title: Leg day\nPush ups 3x10\nNotes: go slow on the eccentric\nSource: Coach Sam\nFocus: lower body\nSquats 3x8",
      "strength",
      isExerciseLine
    );
    expect(details).toEqual({ title: "Leg day", notes: "go slow on the eccentric", source: "Coach Sam", strength_type: "lower_body" });
    expect(body).toBe("Push ups 3x10\nSquats 3x8");
  });

  it("leaves the text alone when it starts with steps", () => {
    const text = "push ups - 3 sets, 8-10 reps; pull ups - 3 sets, 8-10 reps";
    expect(splitWorkoutText(text, "strength", isExerciseLine)).toEqual({ details: {}, body: text });
  });

  it("doesn't treat a sentence as a title", () => {
    const { details } = splitWorkoutText("Easy shakeout before the race.\n\n3 miles easy", "run", runLine);
    expect(details).toEqual({ description: "Easy shakeout before the race.", run_type: "race" });
  });

  it("keeps unrecognized text in the body when there are no steps", () => {
    const { details, body } = splitWorkoutText("Hill day\nfeel strong", "run", runLine);
    expect(details.title).toBe("Hill day");
    expect(body).toBe("feel strong");
  });
});

describe("type inference", () => {
  it("maps keywords to run and strength types", () => {
    expect(inferRunType("Tempo Tuesday")).toBe("threshold_run");
    expect(inferRunType("Sunday long run")).toBe("long_run");
    expect(inferRunType("MP workout")).toBe("mp_hmp_run");
    expect(inferStrengthType("Full body circuit")).toBe("full_body");
    expect(inferStrengthType("Core finisher")).toBe("core");
  });
});
