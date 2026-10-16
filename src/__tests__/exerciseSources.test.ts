import { describe, it, expect } from "vitest";
import {
  normalizeSources,
  parseSources,
  formatSources,
  addSources,
  removeSource,
  hasSource,
  collectSources,
} from "@/lib/exerciseSources";

describe("normalizeSources", () => {
  it("trims, drops blanks, and de-duplicates case-insensitively keeping the first spelling", () => {
    expect(normalizeSources([" Coach ", "", null, "coach", "YouTube", undefined])).toEqual(["Coach", "YouTube"]);
  });
});

describe("parseSources", () => {
  it("splits a CSV cell on semicolons (and pipes)", () => {
    expect(parseSources("Coach; YouTube | Book")).toEqual(["Coach", "YouTube", "Book"]);
  });

  it("keeps commas inside a single source", () => {
    expect(parseSources("Smith, J. — Strength Book")).toEqual(["Smith, J. — Strength Book"]);
  });

  it("accepts a JSON array and ignores non-strings", () => {
    expect(parseSources(["Coach", 3, " Book "])).toEqual(["Coach", "Book"]);
  });

  it("returns [] for empty or missing input", () => {
    expect(parseSources("")).toEqual([]);
    expect(parseSources(undefined)).toEqual([]);
    expect(parseSources(null)).toEqual([]);
  });

  it("round-trips with formatSources", () => {
    const sources = ["Coach", "YouTube"];
    expect(parseSources(formatSources(sources))).toEqual(sources);
  });
});

describe("formatSources", () => {
  it("joins with '; ' and handles null", () => {
    expect(formatSources(["Coach", "Book"])).toBe("Coach; Book");
    expect(formatSources(null)).toBe("");
  });
});

describe("addSources / removeSource / hasSource", () => {
  it("adds without duplicating existing sources", () => {
    expect(addSources(["Coach"], ["coach", "Book"])).toEqual(["Coach", "Book"]);
  });

  it("removes case-insensitively", () => {
    expect(removeSource(["Coach", "Book"], "coach")).toEqual(["Book"]);
  });

  it("checks membership case-insensitively and tolerates null", () => {
    expect(hasSource(["Coach"], "COACH")).toBe(true);
    expect(hasSource(["Coach"], "Book")).toBe(false);
    expect(hasSource(null, "Coach")).toBe(false);
  });
});

describe("collectSources", () => {
  it("returns every distinct source across exercises, sorted", () => {
    expect(
      collectSources([{ sources: ["YouTube", "Coach"] }, { sources: ["coach", "Book"] }, { sources: [] }])
    ).toEqual(["Book", "Coach", "YouTube"]);
  });
});
