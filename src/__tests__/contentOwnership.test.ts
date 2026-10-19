import { describe, it, expect } from "vitest";
import { canEditContent, matchesCreatedBy, ownershipOf, planOwnershipOf, type Viewer } from "@/lib/contentOwnership";

const SITE = "site-account";
const ME = "me";
const user: Viewer = { userId: ME, isAdmin: false, siteIds: new Set([SITE]) };
const admin: Viewer = { ...user, isAdmin: true };

describe("ownershipOf", () => {
  it("tells site, own and other people's content apart", () => {
    expect(ownershipOf(SITE, user)).toBe("site");
    expect(ownershipOf(ME, user)).toBe("mine");
    expect(ownershipOf("someone-else", user)).toBe("other");
  });

  it("treats the site account's own content as site, not mine", () => {
    expect(ownershipOf(SITE, { ...admin, userId: SITE })).toBe("site");
  });
});

describe("planOwnershipOf", () => {
  it("counts a personal copy of a site plan as site", () => {
    expect(planOwnershipOf({ user_id: ME, source_plan_id: "site-plan" }, user)).toBe("site");
    expect(planOwnershipOf({ user_id: ME, source_plan_id: null }, user)).toBe("mine");
    expect(planOwnershipOf({ user_id: SITE, source_plan_id: null }, user)).toBe("site");
  });
});

describe("matchesCreatedBy", () => {
  it("matches everything for all, else only the chosen ownership", () => {
    expect(matchesCreatedBy("all", "other")).toBe(true);
    expect(matchesCreatedBy("mine", "mine")).toBe(true);
    expect(matchesCreatedBy("mine", "site")).toBe(false);
    expect(matchesCreatedBy("site", "other")).toBe(false);
  });
});

describe("canEditContent", () => {
  it("lets users edit only their own content", () => {
    expect(canEditContent(ME, user)).toBe(true);
    expect(canEditContent(SITE, user)).toBe(false);
  });

  it("lets admins edit site content too, but not other users' content", () => {
    expect(canEditContent(SITE, admin)).toBe(true);
    expect(canEditContent("someone-else", admin)).toBe(false);
  });
});
