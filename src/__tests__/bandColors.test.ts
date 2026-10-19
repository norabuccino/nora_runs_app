import { describe, it, expect } from "vitest";
import { bandColorFor, bandColorsForLoad, bandLevelText, normalizeBandColors, normalizeBandColorSets } from "@/lib/bandColors";
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
    expect(formatLoad(3, "band", { band: { "3": "red" } })).toBe("Medium (red) band");
    expect(formatLoad(3, "band")).toBe("Medium band");
    expect(formatLoad(30, "per_hand", { band: { "3": "red" } })).toBe("30 lb/hand");
  });

  it("uses the mini band colors for mini band loads", () => {
    const sets = { band: { "3": "red" }, mini_band: { "3": "blue" } };
    expect(formatLoad(3, "mini_band", sets)).toBe("Medium (blue) mini band");
    expect(formatLoad(3, "band", sets)).toBe("Medium (red) band");
    expect(formatLoad(3, "mini_band", { band: { "3": "red" } })).toBe("Medium mini band");
    expect(formatLoad(9, "mini_band")).toBe("Mini band level 9");
  });
});

describe("normalizeBandColorSets", () => {
  it("normalizes each band kind and drops unknown or empty kinds", () => {
    expect(
      normalizeBandColorSets({ band: { "1": "yellow", "7": "red" }, mini_band: { "2": "plaid" }, cable: { "1": "red" } })
    ).toEqual({ band: { "1": "yellow" } });
  });

  it("ignores the old flat shape and non-objects", () => {
    expect(normalizeBandColorSets({ "2": "green" })).toEqual({});
    expect(normalizeBandColorSets(null)).toEqual({});
    expect(normalizeBandColorSets(["band"])).toEqual({});
  });
});

describe("bandColorsForLoad", () => {
  const sets = { band: { "1": "red" }, mini_band: { "1": "green" } };
  it("picks the set for the band kind", () => {
    expect(bandColorsForLoad(sets, "band")).toEqual({ "1": "red" });
    expect(bandColorsForLoad(sets, "mini_band")).toEqual({ "1": "green" });
  });
  it("returns nothing for other load formats", () => {
    expect(bandColorsForLoad(sets, "per_hand")).toBeUndefined();
    expect(bandColorsForLoad(undefined, "band")).toBeUndefined();
  });
});
