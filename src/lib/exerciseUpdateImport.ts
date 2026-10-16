// "Update existing exercises" import: a CSV with an `id` column updates the
// matching exercises instead of creating new ones. Only columns present in the
// file are touched, and a blank cell leaves that field unchanged. Rows match by
// `id`, or by exact name (case-insensitive) when `id` is blank. The `name`
// column is only used for matching — it is never written.

import { EXERCISE_TYPE_LABELS, LOADING_CATEGORY_LABELS, LOAD_FORMAT_LABELS } from "@/lib/paceUtils";
import { parseSources } from "@/lib/exerciseSources";
import { parseMuscleGroups } from "@/lib/muscleGroups";
import { parseEquipment } from "@/lib/equipment";

export type ExerciseUpdateFields = {
  exercise_type?: string;
  description?: string;
  video_url?: string;
  sources?: string[];
  muscle_groups?: string[];
  equipment?: string[];
  loading_category?: string;
  track_load?: boolean;
  load_format?: string;
  default_increment?: number;
};

export type ExerciseUpdateRow = {
  id: string | null;
  name: string | null;
  fields: ExerciseUpdateFields;
};

export const UPDATABLE_COLUMNS = [
  "exercise_type",
  "description",
  "video_url",
  "source",
  "sources",
  "muscle_groups",
  "equipment",
  "loading_category",
  "track_load",
  "load_format",
  "default_increment",
] as const;

export function isUpdateImport(headers: string[]): boolean {
  return headers.map((h) => h.trim().toLowerCase()).includes("id");
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// Accepts either the stored key or its label ("unilateral_squat" or "Unilateral Squat / Knee Dominant").
function keyFromLabels(value: string, labels: Record<string, string>): string | null {
  const n = normalize(value);
  for (const [key, label] of Object.entries(labels)) {
    if (normalize(key) === n || normalize(label) === n) return key;
  }
  return null;
}

function parseBool(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(v)) return true;
  if (["false", "no", "n", "0"].includes(v)) return false;
  return null;
}

/**
 * Turns parsed CSV records (header → cell) into update rows. Throws with the
 * row number on any invalid value so nothing is half-imported.
 */
export function parseExerciseUpdateRecords(records: Record<string, string>[]): ExerciseUpdateRow[] {
  return records.map((raw, i) => {
    const where = `Row ${i + 2}`;
    const cell = (col: string) => (raw[col] ?? "").trim();
    const id = cell("id") || null;
    const name = cell("name") || null;
    if (!id && !name) throw new Error(`${where}: needs an id or a name to match an existing exercise`);

    const fields: ExerciseUpdateFields = {};
    const pick = (col: string, labels: Record<string, string>, label: string) => {
      const v = cell(col);
      if (!v) return undefined;
      const key = keyFromLabels(v, labels);
      if (!key) throw new Error(`${where}: unknown ${label} "${v}"`);
      return key;
    };

    const type = pick("exercise_type", EXERCISE_TYPE_LABELS, "exercise type");
    if (type) fields.exercise_type = type;
    if (cell("description")) fields.description = cell("description");
    if (cell("video_url")) fields.video_url = cell("video_url");
    const sourceCell = cell("sources") || cell("source");
    if (sourceCell) fields.sources = parseSources(sourceCell);
    if (cell("muscle_groups")) {
      const { groups, unknown } = parseMuscleGroups(cell("muscle_groups"));
      if (unknown.length) throw new Error(`${where}: unknown muscle group "${unknown[0]}"`);
      fields.muscle_groups = groups;
    }
    if (cell("equipment")) {
      const { tags, unknown } = parseEquipment(cell("equipment"));
      if (unknown.length) throw new Error(`${where}: unknown equipment "${unknown[0]}"`);
      fields.equipment = tags;
    }
    const category = pick("loading_category", LOADING_CATEGORY_LABELS, "loading category");
    if (category) fields.loading_category = category;
    if (cell("track_load")) {
      const b = parseBool(cell("track_load"));
      if (b === null) throw new Error(`${where}: track_load must be true or false`);
      fields.track_load = b;
    }
    const format = pick("load_format", LOAD_FORMAT_LABELS, "load format");
    if (format) fields.load_format = format;
    if (cell("default_increment")) {
      const n = Number(cell("default_increment"));
      if (!Number.isFinite(n) || n <= 0) throw new Error(`${where}: default_increment must be a positive number`);
      fields.default_increment = n;
    }
    return { id, name, fields };
  });
}

/** Resolves each update row to an exercise id; rows that match nothing are returned separately. */
export function matchExerciseUpdates(
  rows: ExerciseUpdateRow[],
  existing: { id: string; name: string }[]
): { matched: { id: string; fields: ExerciseUpdateFields }[]; unmatched: string[] } {
  const ids = new Set(existing.map((e) => e.id));
  const byName = new Map<string, string[]>();
  for (const e of existing) {
    const key = e.name.trim().toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), e.id]);
  }
  const matched: { id: string; fields: ExerciseUpdateFields }[] = [];
  const unmatched: string[] = [];
  for (const row of rows) {
    if (row.id && ids.has(row.id)) { matched.push({ id: row.id, fields: row.fields }); continue; }
    const candidates = row.name ? byName.get(row.name.trim().toLowerCase()) ?? [] : [];
    // Only match by name when it's unambiguous.
    if (!row.id && candidates.length === 1) matched.push({ id: candidates[0], fields: row.fields });
    else unmatched.push(row.name ?? row.id ?? "(blank)");
  }
  return { matched, unmatched };
}
