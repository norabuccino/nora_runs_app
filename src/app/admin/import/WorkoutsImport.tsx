"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RunningPace, WorkoutType } from "@/types/database";
import { adminImportLibraryWorkouts } from "@/app/actions/adminImport";
import { ResolvedExerciseRow, useExerciseResolver, type ResolvedExercise } from "@/components/ExerciseResolution";
import { buildWorkoutPayload, parseWorkoutBlock, splitBulkWorkouts, type ParsedWorkoutBlock } from "@/lib/workoutTextBlock";
import { describeParsedExercise, flattenExercises } from "@/lib/workoutTextImport";
import { describeRunStep } from "@/lib/runTextImport";
import { RUN_TYPE_LABELS, STRENGTH_TYPE_LABELS, WORKOUT_TYPE_LABELS } from "@/lib/paceUtils";

const TYPES: WorkoutType[] = ["run", "strength", "swim", "bike", "cross_train", "rest"];

const PLACEHOLDER = `Track 200s
Two sets of fast 200s for turnover.
Warm up 2 miles, then 2 sets of 8x200m at 3K pace with 200m recovery. Jog 800m easy between sets. 2 mile cooldown.
---
Upper body pull
Type: strength
Pull ups 3x8
Superset (3 rounds):
DB row x10 each side
Face pulls x15
---
Zwift recovery ride
Easy spin 45 min`;

/** Bulk-create library workouts from text: one workout per chunk, chunks separated by ---. */
export function WorkoutsImport() {
  const [text, setText] = useState("");
  const [paces, setPaces] = useState<RunningPace[]>([]);
  const [typeOverrides, setTypeOverrides] = useState<Record<number, WorkoutType>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resolver = useExerciseResolver();

  useEffect(() => {
    createClient()
      .from("running_paces")
      .select("*")
      .order("created_at")
      .then(({ data }) => setPaces(data ?? []));
  }, []);

  const paceNames = useMemo(() => paces.map((p) => p.name), [paces]);
  const blocks = useMemo(
    () => splitBulkWorkouts(text).map((chunk, i) => parseWorkoutBlock(chunk, { paceNames, type: typeOverrides[i] })),
    [text, paceNames, typeOverrides]
  );
  const resolvedPerBlock: ResolvedExercise[][] = blocks.map((b) => (b.strength ? flattenExercises(b.strength.blocks).map(resolver.resolve) : []));
  const pending = resolvedPerBlock.flat().filter((r) => !r.choice).length;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payloads = blocks.map((b, i) => buildWorkoutPayload(b, resolvedPerBlock[i].map((r) => r.choice!), { paces }));
      const { count } = await adminImportLibraryWorkouts(payloads);
      setMessage(`Saved ${count} ${count === 1 ? "workout" : "workouts"} to the library.`);
      setText("");
      setTypeOverrides({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSaving(false);
    }
  }

  function renderSteps(block: ParsedWorkoutBlock, i: number) {
    if (block.strength) {
      let n = 0;
      return (
        <div className="space-y-1.5">
          {block.strength.blocks.map((b, bi) => {
            const rows = (b.kind === "single" ? [b.exercise] : b.exercises).map((ex) => {
              const idx = n++;
              return (
                <ResolvedExerciseRow
                  key={idx}
                  ex={ex}
                  summary={describeParsedExercise(ex, b.kind === "superset")}
                  resolved={resolvedPerBlock[i][idx]}
                  onChoose={resolver.choose}
                  onOpenPicker={resolver.openPicker}
                />
              );
            });
            if (b.kind === "single") return <ul key={bi}>{rows}</ul>;
            return (
              <div key={bi} className="rounded-lg border border-dashed border-[var(--border)] p-2 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                  {b.kind === "superset" ? `${b.name ?? "Superset"} · ${b.rounds} rounds` : b.name}
                </p>
                <ul className="space-y-1.5">{rows}</ul>
              </div>
            );
          })}
          {block.strength.unparsed.length > 0 && <Skipped items={block.strength.unparsed} />}
        </div>
      );
    }
    if (block.run) {
      const sport = block.type === "swim" ? "swim" : "run";
      return (
        <div className="space-y-1">
          <ol className="space-y-1 text-sm">
            {block.run.blocks.map((b, bi) =>
              b.kind === "step" ? (
                <li key={bi}>{describeRunStep(b.step, sport)}</li>
              ) : (
                <li key={bi}>
                  <span className="text-[var(--accent)] font-medium">{b.count}×</span> {b.steps.map((s) => describeRunStep(s, sport)).join("  →  ")}
                </li>
              )
            )}
          </ol>
          {block.run.unknownPaces.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Not one of your paces (kept in notes): {block.run.unknownPaces.join(", ")}</p>
          )}
          {block.run.unparsed.length > 0 && <Skipped items={block.run.unparsed} />}
        </div>
      );
    }
    return (
      <p className="text-sm text-[var(--muted)]">
        No steps
        {block.durationMinutes != null && ` · ${block.durationMinutes} min`}
        {block.distance != null && ` · ${block.distance} ${block.distanceUnit}`}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMessage(null);
          }}
          placeholder={PLACEHOLDER}
          rows={12}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y"
        />
        <p className="text-xs text-[var(--muted)]">
          Separate workouts with a <code>---</code> line. Each starts with its title, then an optional description, then the steps or
          exercises in the same format as the workout form&apos;s paste. The type is detected from the steps; add <code>Type: strength</code>{" "}
          (or run, swim, bike, cross_train, rest) to be explicit, and <code>Notes:</code> / <code>Source:</code> lines for those fields.
        </p>
      </div>

      {blocks.length > 0 && (
        <ol className="space-y-3">
          {blocks.map((block, i) => (
            <li key={i} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{block.details.title ?? <span className="text-amber-600">Untitled workout</span>}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {[
                      block.details.run_type ? RUN_TYPE_LABELS[block.details.run_type] : null,
                      block.details.strength_type ? STRENGTH_TYPE_LABELS[block.details.strength_type] : null,
                      block.details.description,
                      block.details.notes ? `Notes: ${block.details.notes}` : null,
                      block.details.source ? `Source: ${block.details.source}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <select
                  value={block.type}
                  onChange={(e) => setTypeOverrides((p) => ({ ...p, [i]: e.target.value as WorkoutType }))}
                  className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
                  aria-label="Workout type"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {WORKOUT_TYPE_LABELS[t] ?? t}
                    </option>
                  ))}
                </select>
              </div>
              {renderSteps(block, i)}
            </li>
          ))}
        </ol>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}

      <button
        onClick={handleSave}
        disabled={saving || blocks.length === 0 || pending > 0 || resolver.loading}
        className="w-full rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving
          ? "Saving…"
          : pending > 0
          ? `${pending} ${pending === 1 ? "exercise needs" : "exercises need"} a decision`
          : `Save ${blocks.length} ${blocks.length === 1 ? "workout" : "workouts"} to the library`}
      </button>

      {resolver.pickerModal}
    </div>
  );
}

function Skipped({ items }: { items: string[] }) {
  return (
    <p className="text-xs text-amber-600 dark:text-amber-400">Skipped (couldn&apos;t read): {items.map((u) => `“${u}”`).join(", ")}</p>
  );
}
