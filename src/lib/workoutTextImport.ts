// Parses pasted plain text ("push ups - 3 sets, 8-10 reps; pull ups - 3x8")
// into strength workout steps for the workout forms' "Paste exercises" import.
//
// Grammar (case-insensitive, one exercise per line or per `;`):
//   name [- | : | ,] prescription
//   prescription tokens: 3x10, 3 × 8-10, 3 sets, 3 rounds, 10 reps, 8-10 reps,
//     x10, 30s / 30 sec / 1 min / 1:30, 3x30s, each side / per leg / L/R,
//     @ 20 lb, 20lb, 20 kg, BW / bodyweight, light / moderate / heavy.
//   Anything else after the name becomes the step's notes.
//   "Rest 60s" → a rest step.
// Groups:
//   "Superset (3 rounds):", "Circuit x3:", "3 rounds:" header → superset of the
//     following lines (until a blank line or the next header); exercises may
//     follow the colon on the same line.
//   A1 / A2 / B1 prefixes → a superset per letter, rounds from the first exercise's sets.
//   Any other "Header:" line (e.g. "Warm up:") → named group; exercises keep their own sets.

import type { WorkoutStepFormRow } from "@/components/WorkoutForm";
import type { DistanceUnit } from "@/lib/unitUtils";

export interface ParsedExercise {
  raw: string;
  name: string;
  sets: number | null;
  reps: number | null;
  repsMax: number | null;
  durationSeconds: number | null;
  durationMaxSeconds: number | null;
  bothSides: boolean;
  weight: string | null;
  notes: string | null;
  isRest: boolean;
}

export type ParsedBlock =
  | { kind: "single"; exercise: ParsedExercise }
  | { kind: "superset"; name: string | null; rounds: number; exercises: ParsedExercise[] }
  | { kind: "group"; name: string; exercises: ParsedExercise[] };

export interface ParsedWorkout {
  blocks: ParsedBlock[];
  /** Lines that had text but no recognizable exercise name. */
  unparsed: string[];
}

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const SEC_UNIT = String.raw`(s|secs?|seconds?|m|mins?|minutes?)`;
const LIST_PREFIX = /^\s*(?:[-•*·]|\d+[.)])\s+/;
const LETTER_PREFIX = /^\s*([a-z])(\d+)\s*[.):-]?\s+/i;
const GROUP_KEYWORDS = /\b(superset|super set|circuit|giant set|tri-?set|rounds?)\b/i;

function toSeconds(value: number, unit: string): number {
  return Math.round(unit.toLowerCase().startsWith("m") ? value * 60 : value);
}

function emptyExercise(raw: string): ParsedExercise {
  return {
    raw,
    name: "",
    sets: null,
    reps: null,
    repsMax: null,
    durationSeconds: null,
    durationMaxSeconds: null,
    bothSides: false,
    weight: null,
    notes: null,
    isRest: false,
  };
}

// Unambiguous prescription tokens — safe to split on even inside a name.
const STRONG_TOKEN =
  /\b\d+\s*[x×]\s*\d+|\b\d+(?:\s*[-–]\s*\d+)?\s*(?:sets?|reps?|rounds?|s|secs?|seconds?|mins?|minutes?)\b|\bx\s*\d+\b|\b\d+:[0-5]\d\b|\b(?:each|per)\s+(?:side|leg|arm)s?\b|\bL\s*\/\s*R\b|@|\b(?:bw|bodyweight|amrap)\b/i;

/**
 * Index where the prescription starts when there's no explicit separator.
 * Prefers unambiguous tokens ("Hip 90-90 3x5" splits at 3x5); with `loose`, any digit.
 */
function firstPrescriptionIndex(text: string, loose = true): number {
  const strong = text.match(STRONG_TOKEN);
  if (strong?.index != null) return strong.index;
  return loose ? text.search(/\d/) : -1;
}

