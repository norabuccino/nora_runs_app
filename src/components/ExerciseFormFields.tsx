"use client";

import { useState } from "react";
import { LoadFormatGuide, LoadingCategoryGuide } from "@/components/LoadFormatGuide";
import type { ExerciseFormData } from "@/lib/exerciseForm";
import { EXERCISE_TYPE_LABELS, LOADING_CATEGORY_LABELS, LOAD_FORMAT_LABELS } from "@/lib/paceUtils";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, sortMuscleGroups, toggleMuscleGroup } from "@/lib/muscleGroups";
import { EQUIPMENT, EQUIPMENT_LABELS, sortEquipment, toggleEquipment } from "@/lib/equipment";
import { suggestExerciseTags } from "@/lib/exerciseTagSuggestions";
import { SourcesInput } from "@/components/SourcesInput";
import { BandColorsLink } from "@/components/BandColorsModal";

const inputClass = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const labelClass = "text-xs text-[var(--muted)]";

/** "Suggested from name: + Dumbbells + Box / step · Add all" under a tag picker. */
function NameSuggestions({
  keys,
  labels,
  source,
  onAdd,
}: {
  keys: string[];
  labels: Record<string, string>;
  source: string;
  onAdd: (keys: string[]) => void;
}) {
  if (keys.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
      <span className="text-xs text-[var(--muted)]">Suggested from {source}:</span>
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onAdd([k])}
          className="px-2 py-0.5 rounded-full border border-dashed border-[var(--accent)] text-xs text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
        >
          + {labels[k]}
        </button>
      ))}
      {keys.length > 1 && (
        <button type="button" onClick={() => onAdd(keys)} className="text-xs text-[var(--accent)] hover:underline">
          Add all
        </button>
      )}
    </div>
  );
}

interface ExerciseFormFieldsProps {
  value: ExerciseFormData;
  onChange: (value: ExerciseFormData) => void;
  sourceSuggestions: string[];
  autoFocusName?: boolean;
  /** False for a one-off exercise that only lives in this workout: just name, description and video. */
  libraryFields?: boolean;
}

