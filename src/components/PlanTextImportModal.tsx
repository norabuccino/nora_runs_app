"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addPlanWorkoutsFromText, type PlanTextImportItem } from "@/app/actions/planTextImport";
import { parsePlanText, workoutFromText, PLAN_DAY_SHORT, type NewWorkoutFromText } from "@/lib/planTextImport";
import { matchExercise, normalizeExerciseName } from "@/lib/exerciseMatch";
import { DAY_NAMES, RUN_TYPE_LABELS, STRENGTH_TYPE_LABELS, WORKOUT_TYPE_LABELS } from "@/lib/paceUtils";
import type { WorkoutType } from "@/types/database";

type LibraryWorkout = { id: string; title: string; type: string };
type Choice = { kind: "library"; id: string; title: string } | { kind: "new"; type?: WorkoutType } | { kind: "skip" };

const PLACEHOLDER = `Week 1
Mon: Easy run 4 miles
Tue: Track 200s + Upper body pull
Thu: Tempo 5 miles or Bike 45 min
Sat: Long run 10 miles

Weeks 2-4:
Mon/Wed/Fri: Easy 5 miles`;

const TYPES: WorkoutType[] = ["run", "strength", "bike", "swim", "cross_train", "rest"];

function weeksLabel(weeks: number[]): string {
  if (weeks.length === 1) return `Week ${weeks[0]}`;
  const contiguous = weeks.every((w, i) => i === 0 || w === weeks[i - 1] + 1);
  return contiguous ? `Weeks ${weeks[0]}–${weeks[weeks.length - 1]}` : `Weeks ${weeks.join(", ")}`;
}

interface PlanTextImportModalProps {
  planId: string;
  totalWeeks: number;
  onDone: () => void;
  onCancel: () => void;
}

