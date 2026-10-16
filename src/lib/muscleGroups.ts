// Fixed list of muscle groups an exercise can be tagged with (multi-select).
// Keys match the CHECK constraint on exercises.muscle_groups.

export const MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  back_spine: "Back & Spine",
  abdomen: "Abdomen",
  arms: "Arms",
  hips_glutes: "Hips & Glutes",
  thighs: "Thighs",
  lower_legs: "Lower Legs",
  feet: "Feet",
};

export const MUSCLE_GROUPS = Object.keys(MUSCLE_GROUP_LABELS);

const ORDER = new Map(MUSCLE_GROUPS.map((g, i) => [g, i]));

// Keeps only valid keys, de-duplicated, in the canonical head-to-toe order.
export function sortMuscleGroups(groups: string[] | null | undefined): string[] {
  return Array.from(new Set((groups ?? []).filter((g) => ORDER.has(g)))).sort(
    (a, b) => ORDER.get(a)! - ORDER.get(b)!
  );
}

export function toggleMuscleGroup(groups: string[], group: string): string[] {
  return groups.includes(group)
    ? groups.filter((g) => g !== group)
    : sortMuscleGroups([...groups, group]);
}

function normalizeToken(s: string): string {
  return s.trim().toLowerCase().replace(/&|\band\b/g, " ").replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
}

const LOOKUP = new Map<string, string>(
  MUSCLE_GROUPS.flatMap((key) => [
    [normalizeToken(key), key],
    [normalizeToken(MUSCLE_GROUP_LABELS[key]), key],
  ])
);

// Parses import input — "Chest; Arms", "hips_glutes", or a JSON array — accepting
// either keys or labels (case-insensitive). Unknown names are returned separately.
export function parseMuscleGroups(input: unknown): { groups: string[]; unknown: string[] } {
  const tokens = Array.isArray(input)
    ? input.filter((v): v is string => typeof v === "string")
    : typeof input === "string"
      ? input.split(/[;|]/)
      : [];
  const groups: string[] = [];
  const unknown: string[] = [];
  for (const raw of tokens) {
    if (!raw.trim()) continue;
    const key = LOOKUP.get(normalizeToken(raw));
    if (key) groups.push(key);
    else unknown.push(raw.trim());
  }
  return { groups: sortMuscleGroups(groups), unknown };
}

export function formatMuscleGroups(groups: string[] | null | undefined): string {
  return sortMuscleGroups(groups).map((g) => MUSCLE_GROUP_LABELS[g]).join("; ");
}
