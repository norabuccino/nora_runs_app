"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RunningPace } from "@/types/database";
import { formatDateLocal, parseDateLocal, WORKOUT_TYPE_COLORS, WEEKDAY_NAMES } from "@/lib/paceUtils";
import { convertDistance } from "@/lib/unitUtils";
import { useUnitPreference } from "@/hooks/useUnitPreference";
import { monthGridDates, summarizeHistory, type HistoryEntry } from "@/lib/workoutHistory";
import { fetchWorkoutHistory } from "@/lib/workoutHistoryQuery";
import { HistoryDayWorkouts } from "@/components/HistoryDayWorkouts";

// Background-only variant of the workout type color, for the small dots used
// on narrow screens where a titled pill won't fit in a calendar cell.
function typeDotClass(type: string): string {
  const classes = WORKOUT_TYPE_COLORS[type] ?? WORKOUT_TYPE_COLORS.rest;
  return classes.split(" ").filter((c) => c.startsWith("bg-")).join(" ");
}

export default function HistoryPage() {
  const todayISO = formatDateLocal(new Date());
  const [unit] = useUnitPreference();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selected, setSelected] = useState(todayISO);
  const [byDate, setByDate] = useState<Map<string, HistoryEntry[]>>(new Map());
  const [paces, setPaces] = useState<RunningPace[]>([]);
  const [loading, setLoading] = useState(true);

  const gridDates = monthGridDates(month.year, month.month);
  const monthPrefix = `${month.year}-${String(month.month + 1).padStart(2, "0")}`;

  const load = useCallback(async () => {
    const dates = monthGridDates(month.year, month.month);
    const result = await fetchWorkoutHistory(dates[0], dates[dates.length - 1]);
    setByDate(result);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    createClient()
      .from("running_paces")
      .select("*")
      .order("created_at")
      .then(({ data }) => setPaces(data ?? []));
  }, []);

  function shiftMonth(delta: number) {
    const d = new Date(month.year, month.month + delta, 1);
    setLoading(true);
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
    // Keep the selection inside the visible month: today if it's there, else the 1st.
    const firstISO = formatDateLocal(d);
    setSelected(todayISO.slice(0, 7) === firstISO.slice(0, 7) ? todayISO : firstISO);
  }

  function goToToday() {
    const now = new Date();
    if (now.getFullYear() !== month.year || now.getMonth() !== month.month) setLoading(true);
    setMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(todayISO);
  }

  const monthLabel = new Date(month.year, month.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const monthEntries = gridDates
    .filter((d) => d.startsWith(monthPrefix) && d <= todayISO)
    .flatMap((d) => byDate.get(d) ?? []);
  const summary = summarizeHistory(monthEntries);
  const selectedEntries = byDate.get(selected) ?? [];
  const selectedLabel = parseDateLocal(selected).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">History</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Everything you&apos;ve done — and planned — by month.</p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="w-8 h-8 rounded-lg border border-[var(--border)] hover:border-[var(--foreground)] transition-colors"
          >
            ‹
          </button>
          <h2 className="font-semibold min-w-[10rem] text-center">{monthLabel}</h2>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="w-8 h-8 rounded-lg border border-[var(--border)] hover:border-[var(--foreground)] transition-colors"
          >
            ›
          </button>
          <button onClick={goToToday} className="ml-1 text-xs text-[var(--accent)] hover:underline">
            Today
          </button>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {summary.completed} of {summary.scheduled} workouts done
          {summary.completedMiles > 0 && ` · ${convertDistance(summary.completedMiles, "mi", unit).toFixed(1)} ${unit}`}
        </p>
      </div>

      <div className={`rounded-xl border border-[var(--border)] overflow-hidden transition-opacity ${loading ? "opacity-50" : ""}`}>
        <div className="grid grid-cols-7 bg-[var(--card)] border-b border-[var(--border)]">
          {WEEKDAY_NAMES.map((name) => (
            <div key={name} className="py-2 text-center text-xs font-medium text-[var(--muted)]">
              <span className="sm:hidden">{name[0]}</span>
              <span className="hidden sm:inline">{name.slice(0, 3)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {gridDates.map((date, i) => {
            const entries = (byDate.get(date) ?? []).filter((e) => e.workout.type !== "rest");
            const inMonth = date.startsWith(monthPrefix);
            const isToday = date === todayISO;
            const isSelected = date === selected;
            const isPast = date < todayISO;
            return (
              <button
                key={date}
                onClick={() => setSelected(date)}
                className={`min-h-[3.5rem] sm:min-h-[6.5rem] p-1 sm:p-1.5 text-left align-top flex flex-col gap-1 border-[var(--border)] transition-colors
                  ${i % 7 !== 6 ? "border-r" : ""} ${i < gridDates.length - 7 ? "border-b" : ""}
                  ${isSelected ? "bg-[var(--accent)]/10" : "hover:bg-[var(--card)]"}
                  ${inMonth ? "" : "opacity-40"}`}
              >
                <span
                  className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? "bg-[var(--accent)] text-white font-semibold" : "text-[var(--muted)]"
                  }`}
                >
                  {parseDateLocal(date).getDate()}
                </span>

                {/* Narrow screens: one dot per workout — filled when done, hollow when missed/upcoming */}
                <div className="flex flex-wrap gap-0.5 sm:hidden">
                  {entries.map((e) => (
                    <span
                      key={e.key}
                      className={`w-2 h-2 rounded-full ${
                        e.log?.completed_at ? typeDotClass(e.workout.type) : "border border-[var(--muted)]"
                      }`}
                    />
                  ))}
                </div>

                {/* Wider screens: titled pills */}
                <div className="hidden sm:flex flex-col gap-0.5 w-full">
                  {entries.slice(0, 3).map((e) => {
                    const done = !!e.log?.completed_at;
                    return (
                      <span
                        key={e.key}
                        title={e.log?.custom_title ?? e.workout.title}
                        className={`text-[10px] leading-tight px-1.5 py-0.5 rounded truncate ${
                          done
                            ? WORKOUT_TYPE_COLORS[e.workout.type] ?? WORKOUT_TYPE_COLORS.rest
                            : `border border-dashed border-[var(--border)] text-[var(--muted)] ${isPast ? "line-through" : ""}`
                        }`}
                      >
                        {done && "✓ "}
                        {e.log?.custom_title ?? e.workout.title}
                      </span>
                    );
                  })}
                  {entries.length > 3 && (
                    <span className="text-[10px] text-[var(--muted)]">+{entries.length - 3} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Filled = completed · Dashed = not completed{" "}
        <span className="hidden sm:inline">(struck through once the day has passed)</span>
      </p>

      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-[var(--muted)] uppercase tracking-wide">{selectedLabel}</h2>
        <HistoryDayWorkouts
          entries={selectedEntries}
          paces={paces}
          onChanged={load}
          showPlanName
          emptyText={selected < todayISO ? "No workouts this day." : "Nothing scheduled yet."}
        />
      </div>
    </div>
  );
}
