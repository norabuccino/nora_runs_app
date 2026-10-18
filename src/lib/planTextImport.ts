// Parses a training plan written as plain text into week/day slots for the
// plan editor's "Paste plan" import, e.g.
//
//   Week 1
//   Mon: Easy run 4 miles
//   Tue: Track 200s + Upper body pull
//   Thu: Tempo 5 miles or Bike 45 min
//   Sat: Long run 10 miles
//
//   Weeks 2-4:
//   Mon/Wed/Fri: Easy 5 miles
//
// - Week headers: "Week 3", "Weeks 2-4", "Weeks 1, 3, 5", "Every week" / "All weeks"
//   (a header may also carry day items after a colon). Without any header the
//   modal's chosen week is used.
// - Days: Mon…Sun (Monday = Day 1 — plans count days from their start date, which
//   is a Monday), or "Day 3" / "D3". Several days: "Mon/Wed/Fri", "Tue & Thu".
// - Workouts in one slot: "a + b" → both that day (AND), "a or b" → alternatives (OR).
// - Each workout is a library workout name, or text for a new workout
//   (`workoutFromText` infers its type, run/strength type, distance and time).

import { inferRunType, inferStrengthType } from "@/lib/workoutTextDetails";
import type { RunType, WorkoutType } from "@/types/database";

export interface PlanTextEntry {
  weeks: number[];
  /** 0-based day index (Day 1 = 0). */
  day: number;
  /** The workouts for this slot, as typed. */
  workouts: string[];
  logic: "and" | "or";
  raw: string;
}

export interface ParsedPlanText {
  entries: PlanTextEntry[];
  unparsed: string[];
  /** Week numbers mentioned that are outside the plan. */
  outOfRangeWeeks: number[];
}

const DAY_WORDS: [RegExp, number][] = [
  [/^mon(day)?$/, 0],
  [/^tue(s|sday)?$/, 1],
  [/^wed(s|nesday)?$/, 2],
  [/^thu(r|rs|rsday)?$/, 3],
  [/^fri(day)?$/, 4],
  [/^sat(urday)?$/, 5],
  [/^sun(day)?$/, 6],
];

const DAY_TOKEN = String.raw`(?:mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|day\s*[1-7]|d[1-7])`;
const DAY_LIST = new RegExp(String.raw`^\s*(${DAY_TOKEN}(?:\s*(?:\/|,|&|\band\b)\s*${DAY_TOKEN})*)\s*(?:[:\-–—.)]\s*|\s+)(.+)$`, "i");

function dayIndex(token: string): number | null {
  const t = token.trim().toLowerCase();
  const num = t.match(/^(?:day\s*|d)([1-7])$/);
  if (num) return parseInt(num[1], 10) - 1;
  return DAY_WORDS.find(([re]) => re.test(t))?.[1] ?? null;
}

function parseWeekHeader(line: string, totalWeeks: number): { weeks: number[]; rest: string } | null {
  const every = line.match(/^\s*(?:every|all|each)\s+weeks?\s*[:\-–]?\s*(.*)$/i);
  if (every) return { weeks: Array.from({ length: totalWeeks }, (_, i) => i + 1), rest: every[1] };
  const m = line.match(/^\s*(?:weeks?|wk)\s*([\d\s,\-–to&and]+?)\s*(?::\s*(.*))?$/i);
  if (!m || !/\d/.test(m[1])) return null;
  const weeks: number[] = [];
  for (const part of m[1].split(/,|&|\band\b/)) {
    const range = part.match(/(\d+)\s*(?:-|–|to|through)\s*(\d+)/);
    if (range) {
      for (let w = parseInt(range[1], 10); w <= parseInt(range[2], 10); w++) weeks.push(w);
    } else if (/\d/.test(part)) {
      weeks.push(parseInt(part.trim(), 10));
    }
  }
  return { weeks: [...new Set(weeks)], rest: m[2] ?? "" };
}

