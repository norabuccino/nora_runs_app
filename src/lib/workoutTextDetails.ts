// Pulls a pasted workout's title, description and other details out of the
// text ahead of the steps, for the workout forms' paste import. Details only
// ever fill fields the user left empty.
//
//   Labeled lines anywhere:  "Title: …", "Description: …", "Notes: …",
//                            "Source: …" (or "From:"/"Coach:"), "Type: …"/"Focus: …"
//   Unlabeled, before the steps: the first line is the title when it's on its
//     own (blank line after it) or directly followed by step lines; any other
//     paragraphs before the first step line are the description.
//   Run type / strength type are inferred from the title and description
//   ("Tempo Tuesday" → Threshold Run, "Upper body pull" → Upper Body).

import type { RunType } from "@/types/database";

export interface WorkoutTextDetails {
  title?: string;
  description?: string;
  notes?: string;
  source?: string;
  run_type?: RunType;
  strength_type?: string;
}

const LABELS: [RegExp, keyof WorkoutTextDetails | "type"][] = [
  [/^(title|name|workout)$/, "title"],
  [/^(description|desc|about|purpose|goal)$/, "description"],
  [/^(notes?|tips?|cues?)$/, "notes"],
  [/^(source|from|coach|by|credit)$/, "source"],
  [/^(type|run type|strength type|focus)$/, "type"],
];

const RUN_TYPES: [RegExp, RunType][] = [
  [/\blong run\b|\blong\b/, "long_run"],
  [/\b(mp|hmp|marathon pace|half marathon pace|mp\/hmp)\b/, "mp_hmp_run"],
  [/\b(tempo|threshold|lt)\b/, "threshold_run"],
  [/\b(intervals?|track|repeats?|speed|fartlek|vo2|hills?)\b|\b\d{3}s\b/, "interval_run"],
  [/\brecovery\b/, "recovery_run"],
  [/\bboost\b/, "boost_run"],
  [/\b(race|5k race|10k race)\b/, "race"],
  [/\beasy\b/, "easy_run"],
];

const STRENGTH_TYPES: [RegExp, string][] = [
  [/\b(full|total) body\b/, "full_body"],
  [/\bupper\b|\b(push|pull|chest|back|arms?|shoulders?)\b/, "upper_body"],
  [/\blower\b|\b(legs?|glutes?|squat|hinge)\b/, "lower_body"],
  [/\b(core|abs)\b/, "core"],
  [/\bplyo\w*\b/, "plyometrics"],
  [/\bmobility\b/, "mobility"],
];

export function inferRunType(text: string): RunType | undefined {
  const t = text.toLowerCase();
  return RUN_TYPES.find(([re]) => re.test(t))?.[1];
}

export function inferStrengthType(text: string): string | undefined {
  const t = text.toLowerCase();
  return STRENGTH_TYPES.find(([re]) => re.test(t))?.[1];
}

/**
 * Splits pasted text into workout details and the body that describes the steps.
 * `isStepLine` says whether a line belongs to the steps (sport-specific).
 */
export function splitWorkoutText(
  text: string,
  sport: "run" | "swim" | "strength",
  isStepLine: (line: string) => boolean
): { details: WorkoutTextDetails; body: string } {
  const details: WorkoutTextDetails = {};
  let typeText: string | null = null;

  const lines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([a-z][a-z ]{1,14}?)\s*:\s*(.+)$/i);
    const label = m ? LABELS.find(([re]) => re.test(m[1].trim().toLowerCase()))?.[1] : undefined;
    if (m && label) {
      const value = m[2].trim();
      if (label === "type") typeText = value;
      else if (label === "description" || label === "notes") details[label] = details[label] ? `${details[label]}\n${value}` : value;
      else if (label === "title" || label === "source") details[label] ??= value;
    } else {
      lines.push(line);
    }
  }

  // Lines before the first step line are the title and description. With no step line
  // at all, only the first line can be a title — the rest stays in the body, so the
  // preview reports it as skipped instead of silently treating it as a description.
  const firstStep = lines.findIndex((l) => l.trim() && isStepLine(l));
  const leading = firstStep < 0 ? lines.slice(0, Math.max(1, lines.findIndex((l) => l.trim()) + 1)) : lines.slice(0, firstStep);
  const body = (firstStep < 0 ? lines.slice(leading.length) : lines.slice(firstStep)).join("\n").trim();

  const paragraphs = leading.join("\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const looksLikeTitle = (line: string) => line.length <= 80 && !/[.!?]$/.test(line);
  if (paragraphs.length) {
    const [firstLine, ...more] = paragraphs[0].split("\n");
    const rest = [more.join("\n").trim(), ...paragraphs.slice(1)].filter(Boolean);
    if (!details.title && looksLikeTitle(firstLine.trim())) details.title = firstLine.trim();
    else rest.unshift(firstLine.trim());
    if (rest.length) {
      const desc = rest.join("\n\n");
      details.description = details.description ? `${desc}\n\n${details.description}` : desc;
    }
  }

  const about = [typeText, details.title, details.description].filter(Boolean).join(" ");
  if (sport === "run" && about) details.run_type = inferRunType(about);
  if (sport === "strength" && about) details.strength_type = inferStrengthType(about);
  for (const key of Object.keys(details) as (keyof WorkoutTextDetails)[]) if (!details[key]) delete details[key];
  return { details, body };
}
