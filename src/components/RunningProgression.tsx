"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWorkoutHistory } from "@/lib/workoutHistoryQuery";
import { addDays, type HistoryEntry } from "@/lib/workoutHistory";
import { mondayOfWeek } from "@/lib/paceUtils";
import { convertDistance } from "@/lib/unitUtils";
import { useUnitPreference } from "@/hooks/useUnitPreference";
import {
  MILEAGE_JUMP_PCT,
  buildWeeklyMileage,
  niceAxis,
  runSeriesColor,
  runSeriesLabel,
  seriesInWeeks,
  type WeekMileage,
} from "@/lib/runningProgression";

const RANGES = [
  { weeks: 12, label: "Last 12 weeks" },
  { weeks: 26, label: "Last 26 weeks" },
  { weeks: 52, label: "Last 52 weeks" },
] as const;
const MAX_WEEKS = 52;
const CHART_HEIGHT = 220;

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatChange(pct: number | null): string {
  if (pct == null) return "—";
  const rounded = Math.round(pct);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function JumpFlag({ className = "" }: { className?: string }) {
  return (
    <span
      title={`Up more than ${MILEAGE_JUMP_PCT}% from the previous week`}
      aria-label={`Up more than ${MILEAGE_JUMP_PCT}% from the previous week`}
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white ${className}`}
    >
      !
    </span>
  );
}

export function RunningProgression() {
  const [unit] = useUnitPreference();
  const [entries, setEntries] = useState<Map<string, HistoryEntry[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rangeWeeks, setRangeWeeks] = useState<number>(12);
  const [active, setActive] = useState<number | null>(null);

  const thisWeek = mondayOfWeek(new Date());

  useEffect(() => {
    const firstWeek = addDays(thisWeek, -(MAX_WEEKS - 1) * 7);
    // One extra week before the range so the first week shown still has a change %.
    fetchWorkoutHistory(addDays(firstWeek, -7), addDays(thisWeek, 6))
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load running history"));
  }, [thisWeek]);

  const weeks = useMemo(
    () => (entries ? buildWeeklyMileage(entries, addDays(thisWeek, -(rangeWeeks - 1) * 7), rangeWeeks) : []),
    [entries, thisWeek, rangeWeeks]
  );

  const dist = (miles: number) => convertDistance(miles, "mi", unit);
  const fmt = (miles: number) => `${parseFloat(dist(miles).toFixed(1))} ${unit}`;

  const series = seriesInWeeks(weeks);
  const axis = niceAxis(Math.max(0, ...weeks.map((w) => dist(w.total))));
  const ticks = Array.from({ length: Math.round(axis.max / axis.step) + 1 }, (_, i) => i * axis.step);
  const labelEvery = rangeWeeks <= 12 ? 1 : rangeWeeks <= 26 ? 2 : 4;

  const totalMiles = weeks.reduce((sum, w) => sum + w.total, 0);
  const jumps = weeks.filter((w) => w.bigJump).length;
  const current = weeks[weeks.length - 1];
  const activeWeek = active != null ? weeks[active] : null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Completed runs from your plans and logged workouts — logged distance when you entered one, otherwise the planned distance.
      </p>

      <section className="space-y-4 rounded-xl border border-[var(--border)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Weekly mileage</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5 flex items-center gap-1">
              <JumpFlag /> marks a week up more than {MILEAGE_JUMP_PCT}% from the week before.
            </p>
          </div>
          <select
            value={rangeWeeks}
            onChange={(e) => { setRangeWeeks(Number(e.target.value)); setActive(null); }}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {RANGES.map((r) => <option key={r.weeks} value={r.weeks}>{r.label}</option>)}
          </select>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {!error && !entries && <p className="text-sm text-[var(--muted)]">Loading…</p>}

        {entries && totalMiles === 0 && (
          <p className="text-sm text-[var(--muted)] py-4">
            No completed runs in this period. Mark runs complete on Today or History, or pick a longer range.
          </p>
        )}

        {entries && totalMiles > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="This week" value={fmt(current?.total ?? 0)} />
              <Stat label="Weekly average" value={fmt(totalMiles / weeks.length)} />
              <Stat label={`Jumps over ${MILEAGE_JUMP_PCT}%`} value={String(jumps)} />
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {series.map((key) => (
                <span key={key} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: runSeriesColor(key) }} />
                  {runSeriesLabel(key)}
                </span>
              ))}
            </div>

            <div className="relative pt-2">
              {activeWeek && <WeekTooltip week={activeWeek} index={active!} count={weeks.length} series={series} fmt={fmt} isCurrent={activeWeek.weekStart === thisWeek} />}
              <div className="flex">
                {/* Y axis */}
                <div className="relative w-9 shrink-0 text-[10px] text-[var(--muted)]" style={{ height: CHART_HEIGHT }}>
                  {ticks.map((t) => (
                    <span key={t} className="absolute right-1.5 translate-y-1/2" style={{ bottom: (t / axis.max) * CHART_HEIGHT }}>
                      {parseFloat(t.toFixed(1))}
                    </span>
                  ))}
                </div>
                <div className="min-w-0 flex-1 overflow-x-auto pt-5 -mt-5">
                  <div style={{ minWidth: weeks.length * 14 }}>
                    <div className="relative" style={{ height: CHART_HEIGHT }} onMouseLeave={() => setActive(null)}>
                      {ticks.map((t) => (
                        <div
                          key={t}
                          className={`absolute inset-x-0 border-t ${t === 0 ? "border-[var(--muted)]/50" : "border-[var(--border)]"}`}
                          style={{ bottom: (t / axis.max) * CHART_HEIGHT }}
                        />
                      ))}
                      <div className="absolute inset-0 flex items-end gap-[2px]">
                        {weeks.map((w, i) => (
                          <WeekBar
                            key={w.weekStart}
                            week={w}
                            series={series}
                            scale={(miles) => (dist(miles) / axis.max) * CHART_HEIGHT}
                            dimmed={active != null && active !== i}
                            onActivate={() => setActive(i)}
                            onToggle={() => setActive((cur) => (cur === i ? null : i))}
                          />
                        ))}
                      </div>
                    </div>
                    {/* X axis */}
                    <div className="flex gap-[2px] pt-1 text-[10px] text-[var(--muted)]">
                      {weeks.map((w, i) => (
                        <div key={w.weekStart} className="relative flex-1 h-4">
                          {(weeks.length - 1 - i) % labelEvery === 0 && (
                            <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{formatShortDate(w.weekStart)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <p className="pl-9 text-[10px] text-[var(--muted)]">Week starting (Monday) · {unit}</p>
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)]">Show as table</summary>
              <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--card)] text-[var(--muted)] text-xs uppercase tracking-wide">
                      <th className="px-3 py-2 text-left font-medium">Week of</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-right font-medium">Change</th>
                      <th className="px-3 py-2 text-left font-medium">Breakdown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {[...weeks].reverse().map((w) => (
                      <tr key={w.weekStart}>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {formatShortDate(w.weekStart)}
                            {w.bigJump && <JumpFlag />}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap font-medium tabular-nums">{fmt(w.total)}</td>
                        <td className={`px-3 py-1.5 text-right whitespace-nowrap tabular-nums ${w.bigJump ? "text-red-500 font-medium" : "text-[var(--muted)]"}`}>
                          {formatChange(w.changePct)}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-[var(--muted)]">
                          {series.filter((k) => w.byType[k]).map((k) => `${runSeriesLabel(k)} ${fmt(w.byType[k])}`).join(" · ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--card)] px-3 py-2">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function WeekBar({
  week,
  series,
  scale,
  dimmed,
  onActivate,
  onToggle,
}: {
  week: WeekMileage;
  series: string[];
  scale: (miles: number) => number;
  dimmed: boolean;
  onActivate: () => void;
  onToggle: () => void;
}) {
  const segments = series.filter((k) => (week.byType[k] ?? 0) > 0);
  return (
    // The whole column is the hit target, not just the bar.
    <button
      type="button"
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={onToggle}
      aria-label={`Week of ${formatShortDate(week.weekStart)}`}
      className="relative flex h-full min-w-0 flex-1 flex-col-reverse items-center gap-[2px] focus:outline-none"
    >
      {segments.map((k, i) => (
        <span
          key={k}
          className={`block w-full max-w-12 shrink-0 transition-opacity ${i === segments.length - 1 ? "rounded-t" : ""} ${dimmed ? "opacity-40" : ""}`}
          style={{ height: Math.max(1, scale(week.byType[k]) - 2), background: runSeriesColor(k) }}
        />
      ))}
      {week.bigJump && (
        <span className="flex shrink-0 justify-center pb-0.5">
          <JumpFlag />
        </span>
      )}
    </button>
  );
}

function WeekTooltip({
  week,
  index,
  count,
  series,
  fmt,
  isCurrent,
}: {
  week: WeekMileage;
  index: number;
  count: number;
  series: string[];
  fmt: (miles: number) => string;
  isCurrent: boolean;
}) {
  // Anchor over the hovered column, flipping alignment near the edges so it stays on screen.
  const center = ((index + 0.5) / count) * 100;
  const align = center < 30 ? "translate-x-0" : center > 70 ? "-translate-x-full" : "-translate-x-1/2";
  return (
    <div
      className={`pointer-events-none absolute -top-2 z-10 w-60 -translate-y-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-2.5 text-xs shadow-lg ${align}`}
      style={{ left: `calc(2.25rem + (100% - 2.25rem) * ${center / 100})` }}
    >
      <p className="font-semibold">
        Week of {formatShortDate(week.weekStart)}
        {isCurrent && <span className="font-normal text-[var(--muted)]"> · this week</span>}
      </p>
      <p className="mt-1 flex items-baseline justify-between gap-2">
        <span className="whitespace-nowrap text-base font-semibold tabular-nums">{fmt(week.total)}</span>
        <span className={`inline-flex items-center gap-1 whitespace-nowrap tabular-nums ${week.bigJump ? "text-red-500 font-medium" : "text-[var(--muted)]"}`}>
          {week.bigJump && <JumpFlag />}
          {week.changePct == null ? "no prior week" : `${formatChange(week.changePct)} vs prior week`}
        </span>
      </p>
      {series.filter((k) => week.byType[k]).length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {series.filter((k) => week.byType[k]).map((k) => (
            <li key={k} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: runSeriesColor(k) }} />
                {runSeriesLabel(k)}
              </span>
              <span className="tabular-nums">{fmt(week.byType[k])}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
