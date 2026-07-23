import { describe, it, expect } from "vitest";
import { csvEscape, splitCSVLine } from "@/lib/csvUtils";

describe("csvEscape", () => {
  it("returns an empty string for null, undefined, or empty input", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
    expect(csvEscape("")).toBe("");
  });

  it("wraps a plain string in quotes", () => {
    expect(csvEscape("Easy run")).toBe('"Easy run"');
  });

  it("escapes embedded double quotes by doubling them", () => {
    expect(csvEscape('Say "hello"')).toBe('"Say ""hello"""');
  });

  it("leaves embedded commas untouched (the surrounding quotes protect them)", () => {
    expect(csvEscape("Warm up, then run")).toBe('"Warm up, then run"');
  });
});

describe("splitCSVLine", () => {
  it("splits a simple unquoted line on commas", () => {
    expect(splitCSVLine("run,easy_run,Easy run")).toEqual(["run", "easy_run", "Easy run"]);
  });

  it("does not split on a comma inside a quoted field", () => {
    expect(splitCSVLine('run,easy_run,"Warm up, then run 5 miles"')).toEqual([
      "run",
      "easy_run",
      "Warm up, then run 5 miles",
    ]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(splitCSVLine('run,,"Say ""hello"" to the coach"')).toEqual([
      "run",
      "",
      'Say "hello" to the coach',
    ]);
  });

  it("round-trips through csvEscape for a field with both commas and quotes", () => {
    const original = 'Warm up, then say "go"';
    const line = `run,${csvEscape(original)}`;
    expect(splitCSVLine(line)).toEqual(["run", original]);
  });

  it("trims whitespace around unquoted fields", () => {
    expect(splitCSVLine("run,  easy_run ,  Easy run  ")).toEqual(["run", "easy_run", "Easy run"]);
  });

  it("handles an empty trailing field", () => {
    expect(splitCSVLine("run,easy_run,")).toEqual(["run", "easy_run", ""]);
  });
});
