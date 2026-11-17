// What to tell someone before they delete a plan, from how it's used (plan_usage).

export interface PlanUsageCounts {
  followers: number;
  followingSelf: boolean;
  copies: number;
}

const people = (n: number) => `${n} ${n === 1 ? "person is" : "people are"}`;

/**
 * Warnings for the delete confirmation, most serious first, and whether the delete is allowed
 * (only admins can delete a plan other people follow).
 */
export function planDeleteWarnings(usage: PlanUsageCounts, isAdmin: boolean): { warnings: string[]; blocked: string | null } {
  if (usage.followers > 0 && !isAdmin) {
    return { warnings: [], blocked: `${people(usage.followers)} following this plan, so only an admin can delete it.` };
  }
  const warnings: string[] = [];
  if (usage.followers > 0) {
    warnings.push(
      `${people(usage.followers)} following this plan. Deleting it removes it from their plans, along with the workouts they've logged for it.`
    );
  }
  if (usage.followingSelf) warnings.push("You're following this plan — your logged workouts for it will be deleted too.");
  if (usage.copies > 0) {
    warnings.push(`${usage.copies} ${usage.copies === 1 ? "person has their own copy" : "people have their own copies"} of this plan — copies aren't affected.`);
  }
  return { warnings, blocked: null };
}
