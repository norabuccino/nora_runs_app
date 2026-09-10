"use client";

import { useEffect, useState } from "react";
import { getProgressionDashboard, type ProgressionRow } from "@/app/actions/strengthSessions";
import { EXERCISE_TYPE_LABELS, LOADING_CATEGORY_LABELS } from "@/lib/paceUtils";
import { formatLoad, deriveCurrentLoad, computeTrend, computeRecommendation } from "@/lib/strengthProgression";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import type { Exercise } from "@/types/database";

const RECOMMENDATION_LABELS: Record<string, string> = {
  hold: "Hold",
  increase: "Increase",
  build_reps: "Build reps",
  none: "—",
};

const TREND_ICONS: Record<string, string> = { up: "↑", down: "↓", same: "→" };
const TREND_COLORS: Record<string, string> = {
  up: "text-green-600 dark:text-green-400",
  down: "text-red-500 dark:text-red-400",
  same: "text-[var(--muted)]",
};

const selectClass =
  "rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

function actualLabel(sets: { reps_completed: number | null; duration_seconds: number | null }[]): string | null {
  const parts = sets
    .map((s) => (s.reps_completed != null ? String(s.reps_completed) : s.duration_seconds != null ? `${s.duration_seconds}s` : null))
    .filter((v): v is string => v != null);
  return parts.length > 0 ? parts.join(" / ") : null;
}

export default function ProgressionPage() {
  const [rows, setRows] = useState<ProgressionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [detail, setDetail] = useState<Exercise | null>(null);

  function load() {
    getProgressionDashboard().then((data) => {
      setRows(data);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  const availableSources = Array.from(new Set(rows.map((r) => r.exercise.source).filter(Boolean))) as string[];
  const availableCategories = Array.from(new Set(rows.map((r) => r.exercise.loading_category).filter(Boolean))) as string[];
  const availableTypes = Array.from(new Set(rows.map((r) => r.exercise.exercise_type).filter(Boolean))) as string[];

  const displayed = rows.filter((r) => {
    if (categoryFilter !== "all" && r.exercise.loading_category !== categoryFilter) return false;
    if (typeFilter !== "all" && r.exercise.exercise_type !== typeFilter) return false;
    if (sourceFilter !== "all" && r.exercise.source !== sourceFilter) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Strength Progression</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Derived from your completed workouts — what you&apos;re using now, and how it&apos;s trending.
        </p>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {!loading && rows.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <p className="text-[var(--muted)]">No tracked strength history yet.</p>
          <p className="text-sm text-[var(--muted)]">
            Turn on &quot;Track load&quot; for an exercise in your Exercise Library, then log a workout session to see it here.
          </p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
              <option value="all">All categories</option>
              {availableCategories.map((val) => (
                <option key={val} value={val}>{LOADING_CATEGORY_LABELS[val] ?? val}</option>
              ))}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectClass}>
              <option value="all">All exercise types</option>
              {availableTypes.map((val) => (
                <option key={val} value={val}>{EXERCISE_TYPE_LABELS[val] ?? val}</option>
              ))}
            </select>
            {availableSources.length > 0 && (
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={selectClass}>
                <option value="all">All sources</option>
                {availableSources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--card)] text-[var(--muted)] text-xs uppercase tracking-wide">
                  <th className="px-3 py-2 text-left font-medium">Exercise</th>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-left font-medium">Current load</th>
                  <th className="px-3 py-2 text-left font-medium">Last performance</th>
                  <th className="px-3 py-2 text-left font-medium">Previous load</th>
                  <th className="px-3 py-2 text-left font-medium">Trend</th>
                  <th className="px-3 py-2 text-left font-medium">Suggestion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {displayed.map((row) => {
                  const currentLoad = deriveCurrentLoad(row.latest?.sets ?? null);
                  const previousLoad = deriveCurrentLoad(row.previous?.sets ?? null);
                  const trend = computeTrend(currentLoad, previousLoad);
                  const currentLoadLabel = currentLoad != null ? formatLoad(currentLoad, row.latest?.loadFormat ?? null) : null;
                  const previousLoadLabel = previousLoad != null ? formatLoad(previousLoad, row.previous?.loadFormat ?? null) : null;
                  const actual = row.latest ? actualLabel(row.latest.sets) : null;
                  const rec = row.latest
                    ? computeRecommendation({
                        plannedReps: row.latest.plannedReps,
                        plannedDurationSeconds: row.latest.plannedDurationSeconds,
                        sets: row.latest.sets,
                        currentWeight: currentLoad,
                        previousWeight: previousLoad,
                        defaultIncrement: row.exercise.default_increment,
                      })
                    : { status: "none" as const };
                  const suggestion =
                    rec.status === "increase" && rec.suggestedWeight != null
                      ? `Increase to ${formatLoad(rec.suggestedWeight, row.latest?.loadFormat ?? null)}`
                      : RECOMMENDATION_LABELS[rec.status];

                  return (
                    <tr
                      key={row.exercise.id}
                      onClick={() => setDetail(row.exercise)}
                      className="cursor-pointer hover:bg-[var(--card)] transition-colors"
                    >
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{row.exercise.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-[var(--muted)]">
                        {row.exercise.loading_category ? LOADING_CATEGORY_LABELS[row.exercise.loading_category] ?? row.exercise.loading_category : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium">{currentLoadLabel ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-[var(--muted)]">{actual ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-[var(--muted)]">{previousLoadLabel ?? "—"}</td>
                      <td className={`px-3 py-2 whitespace-nowrap font-medium ${trend ? TREND_COLORS[trend] : "text-[var(--muted)]"}`}>
                        {trend ? TREND_ICONS[trend] : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-[var(--muted)]">{suggestion}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail && (
        <ExerciseDetailModal
          exercise={detail}
          onClose={() => { setDetail(null); load(); }}
        />
      )}
    </div>
  );
}
