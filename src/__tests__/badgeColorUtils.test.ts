import { describe, it, expect } from "vitest";
import { buildBadgeColorStyle } from "@/lib/badgeColorUtils";
import type { BadgeColorMap } from "@/lib/badgeColorUtils";

describe("buildBadgeColorStyle", () => {
  it("returns an empty string when no overrides are provided", () => {
    expect(buildBadgeColorStyle({})).toBe("");
  });

  it("generates a :root block and a .dark block", () => {
    const overrides: BadgeColorMap = {
      "workout-run": {
        lightBg: "#dbeafe",
        lightText: "#1e40af",
        darkBg: "#1e3a8a",
        darkText: "#bfdbfe",
      },
    };
    const css = buildBadgeColorStyle(overrides);
    expect(css).toContain(":root {");
    expect(css).toContain(".dark {");
  });

  it("sets light-mode variables inside :root", () => {
    const overrides: BadgeColorMap = {
      "workout-run": {
        lightBg: "#dbeafe",
        lightText: "#1e40af",
        darkBg: "#1e3a8a",
        darkText: "#bfdbfe",
      },
    };
    const css = buildBadgeColorStyle(overrides);
    expect(css).toContain("--badge-workout-run-bg: #dbeafe");
    expect(css).toContain("--badge-workout-run-text: #1e40af");
  });

  it("sets dark-mode variables inside .dark", () => {
    const overrides: BadgeColorMap = {
      "workout-run": {
        lightBg: "#dbeafe",
        lightText: "#1e40af",
        darkBg: "#1e3a8a",
        darkText: "#bfdbfe",
      },
    };
    const css = buildBadgeColorStyle(overrides);
    const darkSection = css.split(".dark {")[1];
    expect(darkSection).toContain("--badge-workout-run-bg: #1e3a8a");
    expect(darkSection).toContain("--badge-workout-run-text: #bfdbfe");
  });

  it("includes all provided keys in the output", () => {
    const overrides: BadgeColorMap = {
      "workout-run": { lightBg: "#a", lightText: "#b", darkBg: "#c", darkText: "#d" },
      "plan-marathon": { lightBg: "#e", lightText: "#f", darkBg: "#g", darkText: "#h" },
    };
    const css = buildBadgeColorStyle(overrides);
    expect(css).toContain("--badge-workout-run-bg");
    expect(css).toContain("--badge-plan-marathon-bg");
  });
});
