// Suggests equipment and muscle groups from an exercise's name ("DB Glute
// Bridge" → Dumbbells, Hips & Glutes). Suggestions are only offered in the
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

export function suggestExerciseTags(name: string): { equipment: string[]; muscle_groups: string[] } {
  const text = normalize(name);
  if (!text.trim()) return { equipment: [], muscle_groups: [] };
  return {
    equipment: sortEquipment(apply(EQUIPMENT_RULES, text, (r) => r.equipment)),
    muscle_groups: sortMuscleGroups(apply(MUSCLE_RULES, text, (r) => r.muscles)),
  };
}
