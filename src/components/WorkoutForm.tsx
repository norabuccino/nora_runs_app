"use client";

import { useState } from "react";
import type { WorkoutType, PaceType, RunType, WorkoutWithSteps } from "@/types/database";
import { DAY_NAMES, STEP_TYPE_LABELS } from "@/lib/paceUtils";

interface WorkoutFormProps {
  planId: string;
  weekNumber: number;
  dayOfWeek: number;
  existing?: WorkoutWithSteps | null;
  onSave: (data: WorkoutFormData) => Promise<void>;
  onCancel: () => void;
}

export interface WorkoutStepFormRow {
  step_type: string;
  label: string;
  pace_type: string;
  duration_minutes: string;
  distance_miles: string;
  notes: string;
}

export interface WorkoutFormData {
  plan_id: string;
  week_number: number;
  day_of_week: number;
  type: WorkoutType;
  run_type: RunType | "";
  title: string;
  description: string;
  distance_miles: string;
  pace_type: PaceType | "";
  duration_minutes: string;
  notes: string;
  sort_order: number;
  steps: WorkoutStepFormRow[];
}

function blankStep(): WorkoutStepFormRow {
  return { step_type: "main", label: "", pace_type: "", duration_minutes: "", distance_miles: "", notes: "" };
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
    run_type: existing?.run_type ?? "",
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    distance_miles: existing?.distance_miles?.toString() ?? "",
    pace_type: existing?.pace_type ?? "",
    duration_minutes: existing?.duration_minutes?.toString() ?? "",
    notes: existing?.notes ?? "",
    sort_order: existing?.sort_order ?? 0,
    steps: existing?.workout_steps?.map((s) => ({
      step_type: s.step_type,
      label: s.label ?? "",
      pace_type: s.pace_type ?? "",
      duration_minutes: s.duration_minutes?.toString() ?? "",
      distance_miles: s.distance_miles?.toString() ?? "",
      notes: s.notes ?? "",
    })) ?? [],
  });

  function update<K extends keyof WorkoutFormData>(key: K, value: WorkoutFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateStep(index: number, key: keyof WorkoutStepFormRow, value: string) {
    setForm((prev) => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], [key]: value };
      return { ...prev, steps };
    });
  }

  function addStep() {
    setForm((prev) => ({ ...prev, steps: [...prev.steps, blankStep()] }));
  }

  function removeStep(index: number) {
    setForm((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
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
  const inputClass = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
  const labelClass = "text-xs text-[var(--muted)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90vh]">
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
            {/* Type */}
            <div className="space-y-1">
              <label className={labelClass}>Type</label>
              <select
                value={form.type}
                onChange={(e) => {
                  update("type", e.target.value as WorkoutType);
                  if (e.target.value !== "run") update("run_type", "");
                }}
                className={inputClass}
              >
                <option value="run">Run</option>
                <option value="strength">Strength</option>
                <option value="cross_train">Cross-Train</option>
                <option value="rest">Rest</option>
              </select>
            </div>

            {/* Run type — only when type is run */}
            {isRun && (
              <div className="space-y-1">
                <label className={labelClass}>Run type</label>
                <select
                  value={form.run_type}
                  onChange={(e) => update("run_type", e.target.value as RunType | "")}
                  className={inputClass}
                >
                  <option value="">— Select —</option>
                  <option value="easy_run">Easy Run</option>
                  <option value="tempo_run">Tempo Run</option>
                  <option value="interval_run">Interval Run</option>
                  <option value="threshold_run">Threshold Run</option>
                  <option value="recovery_run">Recovery Run</option>
                  <option value="race">Race</option>
                  <option value="long_run">Long Run</option>
                </select>
              </div>
            )}

            {/* Title */}
            <div className="space-y-1">
              <label className={labelClass}>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder={isRun ? "e.g. Easy run" : "e.g. Upper body strength"}
                className={inputClass}
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className={labelClass}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Distance + pace (runs only) */}
            {isRun && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={labelClass}>Distance (miles)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.distance_miles}
                    onChange={(e) => update("distance_miles", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Pace type</label>
                  <select
                    value={form.pace_type}
                    onChange={(e) => update("pace_type", e.target.value as PaceType | "")}
                    className={inputClass}
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

            {/* Duration */}
            <div className="space-y-1">
              <label className={labelClass}>
                {isRun ? "Estimated duration (min, optional)" : "Duration (min)"}
              </label>
              <input
                type="number"
                min="0"
                value={form.duration_minutes}
                onChange={(e) => update("duration_minutes", e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className={labelClass}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                  Steps
                </span>
                <button
                  type="button"
                  onClick={addStep}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  + Add step
                </button>
              </div>

              {form.steps.length === 0 && (
                <p className="text-xs text-[var(--muted)] italic">
                  No steps yet. Add steps to structure this workout (warm-up, intervals, cool-down, etc.).
                </p>
              )}

              {form.steps.map((step, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[var(--border)] p-3 space-y-2 bg-[var(--card)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Step {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeStep(i)}
                      className="text-xs text-[var(--muted)] hover:text-red-500"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className={labelClass}>Step type</label>
                      <select
                        value={step.step_type}
                        onChange={(e) => updateStep(i, "step_type", e.target.value)}
                        className={inputClass}
                      >
                        {Object.entries(STEP_TYPE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={labelClass}>Label (optional)</label>
                      <input
                        type="text"
                        value={step.label}
                        onChange={(e) => updateStep(i, "label", e.target.value)}
                        placeholder="e.g. 4×1 mile"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className={labelClass}>Pace</label>
                      <select
                        value={step.pace_type}
                        onChange={(e) => updateStep(i, "pace_type", e.target.value)}
                        className={inputClass}
                      >
                        <option value="">None</option>
                        <option value="easy">Easy</option>
                        <option value="tempo">Tempo</option>
                        <option value="threshold">Threshold</option>
                        <option value="race">Race</option>
                        <option value="interval">Interval</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={labelClass}>Duration (min)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={step.duration_minutes}
                        onChange={(e) => updateStep(i, "duration_minutes", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={labelClass}>Distance (mi)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={step.distance_miles}
                        onChange={(e) => updateStep(i, "distance_miles", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className={labelClass}>Notes</label>
                    <input
                      type="text"
                      value={step.notes}
                      onChange={(e) => updateStep(i, "notes", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              ))}
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
