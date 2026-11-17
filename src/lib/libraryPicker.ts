// Narrowing the plan import's "Pick from library" list to the workout type being
// imported, with an optional sub-type (run type / strength type / cross-train type).

import { CROSS_TRAIN_TYPE_LABELS, RUN_TYPE_LABELS, STRENGTH_TYPE_LABELS } from "@/lib/paceUtils";

export interface PickableWorkout {
  id: string;
  title: string;
  type: string;
  run_type?: string | null;
  strength_type?: string | null;
  cross_train_type?: string | null;
}

const SUB_TYPE_LABELS: Record<string, Record<string, string>> = {
  run: RUN_TYPE_LABELS,
  strength: STRENGTH_TYPE_LABELS,
  cross_train: CROSS_TRAIN_TYPE_LABELS,
};

/** The sub-type a workout is filed under for its type, or null. */
export function subTypeOf(w: PickableWorkout): string | null {
  if (w.type === "run") return w.run_type ?? null;
  if (w.type === "strength") return w.strength_type ?? null;
  if (w.type === "cross_train") return w.cross_train_type ?? null;
  return null;
}

export function subTypeLabel(type: string, sub: string): string {
  return SUB_TYPE_LABELS[type]?.[sub] ?? sub.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Sub-types that library workouts of this type actually use, in the label map's order (unknown ones last). */
export function subTypeOptions(library: PickableWorkout[], type: string): { value: string; label: string }[] {
  const used = new Set(library.filter((w) => w.type === type).map(subTypeOf).filter((s): s is string => !!s));
  const order = Object.keys(SUB_TYPE_LABELS[type] ?? {});
  return [...used]
    .sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
    })
    .map((value) => ({ value, label: subTypeLabel(type, value) }));
}

/** Library workouts of `type`, and of `sub` when given ("" = any sub-type). */
export function filterLibrary<T extends PickableWorkout>(library: T[], type: string, sub: string): T[] {
  return library.filter((w) => w.type === type && (!sub || subTypeOf(w) === sub));
}

const CROSS_TRAIN_GUESS: [RegExp, string][] = [
  [/\byoga\b/i, "yoga"],
  [/\bwalk\w*\b/i, "walk"],
  [/\belliptical\b/i, "elliptical"],
  [/\b(mobility|stretch\w*)\b/i, "mobility"],
];

/**
 * The sub-type to start the filter on: the one guessed from the imported text, when the
 * library has workouts filed under it; otherwise "" (any).
 */
export function defaultSubType(
  library: PickableWorkout[],
  type: string,
  guess: { run_type?: string | null; strength_type?: string | null; title?: string }
): string {
  const sub =
    type === "run"
      ? guess.run_type
      : type === "strength"
      ? guess.strength_type
      : type === "cross_train"
      ? CROSS_TRAIN_GUESS.find(([re]) => re.test(guess.title ?? ""))?.[1]
      : null;
  return sub && subTypeOptions(library, type).some((o) => o.value === sub) ? sub : "";
}
