// Parses a run or swim workout written as plain text into form steps for the
// workout forms' "Paste steps" import, e.g.
//   "Warm up 2 miles, then run 2 sets of 8x200m at 3K pace with 200m recovery
//    after each 200. Jog 800m easy between the two sets. Finish with 2 mile cooldown."
//
// The text is split into clauses (sentences, commas, "then"). Each clause is one
// step, a repeat, or something that attaches to the repeat before it:
//   - Role: "warm up"/"WU" → Warm-up, "cool down"/"CD" → Cool-down, "rest"/
//     "recovery"/"float"/"walk" → Recovery; work inside a repeat → Interval.
//   - Amount: 2 miles, 800m, 1.5 km, 400 yd, "a mile", 20 min, 90 sec, 1:30.
//   - Repeats: "8x200m", "6 x 1 mile", "4 x 5 min"; "2 sets of …" repeats the
//     whole block, and "… between (the) sets" adds a step between the copies
//     (steps can't nest, so sets become consecutive repeat groups).
//   - "with 200m recovery (after each)" / a following "200m jog" clause → the
//     repeat's recovery step.
//   - Pace: "at 3K pace", "@ threshold", "easy", "MP", "@ 6:45" — matched to the
//     user's named paces (custom M:SS kept as-is). Unknown paces go to notes.
//   - Swim: strokes (free, back, breast, fly), "on 1:45" send-off, "15s rest".
// Leftover meaningful words (strides, hills…) become the step's notes.

import type { WorkoutStepFormRow } from "@/components/WorkoutForm";
import type { DistanceUnit } from "@/lib/unitUtils";

export type RunStepType = "warmup" | "main" | "interval" | "recovery" | "cooldown";

export interface ParsedRunStep {
  stepType: RunStepType;
  distance: number | null;
  unit: DistanceUnit | null;
  durationSeconds: number | null;
  /** A user pace name, or a custom "M:SS". */
  pace: string | null;
  stroke: string | null;
  notes: string | null;
}

export type RunBlock = { kind: "step"; step: ParsedRunStep } | { kind: "repeat"; count: number; steps: ParsedRunStep[] };

export interface ParsedRunWorkout {
  blocks: RunBlock[];
  /** Clauses that described no distance, time or repeat. */
  unparsed: string[];
  /** Pace words that aren't one of the user's paces (kept in the step notes). */
  unknownPaces: string[];
}

export interface RunParseOptions {
  sport: "run" | "swim";
  /** The user's running pace names ("Easy", "3K", …). */
  paceNames: string[];
}

const WORD_NUMBERS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", fifteen: "15", twenty: "20",
};

const PACE_ALIASES: Record<string, string[]> = {
  marathon: ["mp", "marathon pace"],
  "half marathon": ["hmp", "hm", "half marathon pace", "half pace"],
  threshold: ["lt", "t pace", "tempo"],
  easy: ["e pace", "easy pace"],
  recovery: ["rec pace"],
};

const STROKES: [RegExp, string][] = [
  [/\b(free|freestyle)\b/, "freestyle"],
  [/\b(back|backstroke)\b/, "backstroke"],
  [/\b(breast|breaststroke)\b/, "breaststroke"],
  [/\b(fly|butterfly)\b/, "butterfly"],
];

const FILLER = new Set(
  "then run running do finish finishing start starting begin with and of the a an at pace after each followed by for x sets set reps rep rounds round times between is are on your total plus last first into to complete easy hard".split(
    " "
  )
);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\b(warm|cool)[\s-]+(ups?|downs?)\b/g, "$1$2")
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\b/g, (w) => WORD_NUMBERS[w])
    .replace(/\bhalf (a )?(mile|mi)\b/g, "0.5 mile")
    .replace(/\b(a|an) (mile|km|kilometer|kilometre)\b/g, "1 $2");
}

/** Sentences, then commas / "then" / "followed by" — but never inside a decimal like 1.5. */
function splitClauses(text: string): string[] {
  return text
    .split(/(?<!\d)\.(?!\d)|\.(?=\s|$)|[;\n!?]+/)
    .flatMap((s) => s.split(/,|\bthen\b|\bfollowed by\b|\band then\b/))
    .map((c) => c.trim())
    .filter(Boolean);
}

function unitFor(word: string, sport: "run" | "swim"): DistanceUnit {
  if (/^(mi|miles?)$/.test(word)) return "mi";
  if (/^(km|k|kilomet(er|re)s?)$/.test(word)) return "km";
  if (/^(yd|yds|yards?|y)$/.test(word)) return "yd";
  return sport === "swim" ? "yd" : "m";
}

