// Parses a plain-text list of exercises for the admin bulk import, e.g.
//
//   Goblet Squat
//   Hold a kettlebell at your chest and sit back between your heels.
//   Source: Coach Sam
//
//   Dead Bugs - Lie on your back, arms up, lower opposite arm and leg.
//   Clamshells
//   Copenhagen Plank
//
// - Paragraphs (blank-line separated) with a name line followed by longer
//   text are one exercise: first line = name, the rest = description.
// - A paragraph of short lines is one exercise per line; "Name - description"
//   or "Name: description" splits a line.
// - Labeled lines: "Type:", "Equipment:", "Muscles:"/"Muscle groups:",
//   "Source:"/"Sources:", "Video:", "Description:".
// Equipment and muscle groups not given are suggested from the name and
// description (`suggestExerciseTags`); the type is inferred when not given.

import { EXERCISE_TYPE_LABELS } from "@/lib/paceUtils";
import { parseEquipment } from "@/lib/equipment";
import { parseMuscleGroups } from "@/lib/muscleGroups";
import { parseSources } from "@/lib/exerciseSources";
import { suggestExerciseTags } from "@/lib/exerciseTagSuggestions";

export interface ParsedExerciseEntry {
  name: string;
  description: string | null;
  exercise_type: string | null;
  equipment: string[];
  muscle_groups: string[];
  sources: string[];
  video_url: string | null;
  /** Which tags came from suggestions rather than the text. */
  suggested: { equipment: boolean; muscle_groups: boolean; exercise_type: boolean };
  /** Labeled values that weren't recognized (e.g. unknown equipment). */
  unknown: string[];
}

const LABEL = /^\s*(type|category|equipment|muscles|muscle groups|sources?|video|video url|description|desc)\s*:\s*(.*)$/i;
const UPPER = ["chest", "shoulders", "back_spine", "arms"];
const LOWER = ["hips_glutes", "thighs", "lower_legs", "feet"];

/** Exercise type from words in the name, else from which body regions it works. */
export function inferExerciseType(name: string, muscleGroups: string[]): string | null {
  const t = name.toLowerCase();
  if (/\bwarm ?-?up\b|\bactivation\b/.test(t)) return "warm_up";
  if (/\bstretch\w*\b/.test(t)) return "stretch";
  if (/\bmobility\b|\b(cars|90 ?90|openers?)\b/.test(t)) return "mobility";
  if (/\b(plyo\w*|jumps?|hops?|bounds?|pogos?|skips?|pogo)\b/.test(t)) return "plyos";
  const upper = muscleGroups.some((g) => UPPER.includes(g));
  const lower = muscleGroups.some((g) => LOWER.includes(g));
  if (upper && lower) return "full_body";
  if (upper) return "upper_body";
  if (lower) return "lower_body";
  if (muscleGroups.includes("abdomen")) return "core";
  return null;
}

function exerciseTypeFrom(value: string): string | null {
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (v in EXERCISE_TYPE_LABELS) return v;
  const byLabel = Object.entries(EXERCISE_TYPE_LABELS).find(([, label]) => label.toLowerCase() === value.trim().toLowerCase());
  return byLabel?.[0] ?? null;
}

function splitNameLine(line: string): { name: string; description: string | null } {
  const m = line.match(/^(.+?)\s+[-–—]\s+(.+)$/) ?? line.match(/^([^:]{2,60}):\s+(.+)$/);
  return m ? { name: m[1].trim(), description: m[2].trim() } : { name: line.trim(), description: null };
}

const looksLikeName = (line: string) => line.length <= 60 && !/[.!?]$/.test(line);

function finish(name: string, descriptionLines: string[], labels: Record<string, string>): ParsedExerciseEntry {
  const unknown: string[] = [];
  const description = [labels.description, ...descriptionLines].filter(Boolean).join("\n").trim() || null;
  const suggestions = suggestExerciseTags(name, description ?? "");

  let equipment = suggestions.equipment;
  if (labels.equipment != null) {
    const parsed = parseEquipment(labels.equipment.replace(/,/g, ";"));
    equipment = parsed.tags;
    unknown.push(...parsed.unknown.map((u) => `equipment “${u}”`));
  }
  let muscle_groups = suggestions.muscle_groups;
  if (labels.muscles != null) {
    const parsed = parseMuscleGroups(labels.muscles.replace(/,/g, ";"));
    muscle_groups = parsed.groups;
    unknown.push(...parsed.unknown.map((u) => `muscle group “${u}”`));
  }
  let exercise_type = labels.type != null ? exerciseTypeFrom(labels.type) : null;
  if (labels.type != null && !exercise_type) unknown.push(`type “${labels.type}”`);
  const typeSuggested = exercise_type == null;
  exercise_type ??= inferExerciseType(name, muscle_groups);

  return {
    name: name.replace(/^\s*(?:[-•*·]|\d+[.)])\s+/, "").trim(),
    description,
    exercise_type,
    equipment,
    muscle_groups,
    sources: labels.sources != null ? parseSources(labels.sources) : [],
    video_url: labels.video?.trim() || null,
    suggested: { equipment: labels.equipment == null, muscle_groups: labels.muscles == null, exercise_type: typeSuggested },
    unknown,
  };
}

export function parseExerciseList(text: string): ParsedExerciseEntry[] {
  const entries: ParsedExerciseEntry[] = [];
  for (const paragraph of text.split(/\n\s*\n/)) {
    const lines = paragraph
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    const labels: Record<string, string> = {};
    const plain: string[] = [];
    for (const line of lines) {
      const m = line.match(LABEL);
      if (!m) {
        plain.push(line);
        continue;
      }
      const key = m[1].toLowerCase();
      const k =
        key === "category" ? "type" : key.startsWith("muscle") ? "muscles" : key.startsWith("source") ? "sources" : key.startsWith("video") ? "video" : key === "desc" ? "description" : key;
      labels[k] = m[2];
    }
    if (!plain.length) continue;

    // A list of short lines with no labels: one exercise per line.
    if (plain.length > 1 && Object.keys(labels).length === 0 && plain.every((l) => looksLikeName(splitNameLine(l).name) && l.length <= 120 && (looksLikeName(l) || / [-–—] |: /.test(l)))) {
      for (const line of plain) {
        const { name, description } = splitNameLine(line);
        entries.push(finish(name, description ? [description] : [], {}));
      }
      continue;
    }
    const first = splitNameLine(plain[0]);
    entries.push(finish(first.name, [...(first.description ? [first.description] : []), ...plain.slice(1)], labels));
  }
  return entries.filter((e) => e.name);
}
