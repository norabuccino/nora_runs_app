"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { RunningPace } from "@/types/database";
import { parseDateLocal } from "@/lib/paceUtils";
import { addDays, type HistoryEntry } from "@/lib/workoutHistory";
import { fetchWorkoutHistory } from "@/lib/workoutHistoryQuery";
import { HistoryDayWorkouts } from "@/components/HistoryDayWorkouts";

const INITIAL_DAYS = 3;
const MORE_DAYS = 7;

interface RecentDaysProps {
  todayISO: string;
  paces: RunningPace[];
  /** Bumped by the dashboard after its own changes so this feed refetches. */
  refreshKey?: number;
  /** Called after a completion change here, so the dashboard can refresh too. */
  onChanged?: () => void | Promise<void>;
}

function dayLabel(date: string, todayISO: string): string {
  if (date === addDays(todayISO, -1)) return "Yesterday";
  return parseDateLocal(date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

/**
 * A reverse-chronological feed of the days before today, starting with
 * yesterday — "Show earlier days" extends it back a week at a time.
 */
export function RecentDays({ todayISO, paces, refreshKey = 0, onChanged }: RecentDaysProps) {
  const [daysBack, setDaysBack] = useState(INITIAL_DAYS);
  const [byDate, setByDate] = useState<Map<string, HistoryEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await fetchWorkoutHistory(addDays(todayISO, -daysBack), addDays(todayISO, -1));
    setByDate(result);
    setLoading(false);
  }, [todayISO, daysBack]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // The dashboard bumps refreshKey after its own reload, which refetches
  // this feed — so defer to it rather than loading twice.
  const handleChanged = onChanged ?? load;

  const dates = Array.from({ length: daysBack }, (_, i) => addDays(todayISO, -(i + 1)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm text-[var(--muted)] uppercase tracking-wide">Recent days</h2>
        <Link href="/history" className="text-xs text-[var(--accent)] hover:underline">
          View calendar →
        </Link>
      </div>

      <div className="space-y-5">
        {dates.map((date) => (
          <div key={date} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--muted)]">{dayLabel(date, todayISO)}</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>
            <HistoryDayWorkouts
              entries={byDate.get(date) ?? []}
              paces={paces}
              onChanged={handleChanged}
              emptyText={loading ? "Loading…" : "No workouts."}
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          setLoading(true);
          setDaysBack((n) => n + MORE_DAYS);
        }}
        disabled={loading}
        className="w-full rounded-lg border border-[var(--border)] py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-50"
      >
        {loading ? "Loading…" : "Show earlier days"}
      </button>
    </div>
  );
}
