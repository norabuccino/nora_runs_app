"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { adminImportPlan } from "@/app/actions/adminImport";
import type { PlanTextImportItem } from "@/app/actions/planTextImport";
import { parsePlanMeta, parsePlanText, PLAN_DAY_SHORT, type NewWorkoutFromText } from "@/lib/planTextImport";
import { buildWorkoutPayload, parseWorkoutBlock, type ParsedWorkoutBlock } from "@/lib/workoutTextBlock";
import { describeParsedExercise, flattenExercises } from "@/lib/workoutTextImport";
import { describeRunStep } from "@/lib/runTextImport";
import { normalizeExerciseName } from "@/lib/exerciseMatch";
import { ResolvedExerciseRow, useExerciseResolver, type ResolvedExercise } from "@/components/ExerciseResolution";
import {
  PlanWorkoutChoiceRow,
  SaveAllToLibraryToggle,
  usePlanWorkoutChoices,
  weeksLabel,
  type ResolvedPlanWorkout,
} from "@/components/PlanWorkoutChoices";
import { DAY_NAMES, DIFFICULTY_LABELS, PLAN_TYPE_LABELS } from "@/lib/paceUtils";


const PLACEHOLDER = `Spring Half Build
Weeks: 12
Difficulty: intermediate
Days per week: 5
Description: Twelve weeks to a strong half marathon.

Week 1
Mon: Easy run 4 miles
Tue: Track 200s
  Warm up 2 miles, then 8x200m at 3K pace with 200m recovery. 2 mile cooldown.
Wed/Fri: Upper body pull
  Pull ups 3x8
  DB row 3x10 each side
Sat: 10 Mile Long Run

Weeks 2-4:
Mon/Thu: Easy 5 miles`;

