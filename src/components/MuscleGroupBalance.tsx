"use client";

import { useEffect, useMemo, useState } from "react";
import { getMuscleGroupBreakdown, type MuscleGroupBreakdownData } from "@/app/actions/strengthSessions";
import { summarizeMuscleGroups } from "@/lib/muscleGroupBreakdown";
import { MUSCLE_GROUP_LABELS } from "@/lib/muscleGroups";

const RANGES = [
  { value: "28", label: "Last 4 weeks" },
  { value: "84", label: "Last 12 weeks" },
  { value: "all", label: "All time" },
] as const;

const REGION_LABELS = { upper: "Upper body", core: "Core", lower: "Lower body" } as const;
const REGION_STYLES = {
  upper: "bg-[var(--badge-exercise-upper-body-bg)] text-[var(--badge-exercise-upper-body-text)]",
  core: "bg-[var(--badge-exercise-core-bg)] text-[var(--badge-exercise-core-text)]",
  lower: "bg-[var(--badge-exercise-lower-body-bg)] text-[var(--badge-exercise-lower-body-text)]",
} as const;

function localISODate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function MuscleGroupBalance() {
  const [data, setData] = useState<MuscleGroupBreakdownData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<string>("28");

  useEffect(() => {
    getMuscleGroupBreakdown()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load muscle group data"));
  }, []);

  const summary = useMemo(() => {
    if (!data) return null;
    const since = range === "all" ? null : localISODate(Number(range) - 1);
    return summarizeMuscleGroups(data.performances, new Map(Object.entries(data.muscleGroupsByExercise)), since);
  }, [data, range]);

  const maxSets = summary ? Math.max(1, ...summary.rows.map((r) => r.sets)) : 1;

  return (
    <section className="space-y-4 rounded-xl border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Muscle group balance</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Sets from completed workouts, by the muscle groups each exercise works.
          </p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {!error && !summary && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {summary && summary.totalSets === 0 && (
        <p className="text-sm text-[var(--muted)] py-4">
          No completed exercises with muscle groups in this period. Complete a strength workout, or pick a longer range.
        </p>
      )}

      {summary && summary.totalSets > 0 && (
        <>
          <div className="space-y-1.5">
            <div className="flex h-7 w-full overflow-hidden rounded-lg text-xs font-medium">
              {(Object.keys(REGION_LABELS) as (keyof typeof REGION_LABELS)[]).map((region) =>
                summary.regions[region] > 0 ? (
                  <div
                    key={region}
                    className={`flex items-center justify-center min-w-0 px-1 truncate ${REGION_STYLES[region]}`}
                    style={{ width: pct(summary.regions[region]) }}
                    title={`${REGION_LABELS[region]}: ${pct(summary.regions[region])}`}
                  >
                    {summary.regions[region] >= 0.12 ? `${REGION_LABELS[region]} ${pct(summary.regions[region])}` : pct(summary.regions[region])}
                  </div>
                ) : null
              )}
            </div>
            <p className="text-xs text-[var(--muted)] tabular-nums">
              {summary.totalSets} sets over {summary.workoutDays} workout day{summary.workoutDays === 1 ? "" : "s"}
              {summary.untaggedSets > 0 && ` · ${summary.untaggedSets} sets from exercises with no muscle group`}
            </p>
          </div>

          <div className="space-y-1">
            {summary.rows.map((row) => (
              <div key={row.group} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:grid-cols-[8rem_minmax(0,1fr)_14rem] items-center gap-3 text-sm py-1">
                <span className={row.sets ? "" : "text-[var(--muted)]"}>{MUSCLE_GROUP_LABELS[row.group]}</span>
                <div className="h-2.5 rounded-full bg-[var(--card)] border border-[var(--border)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(row.sets / maxSets) * 100}%` }} />
                </div>
                <span className="text-xs text-[var(--muted)] tabular-nums text-right whitespace-nowrap">
                  {row.sets ? (
                    <>
                      <span className="font-medium text-[var(--foreground)]">{row.sets}</span> sets · {pct(row.share)}
                      <span className="hidden sm:inline"> · last {formatShortDate(row.lastDate!)}</span>
                    </>
                  ) : (
                    "Not trained"
                  )}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-[var(--muted)]">
            Exercises that work several groups count toward each one. Workouts logged in the player use the sets you
            logged; workouts only marked complete use their planned sets.
          </p>
        </>
      )}
    </section>
  );
}
