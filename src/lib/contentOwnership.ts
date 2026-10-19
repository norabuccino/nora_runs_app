/**
 * Site content vs personal content. Site content is whatever the site account
 * (`profiles.is_site_account`, fetched via the `site_user_ids()` RPC) owns;
 * anything another account creates is personal to it. Mirrors the RLS rules in
 * 20261019130000_site_content_and_plan_only.sql — the database enforces them,
 * these only decide what the UI shows.
 */

export type Ownership = "mine" | "site" | "other";

/** "All" / "Created by me" / "Site" filter on Exercises, Workouts and Plans. */
export type CreatedByFilter = "all" | "mine" | "site";

export const CREATED_BY_LABELS: Record<Exclude<CreatedByFilter, "all">, string> = {
  mine: "Created by me",
  site: "Site",
};

export interface Viewer {
  userId: string | null;
  isAdmin: boolean;
  siteIds: ReadonlySet<string>;
}

export function ownershipOf(ownerId: string, viewer: Viewer): Ownership {
  if (viewer.siteIds.has(ownerId)) return "site";
  if (ownerId === viewer.userId) return "mine";
  return "other";
}

/** A plan's ownership — a personal copy of a site plan counts as site, not "mine". */
export function planOwnershipOf(plan: { user_id: string; source_plan_id: string | null }, viewer: Viewer): Ownership {
  if (plan.source_plan_id) return "site";
  return ownershipOf(plan.user_id, viewer);
}

export function matchesCreatedBy(filter: CreatedByFilter, ownership: Ownership): boolean {
  return filter === "all" || filter === ownership;
}

/** Own items, plus site items for admins (the site account itself counts as owning them). */
export function canEditContent(ownerId: string, viewer: Viewer): boolean {
  return ownerId === viewer.userId || (viewer.isAdmin && viewer.siteIds.has(ownerId));
}
