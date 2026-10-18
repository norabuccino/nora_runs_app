"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { RunningPace, WorkoutType } from "@/types/database";
import { adminImportPlan } from "@/app/actions/adminImport";
import type { PlanTextImportItem } from "@/app/actions/planTextImport";
import { parsePlanMeta, parsePlanText, PLAN_DAY_SHORT } from "@/lib/planTextImport";
import { buildWorkoutPayload, parseWorkoutBlock, type ParsedWorkoutBlock } from "@/lib/workoutTextBlock";
import { describeParsedExercise, flattenExercises } from "@/lib/workoutTextImport";
import { describeRunStep } from "@/lib/runTextImport";
import { normalizeExerciseName } from "@/lib/exerciseMatch";
import { ResolvedExerciseRow, useExerciseResolver, type ResolvedExercise } from "@/components/ExerciseResolution";
import { PlanWorkoutChoiceRow, usePlanWorkoutChoices, weeksLabel } from "@/components/PlanWorkoutChoices";
import { DAY_NAMES, DIFFICULTY_LABELS, PLAN_TYPE_LABELS, WORKOUT_TYPE_LABELS } from "@/lib/paceUtils";

const TYPES: WorkoutType[] = ["run", "strength", "swim", "bike", "cross_train", "rest"];

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
  const [paces, setPaces] = useState<RunningPace[]>([]);
  const [typeOverrides, setTypeOverrides] = useState<Record<string, WorkoutType>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ planId: string; added: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exerciseResolver = useExerciseResolver();
  const { library, isKnownWorkout, resolve, choose } = usePlanWorkoutChoices();

  useEffect(() => {
    createClient()
      .from("running_paces")
      .select("*")
      .order("created_at")
      .then(({ data }) => setPaces(data ?? []));
  }, []);
  const paceNames = useMemo(() => paces.map((p) => p.name), [paces]);

  const { meta, rest } = useMemo(() => parsePlanMeta(text), [text]);
  const parsed = useMemo(
    () => parsePlanText(rest, { totalWeeks: meta.weeks ?? 104, defaultWeek: 1, isKnownWorkout, collectBodies: true }),
    [rest, meta.weeks, isKnownWorkout]
  );
  const totalWeeks = meta.weeks ?? Math.max(1, ...parsed.entries.flatMap((e) => e.weeks));

  // Workouts written out under their day line — one card each, even when listed for several days.
  const fullKey = (title: string, body: string) => `${title}\n${body}`;
  const fullWorkouts = useMemo(() => {
    const map = new Map<string, { title: string; block: ParsedWorkoutBlock }>();
    for (const e of parsed.entries) {
      if (!e.body) continue;
      const key = fullKey(e.title, e.body);
      if (!map.has(key)) {
        const block = parseWorkoutBlock(`${e.title}\n${e.body}`, { paceNames, type: typeOverrides[key] });
        map.set(key, { title: e.title, block });
      }
    }
    return map;
  }, [parsed, paceNames, typeOverrides]);
  const exerciseRows = new Map<string, ResolvedExercise[]>(
    [...fullWorkouts].map(([key, w]) => [key, w.block.strength ? flattenExercises(w.block.strength.blocks).map(exerciseResolver.resolve) : []])
  );
  const pendingExercises = [...exerciseRows.values()].flat().filter((r) => !r.choice).length;

  const quickNames = [
    ...new Map(parsed.entries.filter((e) => !e.body).flatMap((e) => e.workouts).map((w) => [normalizeExerciseName(w), w])).entries(),
  ];
  const quickResolved = new Map(quickNames.map(([key, typed]) => [key, resolve(typed)]));

  function buildItems(): PlanTextImportItem[] {
    const payloads = new Map(
      [...fullWorkouts].map(([key, w]) => {
        const payload = buildWorkoutPayload(w.block, exerciseRows.get(key)!.map((r) => r.choice!), { paces });
        // Plan workouts have no source column (undefined is dropped when sent to the server).
        return [key, { ...payload, source: undefined } as Omit<typeof payload, "source">];
      })
    );
    return parsed.entries.flatMap((e) =>
      e.weeks.flatMap((week): PlanTextImportItem[] => {
        if (e.body) return [{ week, day: e.day, workout: payloads.get(fullKey(e.title, e.body))!, logic: "and" }];
        return e.workouts.flatMap((typed): PlanTextImportItem[] => {
          const r = quickResolved.get(normalizeExerciseName(typed))!;
          const logic = e.workouts.length > 1 ? e.logic : "or";
          if (r.choice.kind === "skip") return [];
          return r.choice.kind === "library"
            ? [{ week, day: e.day, libraryWorkoutId: r.choice.id, logic }]
            : [{ week, day: e.day, workout: r.newWorkout, logic }];
        });
      })
    );
  }
  const itemCount = parsed.entries.reduce(
    (n, e) =>
      n +
      e.weeks.length *
        (e.body ? 1 : e.workouts.filter((w) => quickResolved.get(normalizeExerciseName(w))?.choice.kind !== "skip").length),
    0
  );

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
      setTypeOverrides({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSaving(false);
    }
  }

  function renderFullWorkout(key: string, title: string, block: ParsedWorkoutBlock) {
    const rows = exerciseRows.get(key)!;
    let n = 0;
    return (
      <li key={key} className="rounded-lg border border-[var(--border)] p-2 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {block.details.title ?? title}
            <span className="text-xs font-normal text-[var(--muted)]"> · written out in the plan</span>
          </p>
          <select
            value={block.type}
            onChange={(e) => setTypeOverrides((p) => ({ ...p, [key]: e.target.value as WorkoutType }))}
            className="rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs"
            aria-label="Workout type"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {WORKOUT_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </div>
        {block.strength ? (
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
        ) : block.run ? (
          <ol className="text-xs text-[var(--muted)] space-y-0.5">
            {block.run.blocks.map((b, i) =>
              b.kind === "step" ? (
                <li key={i}>{describeRunStep(b.step, block.type === "swim" ? "swim" : "run")}</li>
              ) : (
                <li key={i}>
                  {b.count}× {b.steps.map((s) => describeRunStep(s, block.type === "swim" ? "swim" : "run")).join(" → ")}
                </li>
              )
            )}
          </ol>
        ) : (
          <p className="text-xs text-[var(--muted)]">No steps</p>
        )}
      </li>
    );
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

      {fullWorkouts.size > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Workouts written out</p>
          <ul className="space-y-1.5">{[...fullWorkouts].map(([key, w]) => renderFullWorkout(key, w.title, w.block))}</ul>
        </div>
      )}

      {quickNames.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Workouts by name</p>
          <ul className="space-y-1.5">
            {quickNames.map(([key, typed]) => (
              <PlanWorkoutChoiceRow key={key} typed={typed} resolved={quickResolved.get(key)!} library={library} onChoose={choose} />
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
