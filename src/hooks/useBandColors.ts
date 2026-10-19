"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeBandColors, type BandColors } from "@/lib/bandColors";

const EVENT = "bandColorsChanged";

// Fetched once per page load and shared by every instance of the hook, so a
// list of band inputs doesn't each query user_settings.
let cached: BandColors | null = null;
let pending: Promise<BandColors> | null = null;

function fetchBandColors(): Promise<BandColors> {
  pending ??= (async () => {
    // RLS only exposes the signed-in user's own row, so no user filter (or extra auth round trip) is needed.
    const { data } = await createClient().from("user_settings").select("band_colors").maybeSingle();
    cached = normalizeBandColors(data?.band_colors);
    return cached;
  })().catch(() => ({}));
  return pending;
}

/** Call after saving so every mounted hook shows the new colors. */
export function publishBandColors(colors: BandColors) {
  cached = colors;
  pending = Promise.resolve(colors);
  window.dispatchEvent(new Event(EVENT));
}

/** The current user's band level → color mapping ({} until loaded or when unset). */
export function useBandColors(): BandColors {
  const [colors, setColors] = useState<BandColors>(() => cached ?? {});

  useEffect(() => {
    let active = true;
    fetchBandColors().then((c) => active && setColors(c));
    const handler = () => cached && setColors(cached);
    window.addEventListener(EVENT, handler);
    return () => {
      active = false;
      window.removeEventListener(EVENT, handler);
    };
  }, []);

  return colors;
}
