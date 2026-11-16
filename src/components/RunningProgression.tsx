"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWorkoutHistory } from "@/lib/workoutHistoryQuery";
import { addDays, type HistoryEntry } from "@/lib/workoutHistory";
import { formatDateLocal, mondayOfWeek } from "@/lib/paceUtils";
import { convertDistance } from "@/lib/unitUtils";
import { useUnitPreference } from "@/hooks/useUnitPreference";
import {
  MILEAGE_JUMP_PCT,
  MILEAGE_LARGE_JUMP_PCT,
  REBOUND_LOOKBACK_WEEKS,
  buildWeeklyMileage,
  niceAxis,
  runSeriesColor,
  runSeriesLabel,
  seriesInWeeks,
  trimEmptyFutureWeeks,
  type MileageJump,
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

/** Striped fill for planned (not yet run) mileage, in the run type's colour. */
function plannedFill(color: string): string {
  return `repeating-linear-gradient(-45deg, ${color} 0 3px, color-mix(in srgb, ${color} 25%, transparent) 3px 6px)`;
}

const JUMP_FLAGS: Record<Exclude<MileageJump, "none">, { icon: string; className: string; text: string; description: string }> = {
  moderate: {
    icon: "!",
    className: "bg-amber-400 text-black",
    text: "text-amber-600 dark:text-amber-400",
    description: `Up ${MILEAGE_JUMP_PCT}–${MILEAGE_LARGE_JUMP_PCT}% from the previous week`,
  },
  large: {
    icon: "!",
    className: "bg-red-500 text-white",
    text: "text-red-500",
    description: `Up more than ${MILEAGE_LARGE_JUMP_PCT}% from the previous week`,
  },
  rebound: {
    icon: "?",
    className: "bg-white text-blue-600 border border-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    description: `Up more than ${MILEAGE_JUMP_PCT}% from the previous week, but within ${MILEAGE_JUMP_PCT}% of the highest of the last ${REBOUND_LOOKBACK_WEEKS} weeks`,
  },
};

const jumpText = (jump: MileageJump) => (jump === "none" ? "text-[var(--muted)]" : `${JUMP_FLAGS[jump].text} font-medium`);

function JumpFlag({ jump, className = "" }: { jump: MileageJump; className?: string }) {
  if (jump === "none") return null;
  const flag = JUMP_FLAGS[jump];
  return (
    <span
      title={flag.description}
      aria-label={flag.description}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none ${flag.className} ${className}`}
    >
      {flag.icon}
    </span>
  );
}

export function RunningProgression() {
  const [unit] = useUnitPreference();
  const [entries, setEntries] = useState<Map<string, HistoryEntry[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rangeWeeks, setRangeWeeks] = useState<number>(12);
  const [active, setActive] = useState<number | null>(null);
  const [showPlanned, setShowPlanned] = useState(false);

  const thisWeek = mondayOfWeek(new Date());
  const today = formatDateLocal(new Date());

  useEffect(() => {
    const firstWeek = addDays(thisWeek, -(MAX_WEEKS - 1) * 7);
    // Weeks before the range so the first weeks shown still get a change % and rebound check.
    // Reads ahead too, for the optional upcoming planned weeks.
    fetchWorkoutHistory(addDays(firstWeek, -7 * REBOUND_LOOKBACK_WEEKS), addDays(thisWeek, MAX_WEEKS * 7 - 1))
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load running history"));
  }, [thisWeek]);

  const weeks = useMemo(() => {
    if (!entries) return [];
    const firstWeek = addDays(thisWeek, -(rangeWeeks - 1) * 7);
    if (!showPlanned) return buildWeeklyMileage(entries, firstWeek, rangeWeeks);
    return trimEmptyFutureWeeks(buildWeeklyMileage(entries, firstWeek, rangeWeeks + MAX_WEEKS, today), thisWeek);
  }, [entries, thisWeek, today, rangeWeeks, showPlanned]);

  const dist = (miles: number) => convertDistance(miles, "mi", unit);
  const fmt = (miles: number) => `${parseFloat(dist(miles).toFixed(1))} ${unit}`;

  const series = seriesInWeeks(weeks);
  const axis = niceAxis(Math.max(0, ...weeks.map((w) => dist(w.total + w.planned))));
  const ticks = Array.from({ length: Math.round(axis.max / axis.step) + 1 }, (_, i) => i * axis.step);
  const labelEvery = weeks.length <= 16 ? 1 : weeks.length <= 32 ? 2 : 4;

  const pastWeeks = weeks.filter((w) => w.weekStart <= thisWeek);
  const totalMiles = pastWeeks.reduce((sum, w) => sum + w.total, 0);
  const plannedMiles = weeks.reduce((sum, w) => sum + w.planned, 0);
  const jumps = weeks.filter((w) => w.jump === "moderate" || w.jump === "large").length;
  const current = weeks.find((w) => w.weekStart === thisWeek);
  const activeWeek = active != null ? weeks[active] : null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Completed runs from your plans and logged workouts — logged distance when you entered one, otherwise the planned distance.
        {showPlanned &&
          " Striped bars are upcoming runs from your active plans and schedule; on a plan day with alternative workouts, the longest run counts."}
      </p>

      <section className="space-y-4 rounded-xl border border-[var(--border)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Weekly mileage</h2>
            <ul className="mt-1 space-y-0.5 text-xs text-[var(--muted)]">
              {(["moderate", "large", "rebound"] as const).map((jump) => (
                <li key={jump} className="flex items-center gap-1.5">
                  <JumpFlag jump={jump} /> {JUMP_FLAGS[jump].description}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={showPlanned}
              onChange={(e) => { setShowPlanned(e.target.checked); setActive(null); }}
              className="accent-[var(--accent)]"
            />
            Show upcoming planned weeks
          </label>
          <select
            value={rangeWeeks}
            onChange={(e) => { setRangeWeeks(Number(e.target.value)); setActive(null); }}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {RANGES.map((r) => <option key={r.weeks} value={r.weeks}>{r.label}</option>)}
          </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {!error && !entries && <p className="text-sm text-[var(--muted)]">Loading…</p>}

        {entries && totalMiles + plannedMiles === 0 && (
          <p className="text-sm text-[var(--muted)] py-4">
            No {showPlanned ? "completed or upcoming" : "completed"} runs in this period. Mark runs complete on Today or History, or pick a longer range.
          </p>
        )}

        {entries && showPlanned && plannedMiles === 0 && totalMiles > 0 && (
          <p className="text-xs text-[var(--muted)]">No upcoming planned runs in your active plans or schedule.</p>
        )}

        {entries && totalMiles + plannedMiles > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat
                label="This week"
                value={fmt(current?.total ?? 0)}
                sub={showPlanned && current?.planned ? `+ ${fmt(current.planned)} planned` : undefined}
              />
              <Stat label="Weekly average" value={fmt(totalMiles / Math.max(1, pastWeeks.length))} />
              <Stat label={`Jumps over ${MILEAGE_JUMP_PCT}%`} value={String(jumps)} />
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {series.map((key) => (
                <span key={key} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: runSeriesColor(key) }} />
                  {runSeriesLabel(key)}
                </span>
              ))}
              {showPlanned && plannedMiles > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: plannedFill("var(--muted)") }} />
                  Planned
                </span>
              )}
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
                          {Math.abs(weeks.indexOf(current!) - i) % labelEvery === 0 && (
                            <span
                              className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap ${
                                w.weekStart === thisWeek ? "font-semibold text-[var(--foreground)]" : ""
                              }`}
                            >
                              {formatShortDate(w.weekStart)}
                            </span>
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
                            <JumpFlag jump={w.jump} />
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap font-medium tabular-nums">
                          {fmt(w.total + w.planned)}
                          {w.planned > 0 && <span className="block text-xs font-normal text-[var(--muted)]">{fmt(w.planned)} planned</span>}
                        </td>
                        <td className={`px-3 py-1.5 text-right whitespace-nowrap tabular-nums ${jumpText(w.jump)}`}>
                          {formatChange(w.changePct)}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-[var(--muted)]">
                          {series
                            .filter((k) => w.byType[k] || w.plannedByType[k])
                            .map((k) => `${runSeriesLabel(k)} ${fmt((w.byType[k] ?? 0) + (w.plannedByType[k] ?? 0))}`)
                            .join(" · ") || "—"}
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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-[var(--card)] px-3 py-2">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-[var(--muted)] tabular-nums">{sub}</p>}
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
  // Completed mileage at the bottom, planned stacked on top.
  const segments = [
    ...series.filter((k) => (week.byType[k] ?? 0) > 0).map((k) => ({ key: k, miles: week.byType[k], planned: false })),
    ...series.filter((k) => (week.plannedByType[k] ?? 0) > 0).map((k) => ({ key: k, miles: week.plannedByType[k], planned: true })),
  ];
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
      {segments.map((seg, i) => (
        <span
          key={`${seg.planned ? "planned" : "done"}:${seg.key}`}
          className={`block w-full max-w-12 shrink-0 transition-opacity ${i === segments.length - 1 ? "rounded-t" : ""} ${dimmed ? "opacity-40" : ""}`}
          style={{
            height: Math.max(1, scale(seg.miles) - 2),
            background: seg.planned ? plannedFill(runSeriesColor(seg.key)) : runSeriesColor(seg.key),
          }}
        />
      ))}
      {week.jump !== "none" && (
        <span className="flex shrink-0 justify-center pb-0.5">
          <JumpFlag jump={week.jump} />
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
  const types = series.filter((k) => week.byType[k] || week.plannedByType[k]);
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
        <span className="whitespace-nowrap text-base font-semibold tabular-nums">{fmt(week.total + week.planned)}</span>
        <span className={`inline-flex items-center gap-1 whitespace-nowrap tabular-nums ${jumpText(week.jump)}`}>
          <JumpFlag jump={week.jump} />
          {week.changePct == null ? "no prior week" : `${formatChange(week.changePct)} vs prior week`}
        </span>
      </p>
      {week.jump === "rebound" && (
        <p className="text-[var(--muted)] tabular-nums">Back near your recent high of {fmt(week.recentPeak)}</p>
      )}
      {week.planned > 0 && (
        <p className="text-[var(--muted)] tabular-nums">
          {week.total > 0 ? `${fmt(week.total)} done · ` : ""}{fmt(week.planned)} planned
        </p>
      )}
      {types.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {types.map((k) => (
            <li key={k} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: week.byType[k] ? runSeriesColor(k) : plannedFill(runSeriesColor(k)) }}
                />
                {runSeriesLabel(k)}
              </span>
              <span className="tabular-nums">{fmt((week.byType[k] ?? 0) + (week.plannedByType[k] ?? 0))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
