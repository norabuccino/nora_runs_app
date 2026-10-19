import { describe, it, expect } from "vitest";
import { SUGGESTION_INDICATORS, SUGGESTION_ORDER } from "@/lib/progressionGuide";

describe("progression suggestion indicators", () => {
  it("lists every suggestion once in the legend order", () => {
    expect([...SUGGESTION_ORDER].sort()).toEqual(Object.keys(SUGGESTION_INDICATORS).sort());
  });

  it("gives each suggestion a distinct icon", () => {
    const icons = Object.values(SUGGESTION_INDICATORS).map((s) => s.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
