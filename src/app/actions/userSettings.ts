"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeBandColorSets, type BandColorSets } from "@/lib/bandColors";

/** Saves which color the user's own bands are at each band level, per band kind. */
export async function saveBandColors(colors: BandColorSets): Promise<BandColorSets> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const bandColors = normalizeBandColorSets(colors);
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, band_colors: bandColors, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  return bandColors;
}