/** Every editable field of a library exercise — used by the Exercises page modal and the exercise picker's "Create new" tab. */
export function ExerciseFormFields({ value, onChange, sourceSuggestions, autoFocusName = true, libraryFields = true }: ExerciseFormFieldsProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [categoryGuideOpen, setCategoryGuideOpen] = useState(false);
  // Offered from the name (and description, for equipment) only — the user adds them; never applied on their own.
  const suggested = suggestExerciseTags(value.name, value.description);
  const set = (update: (prev: ExerciseFormData) => ExerciseFormData) => onChange(update(value));

  return (
    <>
      {libraryFields && (
        <>
          <div className="space-y-1">
            <label className={labelClass}>Type</label>
            <select
              value={value.exercise_type}
              onChange={(e) => set((p) => ({ ...p, exercise_type: e.target.value }))}
              className={inputClass}
            >
              <option value="">— Select type —</option>
              {Object.entries(EXERCISE_TYPE_LABELS).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="space-y-1">
        <label className={labelClass}>Name</label>
        <input
          type="text"
          value={value.name}
          onChange={(e) => set((p) => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Barbell Squat"
          className={inputClass}
          autoFocus={autoFocusName}
        />
      </div>

      <div className="space-y-1">
        <label className={labelClass}>Description <span className="text-[var(--muted)]">(optional)</span></label>
        <textarea
          value={value.description}
          onChange={(e) => set((p) => ({ ...p, description: e.target.value }))}
          rows={8}
          placeholder="Cues, muscles targeted, coaching notes…"
          className={`${inputClass} resize-y`}
        />
      </div>

      {libraryFields && (
        <>
          <div className="space-y-1">
            <label className={labelClass}>Muscle groups <span className="text-[var(--muted)]">(optional — pick any that apply)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLE_GROUPS.map((g) => {
                const on = value.muscle_groups.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set((p) => ({ ...p, muscle_groups: toggleMuscleGroup(p.muscle_groups, g) }))}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      on
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
                    }`}
                  >
                    {MUSCLE_GROUP_LABELS[g]}
                  </button>
                );
              })}
            </div>
            <NameSuggestions
              keys={suggested.muscle_groups.filter((g) => !value.muscle_groups.includes(g))}
              labels={MUSCLE_GROUP_LABELS}
              source="name"
              onAdd={(keys) => set((p) => ({ ...p, muscle_groups: sortMuscleGroups([...p.muscle_groups, ...keys]) }))}
            />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Equipment <span className="text-[var(--muted)]">(optional — pick any that apply)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT.map((g) => {
                const on = value.equipment.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set((p) => ({ ...p, equipment: toggleEquipment(p.equipment, g) }))}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      on
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
                    }`}
                  >
                    {EQUIPMENT_LABELS[g]}
                  </button>
                );
              })}
            </div>
            <NameSuggestions
              keys={suggested.equipment.filter((g) => !value.equipment.includes(g))}
              labels={EQUIPMENT_LABELS}
              source="name & description"
              onAdd={(keys) => set((p) => ({ ...p, equipment: sortEquipment([...p.equipment, ...keys]) }))}
            />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Sources <span className="text-[var(--muted)]">(optional — press Enter to add each)</span></label>
            <SourcesInput
              value={value.sources}
              onChange={(sources) => set((p) => ({ ...p, sources }))}
              suggestions={sourceSuggestions}
              placeholder="e.g. Coach, Book, YouTube…"
            />
          </div>
        </>
      )}

      <div className="space-y-1">
        <label className={labelClass}>Video URL <span className="text-[var(--muted)]">(optional)</span></label>
        <input
          type="url"
          value={value.video_url}
          onChange={(e) => set((p) => ({ ...p, video_url: e.target.value }))}
          placeholder="https://youtube.com/..."
          className={inputClass}
        />
      </div>

      {libraryFields && (
        <>
          <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
            <input
              type="checkbox"
              checked={value.is_private}
              onChange={(e) => set((p) => ({ ...p, is_private: e.target.checked }))}
              className="w-4 h-4 accent-[var(--accent)]"
            />
            <span className="text-sm">Private — only visible to you</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
            <input
              type="checkbox"
              checked={value.track_load}
              onChange={(e) => set((p) => ({ ...p, track_load: e.target.checked }))}
              className="w-4 h-4 accent-[var(--accent)]"
            />
            <span className="text-sm">Track load — log weight/reps and show up in Strength Progression</span>
          </label>

          {value.track_load && (
            <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
              <div className="space-y-1">
                <label className={labelClass}>Loading category <span className="text-[var(--muted)]">(optional)</span></label>
                <select
                  value={value.loading_category}
                  onChange={(e) => set((p) => ({ ...p, loading_category: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">— None —</option>
                  {Object.entries(LOADING_CATEGORY_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
                <p className="text-xs text-[var(--muted)]">
                  The movement pattern — groups the exercise on Progression.{" "}
                  <button
                    type="button"
                    onClick={() => setCategoryGuideOpen((o) => !o)}
                    className="text-[var(--accent)] hover:underline"
                  >
                    {categoryGuideOpen ? "Hide guide" : "Which one?"}
                  </button>
                </p>
                {categoryGuideOpen && <LoadingCategoryGuide compact />}
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Load format</label>
                <select
                  value={value.load_format}
                  onChange={(e) => set((p) => ({ ...p, load_format: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">— Select format —</option>
                  {Object.entries(LOAD_FORMAT_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
                <p className="text-xs text-[var(--muted)]">
                  How to interpret a logged number — e.g. per hand so &quot;15&quot; means 15 lb/hand, not 15 lb total.{" "}
                  <button
                    type="button"
                    onClick={() => setGuideOpen((o) => !o)}
                    className="text-[var(--accent)] hover:underline"
                  >
                    {guideOpen ? "Hide guide" : "Which one?"}
                  </button>
                </p>
                {value.load_format === "band" && (
                  <p className="text-xs">
                    <BandColorsLink />
                  </p>
                )}
                {guideOpen && <LoadFormatGuide compact />}
              </div>

              {/* Bands step up one level at a time, so there's no increment to set. */}
              {value.load_format !== "band" && (
              <div className="space-y-1">
                <label className={labelClass}>Default increment <span className="text-[var(--muted)]">(optional)</span></label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={value.default_increment}
                  onChange={(e) => set((p) => ({ ...p, default_increment: e.target.value }))}
                  placeholder="e.g. 2.5"
                  className={inputClass}
                />
              </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