/** A whole plan from text: details, weeks, days, and each day's workout as a library name, a quick name, or written out in full. */
export function PlanImport() {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ planId: string; added: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exerciseResolver = useExerciseResolver();
  const { library, paces, isKnownWorkout, resolve, choose, choiceFor, setSaveAllNew } = usePlanWorkoutChoices();
  const paceNames = useMemo(() => paces.map((p) => p.name), [paces]);

  const { meta, rest } = useMemo(() => parsePlanMeta(text), [text]);
  const parsed = useMemo(
    () => parsePlanText(rest, { totalWeeks: meta.weeks ?? 104, defaultWeek: 1, isKnownWorkout, collectBodies: true }),
    [rest, meta.weeks, isKnownWorkout]
  );
  const totalWeeks = meta.weeks ?? Math.max(1, ...parsed.entries.flatMap((e) => e.weeks));

  // Workouts written out under their day line — parsed once each, even when listed for several days.
  // A type picked in the row re-parses the written lines as that type.
  const fullKey = (title: string, body: string) => `written:${title}\n${body}`;
  const fullWorkouts = useMemo(() => {
    const map = new Map<string, { title: string; block: ParsedWorkoutBlock }>();
    for (const e of parsed.entries) {
      if (!e.body) continue;
      const key = fullKey(e.title, e.body);
      if (!map.has(key)) {
        const choice = choiceFor(key);
        const block = parseWorkoutBlock(`${e.title}\n${e.body}`, { paceNames, type: choice?.kind === "new" ? choice.type : undefined });
        map.set(key, { title: e.title, block });
      }
    }
    return map;
  }, [parsed, paceNames, choiceFor]);
  const exerciseRows = new Map<string, ResolvedExercise[]>(
    [...fullWorkouts].map(([key, w]) => [key, w.block.strength ? flattenExercises(w.block.strength.blocks).map(exerciseResolver.resolve) : []])
  );

  /** What a written-out workout would create, for the row (the saved payload also has its steps). */
  function writtenSummary(title: string, block: ParsedWorkoutBlock): NewWorkoutFromText {
    const totals = block.strength ? null : buildWorkoutPayload(block, [], { paces });
    return {
      type: block.type,
      run_type: block.type === "run" ? block.details.run_type ?? null : null,
      strength_type: block.type === "strength" ? block.details.strength_type ?? null : null,
      title: block.details.title ?? title,
      description: block.details.description ?? null,
      distance_miles: totals?.distance_miles ?? null,
      distance_unit: totals?.distance_unit ?? "mi",
      duration_minutes: totals?.duration_minutes ?? null,
      notes: block.details.notes ?? null,
    };
  }

  // Every workout in the plan, in the order it first appears — named ones and written-out ones alike.
  const workoutRows: { key: string; typed: string; resolved: ResolvedPlanWorkout; block?: ParsedWorkoutBlock }[] = [];
  const seen = new Set<string>();
  for (const e of parsed.entries) {
    if (e.body) {
      const key = fullKey(e.title, e.body);
      if (seen.has(key)) continue;
      seen.add(key);
      const { block } = fullWorkouts.get(key)!;
      workoutRows.push({ key, typed: e.title, block, resolved: resolve(e.title, { key, workout: writtenSummary(e.title, block) }) });
    } else {
      for (const typed of e.workouts) {
        const key = normalizeExerciseName(typed);
        if (seen.has(key)) continue;
        seen.add(key);
        workoutRows.push({ key, typed, resolved: resolve(typed) });
      }
    }
  }
  const resolvedByKey = new Map(workoutRows.map((r) => [r.key, r.resolved]));
  // Exercises only need deciding for written-out strength workouts that will be created from the written lines.
  const fromWritten = (r: ResolvedPlanWorkout) => r.choice.kind === "new" && !r.choice.edited;
  const pendingExercises = workoutRows
    .filter((r) => r.block && fromWritten(r.resolved))
    .flatMap((r) => exerciseRows.get(r.key)!)
    .filter((r) => !r.choice).length;

  /** A written-out workout as it will be saved — null while its exercises still need matching. */
  function writtenPayload(key: string, title: string): NewWorkoutFromText | null {
    const resolutions = exerciseRows.get(key)!;
    if (resolutions.some((x) => !x.choice)) return null;
    const payload = buildWorkoutPayload(fullWorkouts.get(key)!.block, resolutions.map((x) => x.choice!), { paces });
    // Plan workouts have no source column.
    const { source: _source, ...rest } = payload;
    void _source;
    return { ...rest, title };
  }

  function buildItems(): PlanTextImportItem[] {
    return parsed.entries.flatMap((e) =>
      e.weeks.flatMap((week): PlanTextImportItem[] => {
        const slots = e.body ? [{ key: fullKey(e.title, e.body), written: true }] : e.workouts.map((w) => ({ key: normalizeExerciseName(w), written: false }));
        const logic = slots.length > 1 ? e.logic : "or";
        return slots.flatMap(({ key, written }): PlanTextImportItem[] => {
          const r = resolvedByKey.get(key)!;
          if (r.choice.kind === "skip") return [];
          if (r.choice.kind === "library") return [{ week, day: e.day, libraryWorkoutId: r.choice.id, logic }];
          // Edited in the workout editor → exactly that; written out → its parsed lines; else the guess from the name.
          const workout = written && fromWritten(r) ? writtenPayload(key, r.newWorkout.title)! : r.newWorkout;
          return [{ week, day: e.day, workout, saveToLibraryKey: r.saveToLibrary ? key : undefined, logic }];
        });
      })
    );
  }
  const itemCount = parsed.entries.reduce((n, e) => {
    const keys = e.body ? [fullKey(e.title, e.body)] : e.workouts.map((w) => normalizeExerciseName(w));
    return n + e.weeks.length * keys.filter((k) => resolvedByKey.get(k)?.choice.kind !== "skip").length;
  }, 0);

  async function handleSave() {
    if (!meta.name) return;
    setSaving(true);
    setError(null);
    try {
      const result = await adminImportPlan(
        {
          name: meta.name,
          type: meta.type ?? "custom",
          difficulty: meta.difficulty ?? null,
          days_per_week: meta.daysPerWeek ?? null,
          description: meta.description ?? "",
          total_weeks: totalWeeks,
          source: meta.source ?? null,
        },
        buildItems()
      );
      setDone(result);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSaving(false);
    }
  }

  /** The written lines of a workout as they'll be saved: exercises to match, or run/swim steps. */
  function renderWrittenPreview(key: string, block: ParsedWorkoutBlock) {
    const rows = exerciseRows.get(key)!;
    let n = 0;
    if (block.strength) {
      return (
        <ul className="space-y-1.5">
          {block.strength.blocks.flatMap((b) =>
            (b.kind === "single" ? [b.exercise] : b.exercises).map((ex) => {
              const idx = n++;
              return (
                <ResolvedExerciseRow
                  key={idx}
                  ex={ex}
                  summary={describeParsedExercise(ex, b.kind === "superset")}
                  resolved={rows[idx]}
                  onChoose={exerciseResolver.choose}
                  onOpenPicker={exerciseResolver.openPicker}
                />
              );
            })
          )}
        </ul>
      );
    }
    if (block.run) {
      const sport = block.type === "swim" ? "swim" : "run";
      return (
        <ol className="text-xs text-[var(--muted)] space-y-0.5">
          {block.run.blocks.map((b, i) =>
            b.kind === "step" ? (
              <li key={i}>{describeRunStep(b.step, sport)}</li>
            ) : (
              <li key={i}>
                {b.count}× {b.steps.map((s) => describeRunStep(s, sport)).join(" → ")}
              </li>
            )
          )}
        </ol>
      );
    }
    return <p className="text-xs text-[var(--muted)]">No steps</p>;
  }

  const metaRows: [string, string | undefined][] = [
    ["Name", meta.name],
    ["Weeks", `${totalWeeks}${meta.weeks ? "" : " (from the weeks used)"}`],
    ["Type", PLAN_TYPE_LABELS[meta.type ?? "custom"]],
    ["Difficulty", meta.difficulty ? DIFFICULTY_LABELS[meta.difficulty] : undefined],
    ["Days per week", meta.daysPerWeek ? String(meta.daysPerWeek) : undefined],
    ["Description", meta.description],
    ["Source", meta.source],
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDone(null);
          }}
          placeholder={PLACEHOLDER}
          rows={14}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y"
        />
        <ul className="text-xs text-[var(--muted)] list-disc pl-4 space-y-0.5">
          <li>
            Plan details first: the name on the first line (or <code>Plan:</code>), then <code>Weeks:</code>, <code>Type:</code>,{" "}
            <code>Difficulty:</code>, <code>Days per week:</code>, <code>Description:</code>, <code>Source:</code>.
          </li>
          <li>
            Then weeks and days like the plan editor&apos;s paste: <code>Week 1</code>, <code>Weeks 2-4</code>, <code>Mon: …</code>,{" "}
            <code>Mon/Wed/Fri: …</code>, <code>a + b</code>, <code>a or b</code>.
          </li>
          <li>
            A day&apos;s workout can be a library title, a quick name (&ldquo;Easy 5 miles&rdquo;), or written out in full on the lines under
            the day line — steps or exercises in the workout paste format.
          </li>
        </ul>
      </div>

      {text.trim() && (
        <div className="rounded-lg border border-[var(--border)] p-3 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Plan</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
            {metaRows
              .filter((r): r is [string, string] => !!r[1])
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-[var(--muted)]">{label}</dt>
                  <dd className="whitespace-pre-line">{value}</dd>
                </div>
              ))}
          </dl>
          {!meta.name && <p className="text-xs text-amber-600 dark:text-amber-400">Add the plan name on the first line.</p>}
        </div>
      )}

      {workoutRows.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Workouts</p>
          <SaveAllToLibraryToggle resolved={workoutRows.map((r) => r.resolved)} onChange={setSaveAllNew} />
          <ul className="space-y-1.5">
            {workoutRows.map((r) => (
              <PlanWorkoutChoiceRow
                key={r.key}
                typed={r.typed}
                resolved={r.resolved}
                library={library}
                paces={paces}
                onChoose={choose}
                getDraft={r.block ? () => writtenPayload(r.key, r.resolved.newWorkout.title) : undefined}
              >
                {r.block && renderWrittenPreview(r.key, r.block)}
              </PlanWorkoutChoiceRow>
            ))}
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
          Beyond {totalWeeks} weeks — skipping week {parsed.outOfRangeWeeks.join(", ")}.
        </p>
      )}
      {parsed.unparsed.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Skipped (not under a day line): {parsed.unparsed.map((u) => `“${u}”`).join(", ")}
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {done && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Created the plan with {done.added} workouts.{" "}
          <Link href={`/plans/${done.planId}/edit`} className="underline">
            Open it in the editor →
          </Link>
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !meta.name || itemCount === 0 || pendingExercises > 0}
        className="w-full rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving
          ? "Creating…"
          : pendingExercises > 0
          ? `${pendingExercises} ${pendingExercises === 1 ? "exercise needs" : "exercises need"} a decision`
          : `Create plan with ${itemCount} ${itemCount === 1 ? "workout" : "workouts"}`}
      </button>

      {exerciseResolver.pickerModal}
    </div>
  );
}