export function parsePlanText(
  text: string,
  {
    totalWeeks,
    defaultWeek,
    isKnownWorkout = () => false,
  }: {
    totalWeeks: number;
    defaultWeek: number;
    /** True for text that is itself one workout's name (library titles like "2x 1K + 4x 200") — never split it. */
    isKnownWorkout?: (text: string) => boolean;
  }
): ParsedPlanText {
  const entries: PlanTextEntry[] = [];
  const unparsed: string[] = [];
  const outOfRange = new Set<number>();
  let weeks = [defaultWeek];

  const addItem = (item: string) => {
    const raw = item.trim().replace(/^\s*(?:[-•*·]|\d+[.)])\s+/, "");
    if (!raw) return;
    const m = raw.match(DAY_LIST);
    if (!m) {
      unparsed.push(raw);
      return;
    }
    const days = [...new Set(m[1].split(/\/|,|&|\band\b/).map(dayIndex).filter((d): d is number => d != null))];
    const body = m[2].trim();
    const or = isKnownWorkout(body) ? [body] : body.split(/\s+or\s+/i).map((s) => s.trim()).filter(Boolean);
    const workouts =
      or.length > 1
        ? or
        : isKnownWorkout(body)
        ? [body]
        : body.split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean);
    const logic: "and" | "or" = or.length > 1 ? "or" : "and";
    const valid = weeks.filter((w) => {
      const ok = w >= 1 && w <= totalWeeks;
      if (!ok) outOfRange.add(w);
      return ok;
    });
    if (!valid.length || !workouts.length) return;
    for (const day of days) entries.push({ weeks: valid, day, workouts, logic, raw });
  };

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const header = parseWeekHeader(line, totalWeeks);
    if (header) {
      weeks = header.weeks;
      if (header.rest.trim()) header.rest.split(";").forEach(addItem);
      continue;
    }
    line.split(";").forEach(addItem);
  }
  return { entries, unparsed, outOfRangeWeeks: [...outOfRange].sort((a, b) => a - b) };
}

export interface NewWorkoutFromText {
  type: WorkoutType;
  run_type: RunType | null;
  strength_type: string | null;
  title: string;
  distance_miles: number | null;
  distance_unit: "mi" | "km";
  duration_minutes: number | null;
}

const TYPE_RULES: [RegExp, WorkoutType][] = [
  [/^(rest|off|rest day|day off)\b/, "rest"],
  [/\b(swim|pool|laps)\b/, "swim"],
  [/\b(bike|biking|ride|cycl\w*|spin|zwift|peloton)\b/, "bike"],
  [/\b(yoga|elliptical|walk|hike|pilates|cross[- ]?train\w*|xt|stretch\w*)\b/, "cross_train"],
  [/\b(strength|lift\w*|gym|upper|lower|full body|core|abs|legs|push|pull|squats?|deadlifts?|circuit|plyo\w*|weights?)\b/, "strength"],
  [/\b(run|runs|jog|tempo|threshold|track|intervals?|repeats|fartlek|long|easy|recovery|race|strides|hills?|miles?|mi|km|mp|hmp|shakeout)\b/, "run"],
];

/** A best guess at a new plan workout from a short description ("Long run 10 miles"). */
export function workoutFromText(text: string): NewWorkoutFromText {
  const t = text.toLowerCase();
  const type = TYPE_RULES.find(([re]) => re.test(t))?.[1] ?? "run";
  const dist = t.match(/\b(\d+(?:\.\d+)?)\s*(miles?|mi|km|k)\b(?!\s*pace)/);
  const mins = t.match(/\b(\d+(?:\.\d+)?)\s*(min|mins|minutes?)\b|\b(\d+(?:\.\d+)?)\s*(hr|hrs|hours?)\b/);
  const title = text.trim().replace(/^./, (c) => c.toUpperCase());
  return {
    type,
    run_type: type === "run" ? inferRunType(t) ?? null : null,
    strength_type: type === "strength" ? inferStrengthType(t) ?? null : null,
    title: type === "rest" && /^(off|day off)$/i.test(text.trim()) ? "Rest" : title,
    distance_miles: dist && (type === "run" || type === "bike" || type === "swim") ? parseFloat(dist[1]) : null,
    distance_unit: dist && /^k/.test(dist[2]) ? "km" : "mi",
    duration_minutes: mins ? (mins[1] ? parseFloat(mins[1]) : parseFloat(mins[3]) * 60) : null,
  };
}

/** "Mon" style label for a 0-based plan day, alongside the plan's own "Day N". */
export const PLAN_DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
