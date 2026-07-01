"use client";

import { useState, useTransition } from "react";
import type { PlanWorkout } from "@/types/database";
import { DAY_NAMES } from "@/lib/paceUtils";
import { copyWorkoutToDays } from "@/app/actions/workouts";

interface Props {
  workout: PlanWorkout;
  planId: string;
  totalWeeks: number;
  onClose: () => void;
  onCopied: () => void;
}

export function CopyToDaysModal({ workout, planId, totalWeeks, onClose, onCopied }: Props) {
  const sourceKey = `${workout.week_number}-${workout.day_of_week}`;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggle(weekNum: number, day: number) {
    const key = `${weekNum}-${day}`;
    if (key === sourceKey) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Click a day-of-week column header → toggle all non-source cells in that column
  function toggleColumn(day: number) {
    const keys = Array.from({ length: totalWeeks }, (_, i) => `${i + 1}-${day}`).filter(
      (k) => k !== sourceKey
    );
    const allSelected = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  function handleConfirm() {
    const targets = Array.from(selected).map((key) => {
      const [w, d] = key.split("-").map(Number);
      return { weekNumber: w, dayOfWeek: d };
    });
    if (targets.length === 0) return;
    startTransition(async () => {
      await copyWorkoutToDays(workout.id, planId, targets);
      onCopied();
    });
  }

  const count = selected.size;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl flex flex-col max-h-[90dvh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 pb-3 shrink-0">
          <div>
            <h2 className="font-semibold">Copy to other days</h2>
            <p className="text-sm text-[var(--muted)] mt-0.5 truncate max-w-xs">
              {workout.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none ml-4 shrink-0"
          >
            ×
          </button>
        </div>

        <p className="px-5 pb-2 text-xs text-[var(--muted)] shrink-0">
          Click a day name to select every week at once. The source day is marked{" "}
          <span className="font-medium text-[var(--foreground)]">here</span>.
        </p>

        {/* Grid */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-5 pb-4">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-[var(--background)]">
              <tr>
                <th className="text-left text-[var(--muted)] font-medium pb-2 pr-3 w-12">Wk</th>
                {DAY_NAMES.map((name, d) => {
                  const colKeys = Array.from({ length: totalWeeks }, (_, i) => `${i + 1}-${d}`).filter(
                    (k) => k !== sourceKey
                  );
                  const allOn = colKeys.length > 0 && colKeys.every((k) => selected.has(k));
                  return (
                    <th key={d} className="pb-2 px-0.5">
                      <button
                        onClick={() => toggleColumn(d)}
                        className={`w-full rounded py-1 font-medium transition-colors ${
                          allOn
                            ? "bg-[var(--foreground)] text-[var(--background)]"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                        title={`Select all ${name}s`}
                      >
                        {name}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: totalWeeks }, (_, wi) => {
                const weekNum = wi + 1;
                return (
                  <tr key={weekNum} className="border-t border-[var(--border)]">
                    <td className="text-[var(--muted)] pr-3 py-1.5 font-medium">{weekNum}</td>
                    {DAY_NAMES.map((_, d) => {
                      const key = `${weekNum}-${d}`;
                      const isSource = key === sourceKey;
                      const isOn = selected.has(key);
                      return (
                        <td key={d} className="px-0.5 py-1.5">
                          {isSource ? (
                            <div
                              className="w-full rounded py-1 text-center text-[10px] font-semibold bg-[var(--border)] text-[var(--muted)]"
                              title="Source day"
                            >
                              ·
                            </div>
                          ) : (
                            <button
                              onClick={() => toggle(weekNum, d)}
                              className={`w-full rounded py-1 transition-colors ${
                                isOn
                                  ? "bg-[var(--foreground)] text-[var(--background)]"
                                  : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                              }`}
                            >
                              {isOn ? "✓" : ""}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 pt-3 border-t border-[var(--border)] shrink-0">
          <span className="text-sm text-[var(--muted)]">
            {count === 0 ? "No days selected" : `${count} day${count === 1 ? "" : "s"} selected`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={count === 0 || isPending}
              className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {isPending ? "Copying…" : `Copy to ${count} day${count === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
