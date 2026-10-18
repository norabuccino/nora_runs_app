"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WorkoutStepFormRow } from "@/components/WorkoutForm";
import { ExercisePickerModal, type ExercisePickResult } from "@/components/ExercisePickerModal";
import {
  describeParsedExercise,
  flattenExercises,
  isExerciseLine,
  parseWorkoutText,
  toFormSteps,
  type ExerciseResolution,
  type ParsedBlock,
  type ParsedExercise,
} from "@/lib/workoutTextImport";
import { matchExercise, normalizeExerciseName } from "@/lib/exerciseMatch";
import { splitWorkoutText, type WorkoutTextDetails } from "@/lib/workoutTextDetails";
import { ImportedDetailsPreview } from "@/components/ImportedDetailsPreview";
import type { DistanceUnit } from "@/lib/unitUtils";

type LibraryExercise = { id: string; name: string; video_url: string | null };

/** What the user decided for a typed name: a library exercise, or a one-off step that isn't in the library. */
type Choice = ExerciseResolution;

const PLACEHOLDER = `Upper body pull

push ups - 3 sets, 8-10 reps; pull ups - 3 sets, 8-10 reps

Superset (3 rounds):
Goblet squat x10 @ 25 lb
Split squat x8 each leg
Rest 60s

Plank 3x30s`;

interface WorkoutTextImportModalProps {
  startGroupId: number;
  unit: DistanceUnit;
  onImport: (result: { steps: WorkoutStepFormRow[]; namedGroupIds: number[]; details: WorkoutTextDetails }) => void;
  onCancel: () => void;
}

