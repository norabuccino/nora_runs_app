// Fuzzy-matches a typed exercise name ("pushups", "DB RDL") to the exercise
// library, for the workout text import.

const ABBREVIATIONS: Record<string, string> = {
  db: "dumbbell",
  dbs: "dumbbell",
  kb: "kettlebell",
  kbs: "kettlebell",
  bb: "barbell",
  sl: "single leg",
  sa: "single arm",
  bw: "bodyweight",
  ohp: "overhead press",
  rdls: "rdl",
};

function singular(word: string): string {
  if (word.length < 3 || word.endsWith("ss") || word.endsWith("us")) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (/(ch|sh|x)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/** Lowercase, punctuation-free, abbreviations expanded, plurals dropped: "Push-Ups" → "push up". */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ABBREVIATIONS[w] ?? w)
    .join(" ")
    .split(" ")
    .map(singular)
    .join(" ");
}

const compact = (normalized: string) => normalized.replace(/\s+/g, "");

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

function dice(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length || !B.length) return a === b ? 1 : 0;
  const counts = new Map<string, number>();
  for (const g of A) counts.set(g, (counts.get(g) ?? 0) + 1);
  let overlap = 0;
  for (const g of B) {
    const n = counts.get(g) ?? 0;
    if (n > 0) {
      overlap++;
      counts.set(g, n - 1);
    }
  }
  return (2 * overlap) / (A.length + B.length);
}

/** How well one word matches another: exact, or close enough to be a typo ("pallof" / "paloff"). */
function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const d = dice(a, b);
  return d >= 0.6 ? d : 0;
}

/** Average best match of each word in `from` against the words of `to`. */
function wordCoverage(from: string[], to: string[]): number {
  if (!from.length) return 0;
  return from.reduce((sum, w) => sum + Math.max(0, ...to.map((t) => wordSimilarity(w, t))), 0) / from.length;
}

/**
 * 0–1 similarity of a typed name to a library name, both normalized. Weighted
 * mostly on whether every typed word appears in the library name ("db rdl" →
 * "Single Leg Dumbbell RDL"), less on extra words, plus whole-string bigrams.
 */
export function nameSimilarity(typed: string, candidate: string): number {
  const a = typed.split(" ");
  const b = candidate.split(" ");
  return 0.5 * wordCoverage(a, b) + 0.2 * wordCoverage(b, a) + 0.3 * dice(compact(typed), compact(candidate));
}

export interface ExerciseMatch<T> {
  status: "matched" | "suggested" | "none";
  exercise: T | null;
  suggestions: T[];
}

const SUGGEST_THRESHOLD = 0.45;

export function matchExercise<T extends { name: string }>(name: string, exercises: T[]): ExerciseMatch<T> {
  const target = normalizeExerciseName(name);
  if (!target) return { status: "none", exercise: null, suggestions: [] };
  const scored = exercises.map((e) => {
    const n = normalizeExerciseName(e.name);
    return { e, exact: n === target || compact(n) === compact(target), score: nameSimilarity(target, n) };
  });
  const exact = scored.find((s) => s.exact);
  if (exact) return { status: "matched", exercise: exact.e, suggestions: [] };
  const suggestions = scored
    .filter((s) => s.score >= SUGGEST_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.e);
  return { status: suggestions.length ? "suggested" : "none", exercise: null, suggestions };
}