/** Pulls prescription tokens out of `text` into `ex`; returns whatever wasn't understood. */
function extractTokens(text: string, ex: ParsedExercise): string {
  let rest = ` ${text} `;
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = rest.match(re);
    if (!m || m.index == null) return;
    fn(m);
    rest = `${rest.slice(0, m.index)} ${rest.slice(m.index + m[0].length)}`;
  };

  // Load
  take(/@\s*(\d+(?:\.\d+)?\s*(?:lbs?|kg|#)?|[a-z]+)/i, (m) => (ex.weight = m[1].trim()));
  take(new RegExp(String.raw`\b${NUM}\s*(lbs?|kg|#)(?=\W)`, "i"), (m) => (ex.weight ??= `${m[1]} ${m[2] === "#" ? "lb" : m[2].toLowerCase()}`));
  take(/\b(bw|bodyweight|body weight)\b/i, () => (ex.weight ??= "Bodyweight"));
  take(/\b(light|moderate|heavy)\b/i, (m) => (ex.weight ??= m[1].toLowerCase()));

  // Sides
  take(/\b(?:each|per)\s+(?:side|leg|arm)s?\b|\/\s*(?:side|leg|arm)\b|\bL\s*\/\s*R\b/i, () => (ex.bothSides = true));

  // sets × reps / sets × duration
  take(
    new RegExp(String.raw`\b(\d+)\s*[x×]\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*${SEC_UNIT}?(?=\W)`, "i"),
    (m) => {
      ex.sets = parseInt(m[1], 10);
      if (m[4]) {
        ex.durationSeconds = toSeconds(parseInt(m[2], 10), m[4]);
        if (m[3]) ex.durationMaxSeconds = toSeconds(parseInt(m[3], 10), m[4]);
      } else {
        ex.reps = parseInt(m[2], 10);
        if (m[3]) ex.repsMax = parseInt(m[3], 10);
      }
    }
  );
  take(/\b(\d+)\s*(?:sets?|rounds?)\b/i, (m) => (ex.sets ??= parseInt(m[1], 10)));

  // Duration
  take(/\b(\d+):([0-5]\d)\b/, (m) => (ex.durationSeconds ??= parseInt(m[1], 10) * 60 + parseInt(m[2], 10)));
  take(new RegExp(String.raw`\b${NUM}(?:\s*[-–]\s*${NUM})?\s*${SEC_UNIT}(?=\W)`, "i"), (m) => {
    if (ex.durationSeconds != null) return;
    ex.durationSeconds = toSeconds(parseFloat(m[1]), m[3]);
    if (m[2]) ex.durationMaxSeconds = toSeconds(parseFloat(m[2]), m[3]);
  });

  // Reps
  take(/(?:\bx\s*(\d+)(?:\s*[-–]\s*(\d+))?|\b(\d+)(?:\s*[-–]\s*(\d+))?\s*reps?)\b/i, (m) => {
    if (ex.reps != null) return;
    ex.reps = parseInt(m[1] ?? m[3], 10);
    const max = m[2] ?? m[4];
    if (max) ex.repsMax = parseInt(max, 10);
  });
  // A bare range or number left over ("push ups, 8-10") reads as reps.
  take(/\b(\d+)(?:\s*[-–]\s*(\d+))?\b/, (m) => {
    if (ex.reps != null || ex.durationSeconds != null) return;
    ex.reps = parseInt(m[1], 10);
    if (m[2]) ex.repsMax = parseInt(m[2], 10);
  });

  return rest
    .replace(/[()[\]]/g, " ")
    .replace(/\b(reps?|of|for|x|and|with|each)\b/gi, " ")
    .replace(/\s*[,;:–—-]+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses one exercise ("Goblet squat - 3x10 @ 25 lb"). Null when there's no name. */
export function parseExerciseLine(line: string): ParsedExercise | null {
  const raw = line.trim();
  const text = raw.replace(LIST_PREFIX, "");
  if (!text) return null;
  const ex = emptyExercise(raw);

  let name: string;
  let prescription: string;
  const sep = text.match(/\s[-–—]\s|:|,/);
  if (sep?.index != null && sep.index > 0) {
    name = text.slice(0, sep.index);
    prescription = text.slice(sep.index + sep[0].length);
  } else {
    const i = firstPrescriptionIndex(text);
    name = i > 0 ? text.slice(0, i) : i === 0 ? "" : text;
    prescription = i >= 0 ? text.slice(i) : "";
  }
  // Prescription tokens written into the name part ("Push ups 3x10 - slow") still count.
  const i = firstPrescriptionIndex(name, false);
  if (i > 0) {
    prescription = `${name.slice(i)} ${prescription}`;
    name = name.slice(0, i);
  }

  name = name.replace(/[()[\]]/g, " ").replace(/\s+/g, " ").trim().replace(/[,:;–—-]+$/, "").trim();
  if (!name) return null;

  const leftover = extractTokens(prescription, ex);
  ex.name = name;
  ex.isRest = /^rest\b/i.test(name);
  if (ex.isRest) {
    const extra = name.replace(/^rest\b/i, "").trim();
    ex.name = "Rest";
    ex.notes = [extra, leftover].filter(Boolean).join(" ") || null;
  } else {
    ex.notes = leftover || null;
  }
  return ex;
}

interface Header {
  kind: "superset" | "group";
  name: string | null;
  rounds: number | null;
}

/** "Superset A (3 rounds)", "Circuit x3", "3 rounds", "Warm up" → group header info. */
function parseHeader(text: string): Header {
  let rounds: number | null = null;
  const m = text.match(/\b(\d+)\s*(?:rounds?|sets?|x)\b|\bx\s*(\d+)\b/i);
  if (m) rounds = parseInt(m[1] ?? m[2], 10);
  const name = text
    .replace(/\b(\d+)\s*(?:rounds?|sets?|x)\b|\bx\s*(\d+)\b/gi, " ")
    .replace(/[()[\]]/g, " ")
    .replace(/\s*[-–—,]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const isSuperset = rounds != null || GROUP_KEYWORDS.test(text);
  return { kind: isSuperset ? "superset" : "group", name: name || null, rounds };
}

export function parseWorkoutText(text: string): ParsedWorkout {
  const blocks: ParsedBlock[] = [];
  const unparsed: string[] = [];
  let header: Header | null = null;
  let groupItems: ParsedExercise[] = [];
  let letter: string | null = null;
  let letterItems: ParsedExercise[] = [];

  const flushLetter = () => {
    if (letterItems.length === 1) blocks.push({ kind: "single", exercise: letterItems[0] });
    else if (letterItems.length > 1) {
      const rounds = letterItems.find((e) => e.sets != null)?.sets ?? 1;
      blocks.push({ kind: "superset", name: null, rounds, exercises: letterItems.map((e) => ({ ...e, sets: null })) });
    }
    letter = null;
    letterItems = [];
  };
  const flushGroup = () => {
    if (header && groupItems.length) {
      if (header.kind === "superset") {
        const rounds = header.rounds ?? groupItems.find((e) => e.sets != null)?.sets ?? 1;
        blocks.push({ kind: "superset", name: header.name, rounds, exercises: groupItems.map((e) => ({ ...e, sets: null })) });
      } else {
        blocks.push({ kind: "group", name: header.name ?? "Group", exercises: groupItems });
      }
    }
    header = null;
    groupItems = [];
  };
  const addItem = (item: string) => {
    if (!item.trim()) return;
    const letterMatch = header ? null : item.match(LETTER_PREFIX);
    const ex = parseExerciseLine(letterMatch ? item.slice(letterMatch[0].length) : item);
    if (!ex) {
      unparsed.push(item.trim());
      return;
    }
    if (header) {
      groupItems.push(ex);
    } else if (letterMatch) {
      const key = letterMatch[1].toUpperCase();
      if (letter !== key) flushLetter();
      letter = key;
      letterItems.push(ex);
    } else {
      flushLetter();
      blocks.push({ kind: "single", exercise: ex });
    }
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(LIST_PREFIX, "").trim();
    if (!line) {
      flushLetter();
      flushGroup();
      continue;
    }
    // "Warm up:" — a header on its own line.
    const own = line.match(/^([^:;]+):\s*$/);
    // "Superset (3 rounds): a; b" — a superset header with exercises after the colon.
    const inline = line.match(/^([^:;]+):\s*(.+)$/);
    if (own) {
      flushLetter();
      flushGroup();
      header = parseHeader(own[1]);
    } else if (inline && GROUP_KEYWORDS.test(inline[1]) && firstPrescriptionIndex(inline[1].replace(/\d+\s*(rounds?|sets?|x)|x\s*\d+/gi, "")) < 0) {
      flushLetter();
      flushGroup();
      header = parseHeader(inline[1]);
      inline[2].split(";").forEach(addItem);
    } else {
      line.split(";").forEach(addItem);
    }
  }
  flushLetter();
  flushGroup();
  return { blocks, unparsed };
}

/** Whether a line is part of the exercise list (has a prescription, an A1 prefix, a group header or a rest) — vs. a title or description. */
export function isExerciseLine(line: string): boolean {
  const text = line.replace(LIST_PREFIX, "").trim();
  return STRONG_TOKEN.test(text) || LETTER_PREFIX.test(text) || /:\s*$/.test(text) || /^rest\b/i.test(text) || (GROUP_KEYWORDS.test(text) && text.includes(":"));
}

/** Every parsed exercise in order — the index is how resolutions are keyed. */
export function flattenExercises(blocks: ParsedBlock[]): ParsedExercise[] {
  return blocks.flatMap((b) => (b.kind === "single" ? [b.exercise] : b.exercises));
}

/** One-line summary of what was understood: "3 × 8–10 reps · each side · 20 lb". */
export function describeParsedExercise(ex: ParsedExercise, inSuperset = false): string {
  const amount =
    ex.reps != null
      ? `${ex.reps}${ex.repsMax ? `–${ex.repsMax}` : ""} reps`
      : ex.durationSeconds != null
      ? formatSeconds(ex.durationSeconds, ex.durationMaxSeconds)
      : null;
  const sets = !inSuperset && ex.sets ? `${ex.sets} × ` : "";
  return [
    amount ? `${sets}${amount}` : !inSuperset && ex.sets ? `${ex.sets} sets` : null,
    ex.bothSides ? "each side" : null,
    ex.weight,
    ex.notes,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatSeconds(sec: number, max: number | null): string {
  if (sec % 60 === 0 && (max == null || max % 60 === 0)) return `${sec / 60}${max ? `–${max / 60}` : ""} min`;
  return `${sec}${max ? `–${max}` : ""} sec`;
}

export interface ExerciseResolution {
  exercise_id: string;
  label: string;
  video_url: string;
}

/**
 * Builds WorkoutForm step rows. `resolutions[i]` is what flattenExercises(blocks)[i]
 * was matched to (library exercise, or a one-off label). Group ids start at
 * `startGroupId`; named groups' ids are returned so the form can mark them as
 * per-exercise-sets groups.
 */
export function toFormSteps(
  blocks: ParsedBlock[],
  resolutions: ExerciseResolution[],
  { startGroupId, unit }: { startGroupId: number; unit: DistanceUnit }
): { steps: WorkoutStepFormRow[]; namedGroupIds: number[] } {
  const steps: WorkoutStepFormRow[] = [];
  const namedGroupIds: number[] = [];
  let index = 0;
  let groupId = startGroupId;

  const row = (
    ex: ParsedExercise,
    group: { id: number | null; rounds: number; name: string; ownSets: boolean }
  ): WorkoutStepFormRow => {
    const res = resolutions[index++];
    const rangeNotes = [
      ex.repsMax != null && ex.reps != null ? `${ex.reps}–${ex.repsMax} reps` : null,
      ex.durationMaxSeconds != null && ex.durationSeconds != null ? formatSeconds(ex.durationSeconds, ex.durationMaxSeconds) : null,
    ];
    const sec = ex.durationSeconds;
    const useMin = sec != null && sec >= 60 && sec % 60 === 0;
    return {
      step_type: "main",
      label: ex.isRest ? "Rest" : res?.label ?? ex.name,
      pace_type: "",
      duration_minutes: sec == null ? "" : useMin ? String(sec / 60) : String(sec),
      duration_unit: useMin || sec == null ? "min" : "sec",
      distance_miles: "",
      distance_unit: unit,
      notes: [...rangeNotes, ex.notes].filter(Boolean).join(" · "),
      repeat_group_id: group.id,
      repeat_count: group.rounds,
      exercise_id: ex.isRest ? "" : res?.exercise_id ?? "",
      group_name: group.name,
      sets: group.ownSets ? String(ex.sets ?? 1) : "",
      reps: ex.reps != null ? String(ex.reps) : "",
      weight_suggestion: ex.weight ?? "",
      video_url: ex.isRest ? "" : res?.video_url ?? "",
      both_sides: ex.bothSides,
      stroke_style: "",
    };
  };

  for (const block of blocks) {
    if (block.kind === "single") {
      steps.push(row(block.exercise, { id: null, rounds: 1, name: "", ownSets: true }));
    } else if (block.kind === "superset") {
      const id = groupId++;
      for (const ex of block.exercises) steps.push(row(ex, { id, rounds: block.rounds, name: block.name ?? "", ownSets: false }));
    } else {
      const id = groupId++;
      namedGroupIds.push(id);
      for (const ex of block.exercises) steps.push(row(ex, { id, rounds: 1, name: block.name, ownSets: true }));
    }
  }
  return { steps, namedGroupIds };
}
