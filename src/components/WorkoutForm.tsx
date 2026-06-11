"use client";

import { useState } from "react";
import type { PlanWorkout, WorkoutType, PaceType } from "@/types/database";
import { DAY_NAMES } from "@/lib/paceUtils";

interface WorkoutFormProps {
  planId: string;
  weekNumber: number;
  dayOfWeek: number;
  existing?: PlanWorkout | null;
  onSave: (data: WorkoutFormData) => Promise<void>;
  onCancel: () => void;
}

export interface WorkoutFormData {
  plan_id: string;
  week_number: number;
  day_of_week: number;
  type: WorkoutType;
  title: string;
  description: string;
  distance_miles: string;
  pace_type: PaceType | "";
  duration_minutes: string;
  notes: string;
  sort_order: number;
}

export function WorkoutForm({
  planId,
  weekNumber,
  dayOfWeek,
  existing,
  onSave,
  onCancel,
}: WorkoutFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<WorkoutFormData>({
    plan_id: planId,
    week_number: weekNumber,
    day_of_week: dayOfWeek,
    type: existing?.type ?? "run",
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    distance_miles: existing?.distance_miles?.toString() ?? "",
    pace_type: existing?.pace_type ?? "",
    duration_minutes: existing?.duration_minutes?.toString() ?? "",
    notes: existing?.notes ?? "",
    sort_order: existing?.sort_order ?? 0,
  });

  function update<K extends keyof WorkoutFormData>(key: K, value: WorkoutFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  const isRun = form.type === "run";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              {existing ? "Edit" : "Add"} workout — Wk {weekNumber}, {DAY_NAMES[dayOfWeek]}
            </h2>
            <button
              onClick={onCancel}
              className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-[var(--muted)]">Type</label>
              <select
                value={form.type}
                onChange={(e) => update("type", e.target.value as WorkoutType)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="run">Run</option>
                <option value="strength">Strength</option>
                <option value="cross_train">Cross-Train</option>
                <option value="rest">Rest</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[var(--muted)]">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder={isRun ? "e.g. Easy run" : "e.g. Upper body strength"}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[var(--muted)]">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
              />
            </div>

            {isRun && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-[var(--muted)]">Distance (miles)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.distance_miles}
                    onChange={(e) => update("distance_miles", e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[var(--muted)]">Pace type</label>
                  <select
                    value={form.pace_type}
                    onChange={(e) => update("pace_type", e.target.value as PaceType | "")}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    <option value="">None</option>
                    <option value="easy">Easy</option>
                    <option value="tempo">Tempo</option>
                    <option value="threshold">Threshold</option>
                    <option value="race">Race</option>
                    <option value="interval">Interval</option>
                  </select>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-[var(--muted)]">
                {isRun ? "Estimated duration (min, optional)" : "Duration (min)"}
              </label>
              <input
                type="number"
                min="0"
                value={form.duration_minutes}
                onChange={(e) => update("duration_minutes", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[var(--muted)]">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
              />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? "Saving…" : existing ? "Save changes" : "Add workout"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-4 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
