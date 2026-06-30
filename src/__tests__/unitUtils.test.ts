import { describe, it, expect } from "vitest";
import { toMiles, convertDistance, formatPaceForUnit, displayDistance } from "@/lib/unitUtils";

const KM_PER_MI = 1.60934;

// ── toMiles ────────────────────────────────────────────────────────────────────

describe("toMiles", () => {
  it("returns the same value for miles input", () => {
    expect(toMiles(5, "mi")).toBe(5);
  });

  it("converts km to miles", () => {
    expect(toMiles(KM_PER_MI, "km")).toBeCloseTo(1, 5);
  });

  it("converts meters to miles", () => {
    expect(toMiles(1609.34, "m")).toBeCloseTo(1, 5);
  });

  it("handles zero distance", () => {
    expect(toMiles(0, "mi")).toBe(0);
    expect(toMiles(0, "km")).toBe(0);
    expect(toMiles(0, "m")).toBe(0);
  });
});

// ── convertDistance ────────────────────────────────────────────────────────────

describe("convertDistance", () => {
  it("returns the same value when from and to are the same unit", () => {
    expect(convertDistance(5, "mi", "mi")).toBe(5);
    expect(convertDistance(8, "km", "km")).toBe(8);
    expect(convertDistance(400, "m", "m")).toBe(400);
  });

  it("converts miles to km", () => {
    expect(convertDistance(1, "mi", "km")).toBeCloseTo(KM_PER_MI, 3);
  });

  it("converts km to miles", () => {
    expect(convertDistance(KM_PER_MI, "km", "mi")).toBeCloseTo(1, 3);
  });

  it("converts miles to meters", () => {
    expect(convertDistance(1, "mi", "m")).toBeCloseTo(1609.34, 1);
  });

  it("converts meters to km", () => {
    expect(convertDistance(1000, "m", "km")).toBeCloseTo(1000 / 1609.34 * KM_PER_MI, 3);
  });

  it("round-trips mi → km → mi", () => {
    const original = 13.1;
    const roundTrip = convertDistance(convertDistance(original, "mi", "km"), "km", "mi");
    expect(roundTrip).toBeCloseTo(original, 5);
  });
});

// ── formatPaceForUnit ──────────────────────────────────────────────────────────

describe("formatPaceForUnit", () => {
  it("formats per-mile pace for mi unit", () => {
    // 8:00 /mi = 480 sec/mi
    expect(formatPaceForUnit(480, "mi")).toBe("8:00 /mi");
  });

  it("formats per-km pace for km unit", () => {
    // 480 sec/mi → 480 / 1.60934 ≈ 298.3 sec/km → 4:58 /km
    expect(formatPaceForUnit(480, "km")).toBe("4:58 /km");
  });

  it("pads seconds to two digits", () => {
    // 487 sec/mi → 8:07 /mi
    expect(formatPaceForUnit(487, "mi")).toBe("8:07 /mi");
  });

  it("formats a fast pace correctly", () => {
    // 300 sec/mi = 5:00 /mi
    expect(formatPaceForUnit(300, "mi")).toBe("5:00 /mi");
  });
});

// ── displayDistance ────────────────────────────────────────────────────────────

describe("displayDistance", () => {
  it("returns null for null input", () => {
    expect(displayDistance(null, "mi")).toBeNull();
  });

  it("returns null for zero", () => {
    expect(displayDistance(0, "mi")).toBeNull();
  });

  it("formats a whole-mile distance without trailing zeros", () => {
    expect(displayDistance(5, "mi")).toBe("5 mi");
  });

  it("formats a decimal mile distance", () => {
    expect(displayDistance(13.1, "mi")).toBe("13.1 mi");
  });

  it("strips unnecessary trailing zeros", () => {
    expect(displayDistance(5.0, "mi")).toBe("5 mi");
    expect(displayDistance(5.10, "mi")).toBe("5.1 mi");
  });

  it("formats km distances", () => {
    expect(displayDistance(10, "km")).toBe("10 km");
    expect(displayDistance(21.1, "km")).toBe("21.1 km");
  });

  it("rounds meter distances to the nearest integer", () => {
    expect(displayDistance(400, "m")).toBe("400 m");
    expect(displayDistance(400.7, "m")).toBe("401 m");
  });
});
