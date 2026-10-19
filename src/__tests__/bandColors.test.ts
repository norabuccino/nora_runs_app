import { describe, it, expect } from "vitest";
import { bandColorFor, bandLevelText, normalizeBandColors } from "@/lib/bandColors";
import { formatLoad } from "@/lib/strengthProgression";

describe("normalizeBandColors", () => {
  it("keeps known levels and colors only", () => {
    expect(normalizeBandColors({ "1": "yellow", "3": "red", "6": "blue", "2": "plaid", "4": 5 })).toEqual({ "1": "yellow", "3": "red" });
  });

  it("treats anything that isn't an object as no colors", () => {
    expect(normalizeBandColors(null)).toEqual({});
    expect(normalizeBandColors(["red"])).toEqual({});
    expect(normalizeBandColors("red")).toEqual({});
  });
});

describe("bandLevelText", () => {
  it("names the level, with the user's color when set", () => {
    expect(bandLevelText(3)).toBe("Medium");
    expect(bandLevelText(3, { "3": "red" })).toBe("Medium (red)");
    expect(bandLevelText(2, { "3": "red" })).toBe("Light");
    expect(bandLevelText(9, { "3": "red" })).toBeNull();
  });

  it("looks up the color option", () => {
    expect(bandColorFor(4, { "4": "green" })?.label).toBe("Green");
    expect(bandColorFor(4, {})).toBeNull();
  });
});

describe("formatLoad with band colors", () => {
  it("includes the color in band loads", () => {
    expect(formatLoad(3, "band", { "3": "red" })).toBe("Medium (red) band");
    expect(formatLoad(3, "band")).toBe("Medium band");
    expect(formatLoad(30, "per_hand", { "3": "red" })).toBe("30 lb/hand");
  });
});
