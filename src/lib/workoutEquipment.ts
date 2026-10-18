// A workout's equipment list = the equipment of its exercises, plus anything
// the user added to the workout, minus anything derived they removed. Storing
// only the adjustments keeps the list in sync when exercises change.

import { sortEquipment } from "@/lib/equipment";

export interface EquipmentAdjustments {
  added: string[];
  removed: string[];
}

/** Union of the equipment of every exercise used by the steps, in canonical order. */
export function deriveEquipment(
  exerciseIds: (string | null | undefined)[],
  equipmentByExercise: Record<string, string[] | null | undefined>
): string[] {
  return sortEquipment(exerciseIds.flatMap((id) => (id ? equipmentByExercise[id] ?? [] : [])));
}

export function resolveEquipment(derived: string[], adj: EquipmentAdjustments): string[] {
  const removed = new Set(adj.removed);
  return sortEquipment([...derived.filter((e) => !removed.has(e)), ...adj.added]);
}

/** Derived items the user removed (and that are still derived) — shown so they can be restored. */
export function removedDerivedEquipment(derived: string[], adj: EquipmentAdjustments): string[] {
  const removed = new Set(adj.removed);
  return derived.filter((e) => removed.has(e) && !adj.added.includes(e));
}

export function addEquipment(adj: EquipmentAdjustments, derived: string[], key: string): EquipmentAdjustments {
  const removed = adj.removed.filter((e) => e !== key);
  const added = derived.includes(key) ? adj.added.filter((e) => e !== key) : sortEquipment([...adj.added, key]);
  return { added, removed };
}

export function removeEquipment(adj: EquipmentAdjustments, derived: string[], key: string): EquipmentAdjustments {
  const added = adj.added.filter((e) => e !== key);
  const removed = derived.includes(key) ? sortEquipment([...adj.removed, key]) : adj.removed.filter((e) => e !== key);
  return { added, removed };
}

/** Drops adjustments that no longer do anything (e.g. removing equipment no exercise needs any more). */
export function pruneAdjustments(adj: EquipmentAdjustments, derived: string[]): EquipmentAdjustments {
  return {
    added: sortEquipment(adj.added.filter((e) => !derived.includes(e))),
    removed: sortEquipment(adj.removed.filter((e) => derived.includes(e))),
  };
}