export function WorkoutTextImportModal({ startGroupId, unit, onImport, onCancel }: WorkoutTextImportModalProps) {
  const [text, setText] = useState("");
  const [exercises, setExercises] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(true);
  // Keyed by normalized typed name, so one decision covers every row with that name.
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [picker, setPicker] = useState<{ key: string; name: string; tab: "library" | "new" } | null>(null);
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("exercises").select("id, name, video_url").order("name");
      setExercises(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const { details, body } = useMemo(() => splitWorkoutText(text, "strength", isExerciseLine), [text]);
  const parsed = useMemo(() => parseWorkoutText(body), [body]);
  const flat = flattenExercises(parsed.blocks);

  function resolve(ex: ParsedExercise) {
    const key = normalizeExerciseName(ex.name);
    if (ex.isRest) return { key, choice: { exercise_id: "", label: "Rest", video_url: "" } as Choice, match: null };
    const chosen = choices[key];
    const match = matchExercise(ex.name, exercises);
    if (chosen) return { key, choice: chosen, match };
    if (match.exercise) {
      const e = match.exercise;
      return { key, choice: { exercise_id: e.id, label: e.name, video_url: e.video_url ?? "" }, match };
    }
    return { key, choice: null, match };
  }

  const resolved = flat.map(resolve);
  const pending = resolved.filter((r) => !r.choice).length;
  const hasDetails = Object.keys(details).length > 0;
  const canImport = !loading && (flat.length > 0 || hasDetails) && pending === 0;

  function choose(key: string, choice: Choice) {
    setChoices((prev) => ({ ...prev, [key]: choice }));
  }

  function handlePicked(result: ExercisePickResult) {
    if (!picker) return;
    if (result.exercise_id && !exercises.some((e) => e.id === result.exercise_id)) {
      setExercises((prev) => [...prev, { id: result.exercise_id, name: result.name, video_url: result.video_url || null }]);
    }
    choose(picker.key, { exercise_id: result.exercise_id, label: result.name, video_url: result.video_url });
    setPicker(null);
  }

  function handleImport() {
    const resolutions = resolved.map((r) => r.choice!);
    onImport({ ...toFormSteps(parsed.blocks, resolutions, { startGroupId, unit }), details });
  }

  const btn = "text-xs px-2 py-0.5 rounded-md border border-[var(--border)] hover:bg-[var(--card)] transition-colors";
  let rowIndex = 0;

  function renderRow(ex: ParsedExercise, inSuperset: boolean) {
    const { key, choice, match } = resolved[rowIndex++];
    const summary = describeParsedExercise(ex, inSuperset);
    const isLibrary = !!choice?.exercise_id;
    return (
      <li key={rowIndex} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm">
              {ex.isRest ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Rest</span>
              ) : choice ? (
                <>
                  <span className={isLibrary ? "text-[var(--accent)]" : "text-[var(--muted)]"}>{isLibrary ? "✓" : "○"}</span>{" "}
                  <span className="font-medium">{choice.label}</span>
                  {!isLibrary && <span className="text-xs text-[var(--muted)]"> · one-off, not in library</span>}
                  {normalizeExerciseName(choice.label) !== key && (
                    <span className="text-xs text-[var(--muted)]"> · typed “{ex.name}”</span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-amber-600 dark:text-amber-400">?</span> <span className="font-medium">{ex.name}</span>
                  <span className="text-xs text-[var(--muted)]"> · not in your library</span>
                </>
              )}
            </p>
            {summary && <p className="text-xs text-[var(--muted)]">{summary}</p>}
          </div>
          {choice && !ex.isRest && (
            <button type="button" onClick={() => setPicker({ key, name: ex.name, tab: "library" })} className={`${btn} shrink-0`}>
              Change
            </button>
          )}
        </div>

        {!choice && (
          <div className="flex flex-wrap items-center gap-1.5">
            {match?.suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => choose(key, { exercise_id: s.id, label: s.name, video_url: s.video_url ?? "" })}
                className={`${btn} border-[var(--accent)] text-[var(--accent)]`}
              >
                Use “{s.name}”
              </button>
            ))}
            <button type="button" onClick={() => setPicker({ key, name: ex.name, tab: "new" })} className={btn}>
              + Create new exercise
            </button>
            <button type="button" onClick={() => setPicker({ key, name: ex.name, tab: "library" })} className={btn}>
              Pick from library
            </button>
            <button type="button" onClick={() => choose(key, { exercise_id: "", label: ex.name, video_url: "" })} className={btn}>
              Keep as one-off
            </button>
          </div>
        )}
      </li>
    );
  }

  function renderBlock(block: ParsedBlock, i: number) {
    if (block.kind === "single") return <ul key={i}>{renderRow(block.exercise, false)}</ul>;
    const title =
      block.kind === "superset"
        ? `${block.name ?? "Superset"} · ${block.rounds} ${block.rounds === 1 ? "round" : "rounds"}`
        : block.name;
    return (
      <div key={i} className="rounded-lg border border-dashed border-[var(--border)] p-2 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">{title}</p>
        <ul className="space-y-1.5">{block.exercises.map((ex) => renderRow(ex, block.kind === "superset"))}</ul>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-xl bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90dvh] sm:max-h-[90vh]">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Paste exercises</h2>
            <button onClick={onCancel} className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none">
              ×
            </button>
          </div>

          <div className="space-y-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={7}
              autoFocus
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y"
            />
            <button type="button" onClick={() => setShowTips((v) => !v)} className="text-xs text-[var(--accent)] hover:underline">
              {showTips ? "Hide format tips" : "Format tips"}
            </button>
            {showTips && (
              <ul className="text-xs text-[var(--muted)] list-disc pl-4 space-y-0.5">
                <li>
                  Optional first line = title, then a paragraph of description before the exercises. Or label them:{" "}
                  <code>Title:</code>, <code>Description:</code>, <code>Notes:</code>, <code>Focus: upper body</code>.
                </li>
                <li>One exercise per line, or separate them with <code>;</code></li>
                <li>
                  Sets and reps: <code>3x10</code>, <code>3 sets, 8-10 reps</code>, <code>x12</code>. Time: <code>30s</code>,{" "}
                  <code>1 min</code>, <code>3x45s</code>
                </li>
                <li>
                  <code>each side</code> / <code>each leg</code>, weight: <code>@ 20 lb</code>, <code>BW</code>, <code>heavy</code>.
                  Anything else becomes a note.
                </li>
                <li>
                  Supersets: a <code>Superset (3 rounds):</code> or <code>Circuit x3:</code> line, or <code>A1.</code>/<code>A2.</code>{" "}
                  prefixes. Other <code>Name:</code> lines (e.g. <code>Warm up:</code>) make a named group. A blank line ends a group.
                </li>
                <li>
                  <code>Rest 60s</code> adds a rest. A range like 8-10 reps is saved as 8 reps with “8–10 reps” in the notes.
                </li>
              </ul>
            )}
          </div>

          <ImportedDetailsPreview details={details} />

          {loading ? (
            <p className="text-xs text-[var(--muted)]">Loading your exercises…</p>
          ) : flat.length > 0 ? (
            <div className="space-y-1.5">{parsed.blocks.map(renderBlock)}</div>
          ) : null}

          {parsed.unparsed.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Skipped (couldn&apos;t find an exercise name): {parsed.unparsed.map((u) => `“${u}”`).join(", ")}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {flat.length === 0
                ? hasDetails
                  ? "Add details"
                  : "Add exercises"
                : pending > 0
                ? `${pending} ${pending === 1 ? "exercise needs" : "exercises need"} a decision`
                : `Add ${flat.length} ${flat.length === 1 ? "step" : "steps"}`}
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

      {picker && (
        <ExercisePickerModal
          key={`${picker.key}-${picker.tab}`}
          initialTab={picker.tab}
          initialName={picker.name}
          onSelect={handlePicked}
          onCancel={() => setPicker(null)}
        />
      )}
    </div>
  );
}
