// Suggests equipment and muscle groups from an exercise's name ("DB Glute
// Bridge" → Dumbbells, Hips & Glutes), and equipment from its description
// ("hold a kettlebell at your chest"). Suggestions are only offered in the
// exercise form — never applied automatically.

import { sortEquipment } from "@/lib/equipment";
import { sortMuscleGroups } from "@/lib/muscleGroups";

interface Rule {
  match: RegExp;
  /** Skip the rule when this also matches (e.g. "leg curl" isn't an arm curl). */
  unless?: RegExp;
  equipment?: string[];
  muscles?: string[];
}

const EQUIPMENT_RULES: Rule[] = [
  { match: /\b(dumbbells?|dbs?)\b/, equipment: ["dumbbells"] },
  { match: /\b(kettlebells?|kbs?)\b/, equipment: ["kettlebell"] },
  { match: /\b(barbell|bb|back squat|front squat|bench press)\b/, unless: /\b(dumbbells?|dbs?)\b/, equipment: ["barbell"] },
  { match: /\bplates?\b/, equipment: ["weight_plate"] },
  { match: /\b(medicine ball|med ball|slam ball)\b/, equipment: ["medicine_ball"] },
  { match: /\b(bands?|banded|pall?off|paloff)\b/, unless: /\bmini ?band/, equipment: ["resistance_band"] },
  { match: /\b(mini ?bands?|monster walks?|clamshells?|band walks?)\b/, equipment: ["mini_band"] },
  { match: /\bcables?\b/, equipment: ["cable_machine"] },
  { match: /\btrx\b/, equipment: ["trx"] },
  { match: /\b(box|boxes|step ?ups?|steps?)\b/, equipment: ["box_step"] },
  { match: /\bbench\b/, unless: /\bbench press\b/, equipment: ["bench"] },
  { match: /\bbosu\b/, equipment: ["bosu"] },
  { match: /\bfoam roll(er)?s?\b/, equipment: ["foam_roller"] },
  { match: /\bsliders?\b/, equipment: ["sliders"] },
  { match: /\b(yoga )?blocks?\b/, equipment: ["yoga_block"] },
  { match: /\bwall\b/, unless: /\bwall ball\b/, equipment: ["wall"] },
  { match: /\b(pull ?ups?|chin ?ups?|pull ?up bar|hanging|dead hang)\b/, equipment: ["pull_up_bar"] },
  { match: /\b(squat )?rack\b/, equipment: ["squat_rack"] },
  { match: /\btib(ialis)? bar\b/, equipment: ["tib_bar"] },
  { match: /\bleg press\b/, equipment: ["leg_press"] },
  { match: /\bsled\b/, equipment: ["sled"] },
  { match: /\bcones?\b/, equipment: ["cone"] },
  { match: /\b(tennis|lacrosse) balls?\b/, equipment: ["small_ball"] },
  { match: /\btowels?\b/, equipment: ["towel"] },
];

// Descriptions are prose, so only unambiguous equipment nouns count — "step forward"
// or "pull your knee up" must not suggest a box or a pull-up bar.
const DESCRIPTION_EQUIPMENT_RULES: Rule[] = [
  { match: /\b(dumbbells?|dbs?)\b/, equipment: ["dumbbells"] },
  { match: /\b(kettlebells?|kbs?)\b/, equipment: ["kettlebell"] },
  { match: /\bbarbells?\b/, equipment: ["barbell"] },
  { match: /\b(weight )?plates?\b/, equipment: ["weight_plate"] },
  { match: /\b(medicine ball|med ball|slam ball)\b/, equipment: ["medicine_ball"] },
  { match: /\b(resistance |long |loop |power )?bands?\b/, unless: /\bmini ?bands?\b/, equipment: ["resistance_band"] },
  { match: /\bmini ?bands?\b/, equipment: ["mini_band"] },
  { match: /\bcables?( machine)?\b/, equipment: ["cable_machine"] },
  { match: /\btrx\b/, equipment: ["trx"] },
  { match: /\b(box|plyo box|stairs?|step platform|aerobic step|(on|onto|off) (a|the) step)\b/, equipment: ["box_step"] },
  { match: /\bbench\b/, equipment: ["bench"] },
  { match: /\bbosu\b/, equipment: ["bosu"] },
  { match: /\bfoam roll(er)?s?\b/, equipment: ["foam_roller"] },
  { match: /\bsliders?\b/, equipment: ["sliders"] },
  // A bare "block" in a description usually means something to stand on ("a step or block").
  { match: /\b(yoga blocks?|blocks? between)\b/, equipment: ["yoga_block"] },
  { match: /\bwall\b/, equipment: ["wall"] },
  { match: /\b(pull ?up bar|chin ?up bar|hang(ing)? from (a|the) bar)\b/, equipment: ["pull_up_bar"] },
  { match: /\b(squat|power) rack\b/, equipment: ["squat_rack"] },
  { match: /\btib(ialis)? bar\b/, equipment: ["tib_bar"] },
  { match: /\bleg press\b/, equipment: ["leg_press"] },
  { match: /\bsled\b/, equipment: ["sled"] },
  { match: /\bcones?\b/, equipment: ["cone"] },
  { match: /\b(tennis|lacrosse) balls?\b/, equipment: ["small_ball"] },
  { match: /\btowels?\b/, equipment: ["towel"] },
];