const UNIT = String.raw`(miles?|mi|km|k|kilomet(?:er|re)s?|meters?|metres?|m|yards?|yds?|y)`;

class ClauseReader {
  rest: string;
  constructor(text: string) {
    this.rest = ` ${text} `;
  }
  take(re: RegExp): RegExpMatchArray | null {
    const m = this.rest.match(re);
    if (!m || m.index == null) return null;
    this.rest = `${this.rest.slice(0, m.index)} ${this.rest.slice(m.index + m[0].length)}`;
    return m;
  }
  has(re: RegExp): boolean {
    return re.test(this.rest);
  }
  leftover(): string | null {
    const words = this.rest
      .replace(/[^a-z0-9: ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w && !FILLER.has(w) && !/^\d+$/.test(w));
    return words.length ? words.join(" ") : null;
  }
}

interface ClauseInfo {
  step: ParsedRunStep | null;
  reps: number | null;
  sets: number | null;
  betweenSets: boolean;
  role: "warmup" | "cooldown" | "recovery" | null;
  /** The "with 200m recovery" part of a repeat clause. */
  withRecovery: ParsedRunStep | null;
}

export function parseRunText(text: string, { sport, paceNames }: RunParseOptions): ParsedRunWorkout {
  const unknownPaces = new Set<string>();
  const paceLookup = buildPaceLookup(paceNames);
  const findPace = (name: string) => paceNames.find((p) => p.toLowerCase() === name.toLowerCase()) ?? null;

  function readPace(r: ClauseReader): string | null {
    const custom = r.take(/(?:\bat\b|@)\s*(\d{1,2}:\d{2})\s*(?:\/\s*(?:mi|mile)|per mile|min\/mi)?(?:\s*pace)?/);
    if (custom) return custom[1];
    for (const [phrase, pace, distanceLike] of paceLookup) {
      const p = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Distance-looking names ("Mile", "5K") only count with "at"/"@" or "pace", so "2 mile cooldown" stays a distance.
      const re = distanceLike
        ? new RegExp(`(?:(?:\\bat|@)\\s*${p}\\b(?:\\s*pace)?|\\b${p}\\s*pace\\b)`)
        : new RegExp(`(?:\\bat\\s+|@\\s*)?\\b${p}\\b(?:\\s*pace)?`);
      if (r.take(re)) return pace;
    }
    const unknown = r.take(/(?:\bat\b|@)\s*([a-z0-9][a-z0-9 ]{0,14}?)\s*(?:pace|effort)\b|\b([a-z0-9]+)\s+pace\b/);
    if (unknown) {
      const label = (unknown[1] ?? unknown[2]).trim();
      unknownPaces.add(label);
      return `?${label}`;
    }
    return null;
  }

  function readStep(clause: string, inRepeat: boolean, afterRepeat = false): ClauseInfo {
    // "8x200m at 3K pace with 200m recovery…" — split off the repeat's recovery before reading
    // anything, so its words ("recovery", its pace) don't leak into the work step.
    let withText: string | null = null;
    const w = clause.match(/^(.*?)\bwith\b(.*)$/);
    if (w && /\d+\s*[x×]\s*\d|\d+\s*(?:repeats?|reps?|intervals?)\b/.test(w[1])) {
      clause = w[1];
      withText = w[2];
    }
    const r = new ClauseReader(clause);
    const info: ClauseInfo = { step: null, reps: null, sets: null, betweenSets: false, role: null, withRecovery: null };

    if (r.take(/\bbetween\b[a-z0-9 ]*?\b(sets?|rounds?|blocks?|series)\b/)) info.betweenSets = true;
    r.take(/\b(after|between) (each|every|reps?|intervals?)( \d+(\.\d+)?\s*[a-z]*)?/);

    if (r.take(/\b(warmup|warmups|wu)\b/)) info.role = "warmup";
    else if (r.take(/\b(cooldown|cooldowns|cd)\b/)) info.role = "cooldown";
    else if (r.take(/\b(recovery|recover|rest|float|walk|walking)\b/)) info.role = "recovery";
    else if (r.has(/\bjog\b/) && (inRepeat || afterRepeat || info.betweenSets)) info.role = "recovery";
    r.take(/\bjog(ging)?\b/);

    const sets = r.take(/\b(\d+)\s*(?:sets?|rounds?|times|series|blocks?)(?:\s*of)?\b|\b(\d+)\s*[x×]\s*(?=\()/);
    if (sets) info.sets = parseInt(sets[1] ?? sets[2], 10);

    const pace = sport === "run" ? readPace(r) : null; // swims have no running paces

    let stroke: string | null = null;
    if (sport === "swim") {
      for (const [re, key] of STROKES) if (r.take(re)) { stroke = key; break; }
    }

    let distance: number | null = null;
    let unit: DistanceUnit | null = null;
    let durationSeconds: number | null = null;

    const repTime = r.take(/\b(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(min|mins|minutes?|sec|secs|seconds?|s)\b/);
    const repDist = !repTime && r.take(new RegExp(String.raw`\b(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*${UNIT}?(?![a-z:])`));
    const repWord = !repDist && !repTime && r.take(new RegExp(String.raw`\b(\d+)\s*(?:repeats?|reps?|intervals?)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*${UNIT}\b`));
    if (repDist) {
      info.reps = parseInt(repDist[1], 10);
      distance = parseFloat(repDist[2]);
      unit = repDist[3] ? unitFor(repDist[3], sport) : sport === "swim" || distance >= 100 ? unitFor("", sport) : "mi";
    } else if (repTime) {
      info.reps = parseInt(repTime[1], 10);
      durationSeconds = Math.round(parseFloat(repTime[2]) * (repTime[3].startsWith("m") ? 60 : 1));
    } else if (repWord) {
      info.reps = parseInt(repWord[1], 10);
      distance = parseFloat(repWord[2]);
      unit = unitFor(repWord[3], sport);
    }

    if (distance == null && durationSeconds == null) {
      const d = r.take(new RegExp(String.raw`\b(\d+(?:\.\d+)?)\s*${UNIT}\b`));
      if (d) {
        distance = parseFloat(d[1]);
        unit = unitFor(d[2], sport);
      }
    }
    // Swim distances are usually written bare ("200 free", "4x100").
    if (sport === "swim" && distance == null && durationSeconds == null) {
      const bare = r.take(/\b(\d{2,4})\b(?!\s*:)/);
      if (bare) {
        distance = parseInt(bare[1], 10);
        unit = "yd";
      }
    }
    const sendOff = sport === "swim" ? r.take(/\bon (?:the )?(\d+):(\d{2})\b/) : null;
    const clock = r.take(/\b(\d+):(\d{2})\b/);
    // A bare "s" only means seconds on short numbers ("30s"); "200s"/"400s" are reps, not times.
    const t = r.take(/\b(\d+(?:\.\d+)?)\s*(min|mins|minutes?|sec|secs|seconds?|hours?|hrs?)\b|\b(\d{1,2})\s*(s)\b/);
    if (sendOff) durationSeconds ??= parseInt(sendOff[1], 10) * 60 + parseInt(sendOff[2], 10);
    if (durationSeconds == null && clock) durationSeconds = parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10);
    if (durationSeconds == null && t) {
      const n = parseFloat(t[1] ?? t[3]);
      const unitWord = t[2] ?? t[4];
      durationSeconds = Math.round(unitWord.startsWith("h") ? n * 3600 : unitWord.startsWith("m") ? n * 60 : n);
    }

    if (withText) {
      const rec = readStep(withText, true);
      if (rec.step) {
        if (rec.betweenSets) info.betweenSets = true;
        info.withRecovery = { ...rec.step, stepType: "recovery" };
      }
    }

    if (distance == null && durationSeconds == null && info.reps == null) {
      return info; // nothing measurable — filler like "then run"
    }

    const unknown = pace?.startsWith("?") ? pace.slice(1) : null;
    const notes = [unknown ? `${unknown} pace` : null, r.leftover()].filter(Boolean).join(" · ") || null;
    info.step = {
      stepType: info.role ?? (info.reps != null || inRepeat ? "interval" : "main"),
      distance,
      unit,
      durationSeconds,
      pace: unknown ? null : pace,
      stroke,
      notes,
    };
    return info;
  }

  const blocks: RunBlock[] = [];
  const unparsed: string[] = [];
  let open: { count: number; sets: number; steps: ParsedRunStep[]; between: ParsedRunStep | null } | null = null;

  const flush = () => {
    if (!open) return;
    for (let i = 0; i < open.sets; i++) {
      if (i > 0 && open.between) blocks.push({ kind: "step", step: open.between });
      blocks.push({ kind: "repeat", count: open.count, steps: open.steps.map((s) => ({ ...s })) });
    }
    open = null;
  };

  for (const clause of splitClauses(normalizeText(text))) {
    const info = readStep(clause, false, open != null);
    if (!info.step) {
      // "Repeat 3 times" / "do this twice" after a repeat multiplies its sets.
      if (open && info.sets != null) open.sets = info.sets;
      else if (new ClauseReader(clause).leftover()) unparsed.push(clause);
      continue;
    }
    const step = info.step;

    if (info.reps != null) {
      flush();
      open = { count: info.reps, sets: info.sets ?? 1, steps: [step], between: null };
      if (info.withRecovery) {
        if (info.betweenSets) open.between = info.withRecovery;
        else open.steps.push(info.withRecovery);
      }
    } else if (open && info.betweenSets) {
      open.between = { ...step, stepType: step.stepType === "main" ? "recovery" : step.stepType };
    } else if (open && step.stepType === "recovery" && !open.steps.some((s) => s.stepType === "recovery")) {
      open.steps.push(step);
    } else {
      flush();
      blocks.push({ kind: "step", step });
    }
  }
  flush();
  applyDefaultPaces(blocks, paceNames, findPace, sport);
  return { blocks, unparsed, unknownPaces: [...unknownPaces] };
}

/** [phrase, pace name, distance-like?] longest phrase first. */
function buildPaceLookup(paceNames: string[]): [string, string, boolean][] {
  const out: [string, string, boolean][] = [];
  for (const name of paceNames) {
    const lower = name.toLowerCase();
    const distanceLike = /\d|\bmiles?\b|\bmarathon\b|\bk\b/.test(lower);
    out.push([lower, name, distanceLike]);
    for (const alias of PACE_ALIASES[lower] ?? []) out.push([alias, name, false]);
  }
  // "Tempo" only aliases Threshold when there's no pace actually called Tempo.
  return out
    .filter(([phrase, name]) => !(phrase === "tempo" && name.toLowerCase() !== "tempo" && paceNames.some((p) => p.toLowerCase() === "tempo")))
    .sort((a, b) => b[0].length - a[0].length);
}

/** Warm-ups/cool-downs default to Easy and recoveries to Recovery, when the user has those paces. */
function applyDefaultPaces(
  blocks: RunBlock[],
  paceNames: string[],
  findPace: (name: string) => string | null,
  sport: "run" | "swim"
) {
  if (sport !== "run" || paceNames.length === 0) return;
  const easy = findPace("easy");
  const recovery = findPace("recovery") ?? easy;
  const fill = (s: ParsedRunStep) => {
    if (s.pace) return;
    if (s.stepType === "warmup" || s.stepType === "cooldown") s.pace = easy;
    else if (s.stepType === "recovery") s.pace = recovery;
  };
  for (const b of blocks) (b.kind === "step" ? [b.step] : b.steps).forEach(fill);
}

const STEP_LABELS: Record<RunStepType, string> = {
  warmup: "Warm-up",
  main: "Run",
  interval: "Interval",
  recovery: "Recovery",
  cooldown: "Cool-down",
};

function formatDuration(sec: number): string {
  if (sec % 60 === 0) return `${sec / 60} min`;
  if (sec > 60) return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  return `${sec} sec`;
}

/** "Interval · 200 m · 3K" */
export function describeRunStep(step: ParsedRunStep, sport: "run" | "swim" = "run"): string {
  const label = sport === "swim" && step.stepType === "recovery" ? "Rest" : STEP_LABELS[step.stepType];
  return [
    label,
    step.distance != null ? `${step.distance} ${step.unit ?? ""}`.trim() : null,
    step.durationSeconds != null ? (sport === "swim" && step.stepType !== "recovery" ? `on ${formatDuration(step.durationSeconds)}` : formatDuration(step.durationSeconds)) : null,
    step.pace ? `@ ${step.pace}` : null,
    step.stroke,
    step.notes,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** WorkoutForm step rows; repeat groups get sequential ids from `startGroupId`. */
export function toRunFormSteps(
  blocks: RunBlock[],
  { startGroupId, defaultUnit }: { startGroupId: number; defaultUnit: DistanceUnit }
): WorkoutStepFormRow[] {
  let groupId = startGroupId;
  const row = (s: ParsedRunStep, group: number | null, count: number): WorkoutStepFormRow => {
    const sec = s.durationSeconds;
    const useMin = sec != null && sec >= 60 && sec % 60 === 0;
    return {
      step_type: s.stepType,
      label: "",
      pace_type: s.pace ?? "",
      duration_minutes: sec == null ? "" : useMin ? String(sec / 60) : String(sec),
      duration_unit: useMin || sec == null ? "min" : "sec",
      distance_miles: s.distance != null ? String(s.distance) : "",
      distance_unit: s.unit ?? defaultUnit,
      notes: s.notes ?? "",
      repeat_group_id: group,
      repeat_count: count,
      exercise_id: "",
      group_name: "",
      sets: "",
      reps: "",
      weight_suggestion: "",
      video_url: "",
      both_sides: false,
      stroke_style: s.stroke ?? "",
    };
  };
  return blocks.flatMap((b) => {
    if (b.kind === "step") return [row(b.step, null, 1)];
    const id = groupId++;
    return b.steps.map((s) => row(s, id, b.count));
  });
}
