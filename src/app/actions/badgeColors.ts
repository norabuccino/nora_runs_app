"use server";

import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/profile";
import { revalidatePath } from "next/cache";
import type { BadgeColorMap } from "@/lib/badgeColorUtils";

export type { BadgeColorEntry, BadgeColorMap } from "@/lib/badgeColorUtils";

export async function getBadgeColors(): Promise<BadgeColorMap> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "badge_colors")
      .single();
    return (data?.value as BadgeColorMap) ?? {};
  } catch {
    return {};
  }
}

export async function saveBadgeColors(colors: BadgeColorMap): Promise<void> {
  const isAdmin = await getIsAdmin();
  if (!isAdmin) throw new Error("Unauthorized");
  const supabase = await createClient();
  await supabase
    .from("app_settings")
    .upsert({ key: "badge_colors", value: colors, updated_at: new Date().toISOString() });
  revalidatePath("/", "layout");
}