const MUSCLE_RULES: Rule[] = [
  {
    match: /\b(glutes?|bridges?|hip thrusts?|hips?|clamshells?|monster walks?|band walks?|fire hydrants?|abduct\w*|kickbacks?|90 ?90)\b/,
    unless: /\btricep kickbacks?\b/,
    muscles: ["hips_glutes"],
  },
  { match: /\b(rdls?|deadlifts?|good mornings?|swings?)\b/, muscles: ["hips_glutes", "thighs"] },
  {
    match: /\b(squats?|lunges?|step ?ups?|leg press|wall sits?|nordics?|hamstrings?|quads?|leg extensions?|leg curls?|adduct\w*|copenhagen|split squats?)\b/,
    muscles: ["thighs"],
  },
  { match: /\b(calf|calves|tib|tibialis|ankles?|soleus|heel raises?)\b/, muscles: ["lower_legs"] },
  { match: /\b(big toe|toe (raises?|yoga|spread\w*|splay\w*|curls?)|foot|feet|arch|midfoot)\b/, unless: /\brear foot\b/, muscles: ["feet"] },
  { match: /\b(push ?ups?|chest|bench press|chest press|flys?|flyes)\b/, unless: /\bknee to chest\b/, muscles: ["chest"] },
  {
    match: /\b(overhead press|shoulders?|lateral raises?|front raises?|face pulls?|atyt|y raises?|snow ang\w*|arnold|landmine press|push press|military press|upright rows?)\b/,
    muscles: ["shoulders"],
  },
  { match: /\b(rows?|pull ?ups?|chin ?ups?|pull ?downs?|lats?|supermans?|back extensions?|pullovers?)\b/, unless: /\bupright rows?\b/, muscles: ["back_spine"] },
  { match: /\b(curls?|biceps?|triceps?|skull ?crushers?)\b/, unless: /\b(leg|hamstring|tib|tib bar|nordic|toe) curls?\b/, muscles: ["arms"] },
  {
    match: /\b(planks?|dead ?bugs?|crunch\w*|sit ?ups?|core|abs?|pall?off|twists?|chops?|hollow|v ?ups?|leg raises?|carry|carries|bear crawls?|bird ?dogs?|anti ?rotation)\b/,
    muscles: ["abdomen"],
  },
];

function normalize(name: string): string {
  return ` ${name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function apply(rules: Rule[], text: string, pick: (r: Rule) => string[] | undefined): string[] {
  return rules.flatMap((r) => (r.match.test(text) && !r.unless?.test(text) ? pick(r) ?? [] : []));
}

// Clauses describing optional variations, not what the exercise needs.
const OPTIONAL_CLAUSE =
  /\b(modif\w*|progress\w*|regress\w*|optional\w*|nearby|for (balance|safety|support)|assist\w*|instead|easier|harder|to make it)\b/i;
// A band looped around the legs is a mini band, whatever the text calls it.
const BAND_ON_LEGS =
  /\bbands? (just )?(above|around|below|over|across) (the )?(tops? of )?(your |both |one )?(knees?|ankles?|thighs?|feet|foot|shins?|legs?)\b/;

/**
 * The description text worth matching: sentences and "label:" sections about
 * optional variations removed, and negated mentions ("no weights needed") dropped.
 */
function requiredDescription(description: string): string {
  const kept = description
    .split(/[.!?\n;]+|(?=\b[a-z][a-z ]{2,20}:)/i)
    .filter((clause) => !OPTIONAL_CLAUSE.test(clause))
    .join(" . ");
  return normalize(kept).replace(/\b(without|no|not|instead of)( (a|an|any|the))? [a-z]+( [a-z]+)?/g, " ");
}

export function suggestExerciseTags(
  name: string,
  description = ""
): { equipment: string[]; muscle_groups: string[] } {
  const text = normalize(name);
  const desc = requiredDescription(description);
  let fromDescription = desc.trim() ? apply(DESCRIPTION_EQUIPMENT_RULES, desc, (r) => r.equipment) : [];
  if (BAND_ON_LEGS.test(desc)) {
    fromDescription = [...fromDescription.filter((e) => e !== "resistance_band"), "mini_band"];
  }
  return {
    equipment: sortEquipment([...(text.trim() ? apply(EQUIPMENT_RULES, text, (r) => r.equipment) : []), ...fromDescription]),
    muscle_groups: text.trim() ? sortMuscleGroups(apply(MUSCLE_RULES, text, (r) => r.muscles)) : [],
  };
}
