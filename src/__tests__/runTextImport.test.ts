import { describe, it, expect } from "vitest";
import { parseRunText, toRunFormSteps, describeRunStep, type RunBlock } from "@/lib/runTextImport";

const paceNames = ["Easy", "Long Run", "Recovery", "Threshold", "Marathon", "Mile", "5K", "Half Marathon", "10K", "3K"];
const run = (text: string) => parseRunText(text, { sport: "run", paceNames });
const summary = (blocks: RunBlock[]) =>
  blocks.map((b) => (b.kind === "step" ? describeRunStep(b.step) : `${b.count}x[${b.steps.map((s) => describeRunStep(s)).join(" | ")}]`));

describe("parseRunText", () => {
  it("reads the two-set 200s example, repeating the block with the jog between sets", () => {
    const { blocks, unparsed, unknownPaces } = run(
      "warm up 2 miles, then run 2 sets of 8x200m at 3K pace with 200m recovery after each 200. Jog 800m easy between the two sets. Finish with 2 mile cooldown."
    );
    expect(summary(blocks)).toEqual([
      "Warm-up · 2 mi · @ Easy",
      "8x[Interval · 200 m · @ 3K | Recovery · 200 m · @ Recovery]",
      "Recovery · 800 m · @ Easy",
      "8x[Interval · 200 m · @ 3K | Recovery · 200 m · @ Recovery]",
      "Cool-down · 2 mi · @ Easy",
    ]);
    expect(unparsed).toEqual([]);
    expect(unknownPaces).toEqual([]);
  });

  it("reads time-based repeats, aliases and a following recovery clause", () => {
    expect(summary(run("15 min easy; 4 x 5 min at threshold, 90 sec jog; 10 min cool down").blocks)).toEqual([
      "Run · 15 min · @ Easy",
      "4x[Interval · 5 min · @ Threshold | Recovery · 1:30 · @ Recovery]",
      "Cool-down · 10 min · @ Easy",
    ]);
  });

  it("keeps distance-like pace names as distances unless they say pace", () => {
    expect(summary(run("6 x 1 mile @ 10K pace with 400m jog").blocks)).toEqual([
      "6x[Interval · 1 mi · @ 10K | Recovery · 400 m · @ Recovery]",
    ]);
    expect(summary(run("Warm up a mile").blocks)).toEqual(["Warm-up · 1 mi · @ Easy"]);
  });

  it("keeps custom paces and reports unknown ones in notes", () => {
    const custom = run("3 miles @ 6:45");
    expect(custom.blocks[0]).toMatchObject({ kind: "step", step: { pace: "6:45", distance: 3, unit: "mi" } });
    const unknown = run("4x400 at 800m pace");
    expect(unknown.unknownPaces).toEqual(["800m"]);
    expect(unknown.blocks[0]).toMatchObject({ kind: "repeat", count: 4, steps: [{ pace: null, notes: "800m pace" }] });
  });

  it("keeps leftover words as notes and skips filler-only clauses", () => {
    const { blocks, unparsed } = run("Easy 5 miles then 6x20 sec strides");
    expect(summary(blocks)).toEqual(["Run · 5 mi · @ Easy", "6x[Interval · 20 sec · strides]"]);
    expect(unparsed).toEqual([]);
    expect(run("feel good and have fun").unparsed).toEqual(["feel good and have fun"]);
  });

  it("reads swims: strokes, send-offs and rest", () => {
    const { blocks } = parseRunText("200 free warm up. 4x100 back on 1:45 with 15s rest. 100 easy cool down", { sport: "swim", paceNames });
    expect(blocks.map((b) => (b.kind === "step" ? describeRunStep(b.step, "swim") : `${b.count}x[${b.steps.map((s) => describeRunStep(s, "swim")).join(" | ")}]`))).toEqual([
      "Warm-up · 200 yd · freestyle",
      "4x[Interval · 100 yd · on 1:45 · backstroke | Rest · 15 sec]",
      "Cool-down · 100 yd",
    ]);
  });
});

describe("toRunFormSteps", () => {
  it("builds form rows with sequential repeat group ids", () => {
    const { blocks } = run("warm up 2 miles. 2 sets of 3x400m at 5K pace with 200m jog. 400m jog between sets.");
    const steps = toRunFormSteps(blocks, { startGroupId: 3, defaultUnit: "mi" });
    expect(steps.map((s) => [s.step_type, s.distance_miles, s.distance_unit, s.pace_type, s.repeat_group_id, s.repeat_count])).toEqual([
      ["warmup", "2", "mi", "Easy", null, 1],
      ["interval", "400", "m", "5K", 3, 3],
      ["recovery", "200", "m", "Recovery", 3, 3],
      ["recovery", "400", "m", "Recovery", null, 1],
      ["interval", "400", "m", "5K", 4, 3],
      ["recovery", "200", "m", "Recovery", 4, 3],
    ]);
  });

  it("stores whole minutes in min and the rest in sec", () => {
    const steps = toRunFormSteps(run("20 min easy; 90 sec rest").blocks, { startGroupId: 1, defaultUnit: "mi" });
    expect(steps.map((s) => [s.duration_minutes, s.duration_unit])).toEqual([
      ["20", "min"],
      ["90", "sec"],
    ]);
  });
});
