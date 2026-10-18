"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Loads the equipment tags of the given library exercises, fetching only ids
 * it hasn't seen yet (so adding an exercise in a form is a single small query).
 * `loaded` is true once every requested id has been fetched.
 */
export function useExerciseEquipment(exerciseIds: (string | null | undefined)[]) {
  const [equipmentByExercise, setEquipmentByExercise] = useState<Record<string, string[]>>({});
  const ids = Array.from(new Set(exerciseIds.filter((id): id is string => !!id))).sort();
  const missing = ids.filter((id) => !(id in equipmentByExercise));
  const missingKey = missing.join(",");

  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    const toFetch = missingKey.split(",");
    async function fetchEquipment() {
      const supabase = createClient();
      const { data } = await supabase.from("exercises").select("id, equipment").in("id", toFetch);
      if (cancelled) return;
      setEquipmentByExercise((prev) => {
        const next = { ...prev };
        // Ids we can't see (deleted / someone else's private exercise) count as no equipment.
        for (const id of toFetch) next[id] = [];
        for (const row of data ?? []) next[row.id] = row.equipment ?? [];
        return next;
      });
    }
    fetchEquipment();
    return () => {
      cancelled = true;
    };
  }, [missingKey]);

  return { equipmentByExercise, loaded: missing.length === 0 };
}
