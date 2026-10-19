import type { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/contentOwnership";

/**
 * Whether the signed-in user can edit a plan: their own plans (including
 * personal copies), and site plans for admins. Same rule as the RLS policies
 * (`can_edit_plan()`), so server actions don't reimplement it.
 */
export async function canEditPlan(supabase: Awaited<ReturnType<typeof createClient>>, planId: string): Promise<boolean> {
  const { data } = await supabase.rpc("can_edit_plan", { pid: planId });
  return data === true;
}

/** Server-side Viewer (see contentOwnership.ts) for the signed-in user. */
export async function getServerViewer(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<Viewer> {
  const [{ data: profile }, { data: siteIds }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).single(),
    supabase.rpc("site_user_ids"),
  ]);
  return { userId, isAdmin: profile?.role === "admin", siteIds: new Set((siteIds as string[] | null) ?? []) };
}
