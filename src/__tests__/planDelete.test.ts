import { describe, it, expect } from "vitest";
import { planDeleteWarnings } from "@/lib/planDelete";

describe("planDeleteWarnings", () => {
  it("warns an admin how many people follow the plan, first", () => {
    const { warnings, blocked } = planDeleteWarnings({ followers: 3, followingSelf: true, copies: 1 }, true);
    expect(blocked).toBeNull();
    expect(warnings[0]).toMatch(/^3 people are following this plan/);
    expect(warnings[1]).toMatch(/You're following this plan/);
    expect(warnings[2]).toMatch(/1 person has their own copy/);
  });

  it("uses singular wording for one follower", () => {
    expect(planDeleteWarnings({ followers: 1, followingSelf: false, copies: 0 }, true).warnings).toEqual([
      "1 person is following this plan. Deleting it removes it from their plans, along with the workouts they've logged for it.",
    ]);
  });

  it("blocks a non-admin when other people follow the plan", () => {
    expect(planDeleteWarnings({ followers: 2, followingSelf: false, copies: 0 }, false)).toEqual({
      warnings: [],
      blocked: "2 people are following this plan, so only an admin can delete it.",
    });
  });

  it("has nothing to say about an unused plan", () => {
    expect(planDeleteWarnings({ followers: 0, followingSelf: false, copies: 0 }, false)).toEqual({ warnings: [], blocked: null });
  });
});
