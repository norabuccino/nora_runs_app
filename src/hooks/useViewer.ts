"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Viewer } from "@/lib/contentOwnership";

const EMPTY: Viewer = { userId: null, isAdmin: false, siteIds: new Set() };

// Fetched once per page load and shared by every instance of the hook.
let pending: Promise<Viewer> | null = null;

function fetchViewer(): Promise<Viewer> {
  pending ??= (async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return EMPTY;
    const [{ data: profile }, { data: siteIds }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase.rpc("site_user_ids"),
    ]);
    return { userId: user.id, isAdmin: profile?.role === "admin", siteIds: new Set((siteIds as string[] | null) ?? []) };
  })().catch(() => EMPTY);
  return pending;
}

/** Who's looking: user id, admin flag and the site account ids, for ownership checks (see contentOwnership.ts). */
export function useViewer(): Viewer & { loaded: boolean } {
  const [viewer, setViewer] = useState<Viewer & { loaded: boolean }>({ ...EMPTY, loaded: false });

  useEffect(() => {
    let active = true;
    fetchViewer().then((v) => active && setViewer({ ...v, loaded: true }));
    return () => { active = false; };
  }, []);

  return viewer;
}