/** Paste a plan as "Week 1 / Mon: Easy 4 miles" text; match workouts to the library or create them, then add them all. */
export function PlanTextImportModal({ planId, totalWeeks, onDone, onCancel }: PlanTextImportModalProps) {
  const [text, setText] = useState("");
  const [defaultWeek, setDefaultWeek] = useState(1);
  const [library, setLibrary] = useState<LibraryWorkout[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("workouts").select("id, title, type").order("title");
      setLibrary(data ?? []);
    }
    load();
  }, []);

  const knownTitles = useMemo(() => new Set(library.map((w) => normalizeExerciseName(w.title))), [library]);
  const parsed = useMemo(
    () => parsePlanText(text, { totalWeeks, defaultWeek, isKnownWorkout: (t) => knownTitles.has(normalizeExerciseName(t)) }),
    [text, totalWeeks, defaultWeek, knownTitles]
  );
  const named = useMemo(() => library.map((w) => ({ ...w, name: w.title })), [library]);

  // One decision per distinct workout text, in first-seen order.
  const texts = [...new Map(parsed.entries.flatMap((e) => e.workouts).map((w) => [normalizeExerciseName(w), w])).entries()];
  const resolve = (key: string, typed: string) => {
    const match = matchExercise(typed, named);
    const choice: Choice =
      choices[key] ?? (match.exercise ? { kind: "library", id: match.exercise.id, title: match.exercise.title } : { kind: "new" });
    const guess = workoutFromText(typed);
    const newWorkout: NewWorkoutFromText = choice.kind === "new" && choice.type && choice.type !== guess.type
      ? { ...guess, type: choice.type, run_type: choice.type === "run" ? guess.run_type : null, strength_type: choice.type === "strength" ? guess.strength_type : null }
      : guess;
    return { choice, match, newWorkout };
  };
  const resolved = new Map(texts.map(([key, typed]) => [key, resolve(key, typed)]));

  const items: PlanTextImportItem[] = parsed.entries.flatMap((e) =>
    e.weeks.flatMap((week) =>
      e.workouts.flatMap((typed) => {
        const r = resolved.get(normalizeExerciseName(typed))!;
        if (r.choice.kind === "skip") return [];
        const logic = e.workouts.length > 1 ? e.logic : "or";
        return [r.choice.kind === "library" ? { week, day: e.day, libraryWorkoutId: r.choice.id, logic } : { week, day: e.day, workout: r.newWorkout, logic }];
      })
    )
  );

  async function handleImport() {
    setSaving(true);
    setError(null);
    try {
      await addPlanWorkoutsFromText(planId, items);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add workouts");
      setSaving(false);
    }
  }

  const btn = "text-xs px-2 py-0.5 rounded-md border border-[var(--border)] hover:bg-[var(--card)] transition-colors";

  function describeNew(w: NewWorkoutFromText): string {
    return [
      WORKOUT_TYPE_LABELS[w.type] ?? w.type,
      w.run_type ? RUN_TYPE_LABELS[w.run_type] : null,
      w.strength_type ? STRENGTH_TYPE_LABELS[w.strength_type] : null,
      w.distance_miles != null ? `${w.distance_miles} ${w.distance_unit}` : null,
      w.duration_minutes != null ? `${w.duration_minutes} min` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-2xl bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90dvh] sm:max-h-[90vh]">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Paste plan from text</h2>
            <button onClick={onCancel} className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none">
              ×
            </button>
          </div>

          <div className="space-y-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={8}
              autoFocus
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => setShowTips((v) => !v)} className="text-xs text-[var(--accent)] hover:underline">
                {showTips ? "Hide format tips" : "Format tips"}
              </button>
              <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                Lines before any “Week” heading go in
                <select
                  value={defaultWeek}
                  onChange={(e) => setDefaultWeek(parseInt(e.target.value, 10))}
                  className="rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs"
                >
                  {Array.from({ length: totalWeeks }, (_, i) => (
                    <option key={i} value={i + 1}>
                      Week {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {showTips && (
              <ul className="text-xs text-[var(--muted)] list-disc pl-4 space-y-0.5">
                <li>
                  One day per line: <code>Mon: Easy run 4 miles</code>, <code>Saturday - Long run 10 miles</code>, <code>Day 3: Tempo</code>.
                  Monday = Day 1.
                </li>
                <li>
                  Several days at once: <code>Mon/Wed/Fri: Easy 5 miles</code>.
                </li>
                <li>
                  Week headings: <code>Week 1</code>, <code>Weeks 2-4</code>, <code>Weeks 1, 3, 5</code>, <code>Every week</code>.
                </li>
                <li>
                  Two workouts the same day: <code>Track 200s + Upper body pull</code> (both) or <code>Tempo 5 miles or Bike 45 min</code>{" "}
                  (pick one).
                </li>
                <li>
                  Names that match your workout library are copied from it; anything else becomes a new workout (type, distance and time
                  guessed from the text — open it afterwards to add steps).
                </li>
              </ul>
            )}
          </div>

          {texts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Workouts</p>
              <ul className="space-y-1.5">
                {texts.map(([key, typed]) => {
                  const { choice, match, newWorkout } = resolved.get(key)!;
                  return (
                    <li key={key} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 space-y-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 text-sm">
                          {choice.kind === "library" ? (
                            <>
                              <span className="text-[var(--accent)]">✓</span> <span className="font-medium">{choice.title}</span>
                              <span className="text-xs text-[var(--muted)]"> · from your library</span>
                              {normalizeExerciseName(choice.title) !== key && (
                                <span className="text-xs text-[var(--muted)]"> · typed “{typed}”</span>
                              )}
                            </>
                          ) : choice.kind === "skip" ? (
                            <span className="text-[var(--muted)] line-through">{typed}</span>
                          ) : (
                            <>
                              <span className="text-[var(--muted)]">+</span> <span className="font-medium">{newWorkout.title}</span>
                              <span className="text-xs text-[var(--muted)]"> · new workout · {describeNew(newWorkout)}</span>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {choice.kind === "new" && (
                            <select
                              value={newWorkout.type}
                              onChange={(e) => setChoices((p) => ({ ...p, [key]: { kind: "new", type: e.target.value as WorkoutType } }))}
                              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs"
                              aria-label="Workout type"
                            >
                              {TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {WORKOUT_TYPE_LABELS[t] ?? t}
                                </option>
                              ))}
                            </select>
                          )}
                          <select
                            value=""
                            onChange={(e) => {
                              const w = library.find((l) => l.id === e.target.value);
                              if (w) setChoices((p) => ({ ...p, [key]: { kind: "library", id: w.id, title: w.title } }));
                            }}
                            className="max-w-[11rem] rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs"
                            aria-label="Pick from library"
                          >
                            <option value="">Pick from library…</option>
                            {library.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.title}
                              </option>
                            ))}
                          </select>
                          {choice.kind !== "new" && (
                            <button type="button" onClick={() => setChoices((p) => ({ ...p, [key]: { kind: "new" } }))} className={btn}>
                              New from text
                            </button>
                          )}
                          {choice.kind !== "skip" && (
                            <button type="button" onClick={() => setChoices((p) => ({ ...p, [key]: { kind: "skip" } }))} className={btn}>
                              Skip
                            </button>
                          )}
                        </div>
                      </div>
                      {choice.kind === "new" && match.suggestions.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-[var(--muted)]">Similar in your library:</span>
                          {match.suggestions.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setChoices((p) => ({ ...p, [key]: { kind: "library", id: s.id, title: s.title } }))}
                              className={`${btn} border-[var(--accent)] text-[var(--accent)]`}
                            >
                              Use “{s.title}”
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {parsed.entries.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Schedule</p>
              <ul className="text-sm space-y-0.5">
                {parsed.entries.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-[var(--muted)] w-44">
                      {weeksLabel(e.weeks)} · {DAY_NAMES[e.day]} ({PLAN_DAY_SHORT[e.day]})
                    </span>
                    <span>{e.workouts.join(e.logic === "and" ? " + " : " or ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parsed.outOfRangeWeeks.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This plan has {totalWeeks} weeks — skipping week {parsed.outOfRangeWeeks.join(", ")}. Change the plan length first to use them.
            </p>
          )}
          {parsed.unparsed.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Skipped (no day found): {parsed.unparsed.map((u) => `“${u}”`).join(", ")}
            </p>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleImport}
              disabled={saving || items.length === 0}
              className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving
                ? "Adding…"
                : items.length === 0
                ? "Add workouts"
                : `Add ${items.length} ${items.length === 1 ? "workout" : "workouts"} to plan`}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
