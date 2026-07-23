"use client";

import { useState, useEffect, type Dispatch, type SetStateAction } from "react";

const QUERY = "(max-width: 768px)";

// Defaults to compact below the md breakpoint, then tracks live viewport
// resizes. The setter is also exposed so callers can offer a manual toggle.
export function useCompactMode(): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    setCompact(mql.matches);
    const handler = (e: MediaQueryListEvent) => setCompact(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return [compact, setCompact];
}
