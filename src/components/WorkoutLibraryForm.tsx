"use client";

import { useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { WorkoutType, RunType, LibraryWorkoutWithSteps, RunningPace } from "@/types/database";
import { type DistanceUnit, convertDistance, getStoredUnit } from "@/lib/unitUtils";
import { createPace } from "@/app/actions/paces";
import {
  buildSegments,
  SortableStepCard,
  SortableGroupContainer,
  computeStepDistanceMi,
  computeStepDurationMin,
  type WorkoutStepFormRow,
  type StringStepKey,
} from "./WorkoutForm";

interface WorkoutLibraryFormProps {
  existing?: LibraryWorkoutWithSteps | null;
  allWorkouts?: LibraryWorkoutWithSteps[];
  paces?: RunningPace[];
  onSave: (data: WorkoutLibraryFormData) => Promise<void>;
  onCancel: () => void;
}

export interface WorkoutLibraryFormData {
  type: WorkoutType;
  run_type: RunType | "";
  title: string;
  description: string;
  distance_miles: string;
  distance_unit: "mi" | "km";
  pace_type: string;
  duration_minutes: string;
  notes: string;
  source: string;
  steps: WorkoutStepFormRow[];
}

function blankStep(
  groupId: number | null = null,
  repeatCount = 1,
  unit: DistanceUnit = getStoredUnit()
): WorkoutStepFormRow {
  return {
    step_type: "main",
    label: "",
    pace_type: "",
    duration_minutes: "",
    duration_unit: "min",
    distance_miles: "",
    distance_unit: unit,
    notes: "",
    repeat_group_id: groupId,
    repeat_count: repeatCount,
  };
}

function UnitToggle({
  units,
  active,
  onChange,
}: {
  units: ("mi" | "km")[];
  active: "mi" | "km";
  onChange: (u: "mi" | "km") => void;
}) {
  return (
    <div className="flex rounded border border-[var(--border)] overflow-hidden shrink-0" style={{ fontSize: "10px" }}>
      {units.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className={`px-1.5 py-0.5 leading-none transition-colors ${
            active === u
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "bg-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

function segmentId(seg: ReturnType<typeof buildSegments>[number]): string {
  return seg.type === "step" ? `step-${seg.index}` : `group-${seg.groupId}`;
}

export function WorkoutLibraryForm({ existing, allWorkouts, paces = [], onSave, onCancel }: WorkoutLibraryFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPaces, setLocalPaces] = useState<RunningPace[]>(paces);

  const [form, setForm] = useState<WorkoutLibraryFormData>(() => ({
    type: existing?.type ?? "run",
    run_type: existing?.run_type ?? "",
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    distance_miles: existing?.distance_miles?.toString() ?? "",
    distance_unit: (existing?.distance_unit as "mi" | "km") ?? getStoredUnit(),
    pace_type: existing?.pace_type ?? "",
    duration_minutes: existing?.duration_minutes?.toString() ?? "",
    notes: existing?.notes ?? "",
    source: existing?.source ?? "",
    steps:
      existing?.workout_steps?.map((s) => ({
        step_type: s.step_type,
        label: s.label ?? "",
        pace_type: s.pace_type ?? "",
        duration_minutes: s.duration_minutes?.toString() ?? "",
        duration_unit: "min" as const,
        distance_miles: s.distance_miles?.toString() ?? "",
        distance_unit: (s.distance_unit as DistanceUnit) ?? "mi",
        notes: s.notes ?? "",
        repeat_group_id: s.repeat_group_id ?? null,
        repeat_count: s.repeat_count ?? 1,
      })) ?? [blankStep()],
  }));

  function updateStep(index: number, key: StringStepKey, value: string) {
    setForm((prev) => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], [key]: value };
      return { ...prev, steps };
    });
  }

  function switchStepUnit(index: number, newUnit: DistanceUnit) {
    setForm((prev) => {
      const steps = [...prev.steps];
      const cur = steps[index];
      const raw = parseFloat(cur.distance_miles);
      const converted =
        !isNaN(raw) && raw > 0
          ? String(parseFloat(convertDistance(raw, cur.distance_unit, newUnit).toFixed(4)))
          : cur.distance_miles;
      steps[index] = { ...cur, distance_unit: newUnit, distance_miles: converted };
      return { ...prev, steps };
    });
  }

  function switchStepDurationUnit(index: number, newUnit: "min" | "sec") {
    setForm((prev) => {
      const steps = [...prev.steps];
      const cur = steps[index];
      const raw = parseFloat(cur.duration_minutes);
      let converted = cur.duration_minutes;
      if (!isNaN(raw) && raw > 0) {
        if (cur.duration_unit === "min" && newUnit === "sec") {
          converted = String(Math.round(raw * 60));
        } else if (cur.duration_unit === "sec" && newUnit === "min") {
          converted = String(parseFloat((raw / 60).toFixed(2)));
        }
      }
      steps[index] = { ...cur, duration_unit: newUnit, duration_minutes: converted };
      return { ...prev, steps };
    });
  }

  function addStep() {
    setForm((prev) => ({
      ...prev,
      steps: [...prev.steps, blankStep(null, 1, prev.distance_unit as DistanceUnit)],
    }));
  }

  function removeStep(index: number) {
    setForm((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
  }

  function addRepeatGroup() {
    setForm((prev) => {
      const nextGroupId = Math.max(0, ...prev.steps.map((s) => s.repeat_group_id ?? 0)) + 1;
      const unit = prev.distance_unit as DistanceUnit;
      return {
        ...prev,
        steps: [
          ...prev.steps,
          blankStep(nextGroupId, 2, unit),
          { ...blankStep(nextGroupId, 2, unit), step_type: "recovery" },
        ],
      };
    });
  }

  function addStepToGroup(groupId: number) {
    setForm((prev) => {
      const steps = [...prev.steps];
      let lastIdx = -1;
      for (let i = 0; i < steps.length; i++) {
        if (steps[i].repeat_group_id === groupId) lastIdx = i;
      }
      const rc = lastIdx >= 0 ? steps[lastIdx].repeat_count : 2;
      const unit = lastIdx >= 0 ? steps[lastIdx].distance_unit : (prev.distance_unit as DistanceUnit);
      steps.splice(lastIdx + 1, 0, blankStep(groupId, rc, unit));
      return { ...prev, steps };
    });
  }

  function updateGroupRepeatCount(groupId: number, count: number) {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.repeat_group_id === groupId ? { ...s, repeat_count: count } : s
      ),
    }));
  }

  function ungroup(groupId: number) {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.repeat_group_id === groupId ? { ...s, repeat_group_id: null, repeat_count: 1 } : s
      ),
    }));
  }

  async function handleCreatePace(name: string, secondsPerMile: number): Promise<RunningPace> {
    const created = await createPace(name, secondsPerMile);
    setLocalPaces((prev) => [...prev, created]);
    return created;
  }

  function switchWorkoutUnit(newUnit: "mi" | "km") {
    setForm((prev) => {
      const raw = parseFloat(prev.distance_miles);
      const converted =
        !isNaN(raw) && raw > 0
          ? String(parseFloat(convertDistance(raw, prev.distance_unit, newUnit).toFixed(4)))
          : prev.distance_miles;
      return { ...prev, distance_unit: newUnit, distance_miles: converted };
    });
  }

  const outerSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function onSegmentDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const segs = buildSegments(form.steps);
    const oldIdx = segs.findIndex((s) => segmentId(s) === active.id);
    const newIdx = segs.findIndex((s) => segmentId(s) === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(segs, oldIdx, newIdx);
    const newSteps: WorkoutStepFormRow[] = [];
    for (const seg of reordered) {
      if (seg.type === "step") newSteps.push(form.steps[seg.index]);
      else seg.indices.forEach((i) => newSteps.push(form.steps[i]));
    }
    setForm((prev) => ({ ...prev, steps: newSteps }));
  }

  function onGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeIdx = parseInt((active.id as string).split("-")[1]);
    const overIdx = parseInt((over.id as string).split("-")[1]);
    if (isNaN(activeIdx) || isNaN(overIdx)) return;
    setForm((prev) => ({ ...prev, steps: arrayMove(prev.steps, activeIdx, overIdx) }));
  }

  const { totalDistInUnit, totalDurationMin } = (() => {
    const segs = buildSegments(form.steps);
    let distMiSum = 0;
    let durSum = 0;
    for (const seg of segs) {
      if (seg.type === "step") {
        distMiSum += computeStepDistanceMi(form.steps[seg.index], localPaces);
        durSum += computeStepDurationMin(form.steps[seg.index], localPaces);
      } else {
        let groupDistMi = 0;
        let groupDur = 0;
        seg.indices.forEach((i) => {
          groupDistMi += computeStepDistanceMi(form.steps[i], localPaces);
          groupDur += computeStepDurationMin(form.steps[i], localPaces);
        });
        distMiSum += groupDistMi * seg.repeatCount;
        durSum += groupDur * seg.repeatCount;
      }
    }
    return {
      totalDistInUnit: convertDistance(distMiSum, "mi", form.distance_unit as DistanceUnit),
      totalDurationMin: durSum,
    };
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }

    const titleConflict = allWorkouts?.find(
      (w) => w.id !== existing?.id &&
      w.title.trim().toLowerCase() === form.title.trim().toLowerCase()
    );
    if (titleConflict) {
      setError(`A workout named "${titleConflict.title}" already exists. Please choose a different title.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        distance_miles:
          totalDistInUnit > 0
            ? String(parseFloat(totalDistInUnit.toFixed(4)))
            : form.distance_miles,
        duration_minutes:
          totalDurationMin > 0 ? String(totalDurationMin) : form.duration_minutes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  const isRun = form.type === "run";
  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
  const labelClass = "text-xs text-[var(--muted)]";
  const segments = buildSegments(form.steps);
  const segmentIds = segments.map(segmentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{existing ? "Edit" : "New"} workout</h2>
            <button
              onClick={onCancel}
              className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className={labelClass}>Type</label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    type: e.target.value as WorkoutType,
                    run_type: e.target.value !== "run" ? "" : p.run_type,
                  }))
                }
                className={inputClass}
              >
                <option value="run">Run</option>
                <option value="strength">Strength</option>
                <option value="bike">Bike</option>
                <option value="swim">Swim</option>
                <option value="yoga">Yoga</option>
                <option value="elliptical">Elliptical</option>
                <option value="cross_train">Cross-Train</option>
                <option value="rest">Rest</option>
              </select>
            </div>

            {isRun && (
              <div className="space-y-1">
                <label className={labelClass}>Run type</label>
                <select
                  value={form.run_type}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, run_type: e.target.value as RunType | "" }))
                  }
                  className={inputClass}
                >
                  <option value="">— Select —</option>
                  <option value="easy_run">Easy Run</option>
                  <option value="interval_run">Interval Run</option>
                  <option value="threshold_run">Threshold Run</option>
                  <option value="recovery_run">Recovery Run</option>
                  <option value="race">Race</option>
                  <option value="long_run">Long Run</option>
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className={labelClass}>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder={isRun ? "e.g. Easy 6 miles" : "e.g. Upper body strength"}
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Source <span className="text-[var(--muted)]">(optional — coach, book, etc.)</span></label>
              <input
                type="text"
                value={form.source}
                onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
                placeholder="e.g. Jack Daniels, coach Sarah"
                className={inputClass}
              />
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                Steps
              </span>

              {form.steps.length === 0 && (
                <p className="text-xs text-[var(--muted)] italic">
                  No steps yet. Add steps to structure this workout (warm-up, intervals,
                  cool-down, etc.).
                </p>
              )}

              <DndContext
                sensors={outerSensors}
                collisionDetection={closestCenter}
                onDragEnd={onSegmentDragEnd}
              >
                <SortableContext items={segmentIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {segments.map((seg, si) => {
                      if (seg.type === "step") {
                        return (
                          <SortableStepCard
                            key={`step-${seg.index}`}
                            id={`step-${seg.index}`}
                            step={form.steps[seg.index]}
                            actualIndex={seg.index}
                            label={`Step ${si + 1}`}
                            paces={localPaces}
                            onRemove={removeStep}
                            onUpdate={updateStep}
                            onSwitchUnit={switchStepUnit}
                            onSwitchDurationUnit={switchStepDurationUnit}
                            onCreatePace={handleCreatePace}
                            inputClass={inputClass}
                            labelClass={labelClass}
                          />
                        );
                      }
                      return (
                        <SortableGroupContainer
                          key={`group-${seg.groupId}`}
                          id={`group-${seg.groupId}`}
                          groupId={seg.groupId}
                          repeatCount={seg.repeatCount}
                          indices={seg.indices}
                          steps={form.steps}
                          paces={localPaces}
                          onUpdateRepeatCount={updateGroupRepeatCount}
                          onUngroup={ungroup}
                          onAddStepToGroup={addStepToGroup}
                          onGroupDragEnd={onGroupDragEnd}
                          onRemove={removeStep}
                          onUpdate={updateStep}
                          onSwitchUnit={switchStepUnit}
                          onSwitchDurationUnit={switchStepDurationUnit}
                          onCreatePace={handleCreatePace}
                          inputClass={inputClass}
                          labelClass={labelClass}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={addStep}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  + Add step
                </button>
                <button
                  type="button"
                  onClick={addRepeatGroup}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  + Add repeats
                </button>
              </div>
            </div>

            {/* Totals (calculated from steps) + pace type */}
            {(totalDistInUnit > 0 || totalDurationMin > 0 || isRun) && (
              <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                {(totalDistInUnit > 0 || totalDurationMin > 0) && (
                  <div className="flex flex-wrap gap-4">
                    {totalDistInUnit > 0 && (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={labelClass}>Total distance</span>
                          <UnitToggle
                            units={["mi", "km"]}
                            active={form.distance_unit}
                            onChange={(u) =>
                              setForm((p) => ({ ...p, distance_unit: u as "mi" | "km" }))
                            }
                          />
                        </div>
                        <p className="text-sm font-medium">
                          {parseFloat(totalDistInUnit.toFixed(2))} {form.distance_unit}
                        </p>
                      </div>
                    )}
                    {totalDurationMin > 0 && (
                      <div className="space-y-0.5">
                        <span className={labelClass}>Total duration</span>
                        <p className="text-sm font-medium">{Math.round(totalDurationMin)} min</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <label className={labelClass}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? "Saving…" : existing ? "Save changes" : "Add to library"}
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
