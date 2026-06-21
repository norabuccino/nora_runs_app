"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Exercise } from "@/types/database";
import { createExercise, updateExercise, deleteExercise } from "@/app/actions/exercises";
import { EXERCISE_TYPE_LABELS, EXERCISE_TYPE_COLORS } from "@/lib/paceUtils";

interface ExerciseFormData {
  name: string;
  description: string;
  video_url: string;
  exercise_type: string;
}

const EMPTY_FORM: ExerciseFormData = { name: "", description: "", video_url: "", exercise_type: "" };

const inputClass = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const labelClass = "text-xs text-[var(--muted)]";

function ExerciseForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial: ExerciseFormData;
  onSave: (data: ExerciseFormData) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState(initial);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className={labelClass}>Type</label>
        <select
          value={form.exercise_type}
          onChange={(e) => setForm((p) => ({ ...p, exercise_type: e.target.value }))}
          className={inputClass}
        >
          <option value="">— Select type —</option>
          {Object.entries(EXERCISE_TYPE_LABELS).map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className={labelClass}>Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Barbell Squat"
          className={inputClass}
          autoFocus
        />
      </div>
      <div className="space-y-1">
        <label className={labelClass}>Description <span className="text-[var(--muted)]">(optional)</span></label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          rows={2}
          placeholder="Cues, muscles targeted, coaching notes…"
          className={`${inputClass} resize-none`}
        />
      </div>
      <div className="space-y-1">
        <label className={labelClass}>Video URL <span className="text-[var(--muted)]">(optional)</span></label>
        <input
          type="url"
          value={form.video_url}
          onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))}
          placeholder="https://youtube.com/..."
          className={inputClass}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
          className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  ...Object.entries(EXERCISE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function load() {
    const supabase = createClient();
    const { data } = await supabase.from("exercises").select("*").order("name");
    setExercises(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const displayed = exercises.filter((e) => {
    if (typeFilter !== "all" && e.exercise_type !== typeFilter) return false;
    if (!search.trim()) return true;
    return (
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.description ?? "").toLowerCase().includes(search.toLowerCase())
    );
  });

  async function handleCreate(data: ExerciseFormData) {
    if (!data.name.trim()) { setSaveError("Name is required"); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await createExercise({
        name: data.name.trim(),
        description: data.description.trim() || null,
        video_url: data.video_url.trim() || null,
        exercise_type: data.exercise_type || null,
      });
      setCreating(false);
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(data: ExerciseFormData) {
    if (!editing || !data.name.trim()) { setSaveError("Name is required"); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await updateExercise(editing.id, {
        name: data.name.trim(),
        description: data.description.trim() || null,
        video_url: data.video_url.trim() || null,
        exercise_type: data.exercise_type || null,
      });
      setEditing(null);
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(exercise: Exercise) {
    if (!confirm(`Delete "${exercise.name}"?`)) return;
    startTransition(async () => {
      await deleteExercise(exercise.id);
      await load();
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exercise Library</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Reusable exercises you can add to any strength workout.
          </p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); setSaveError(null); }}
          disabled={creating}
          className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          + New exercise
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border border-[var(--accent)] p-4 space-y-3">
          <p className="text-sm font-medium">New exercise</p>
          <ExerciseForm
            initial={EMPTY_FORM}
            onSave={handleCreate}
            onCancel={() => { setCreating(false); setSaveError(null); }}
            saving={saving}
            error={saveError}
          />
        </div>
      )}

      {!creating && (
        <div className="space-y-2">
          <input
            type="search"
            placeholder="Search exercises…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass}
          />
          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTypeFilter(value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  typeFilter === value
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {!loading && exercises.length === 0 && !creating && (
        <div className="text-center py-16 space-y-3">
          <p className="text-[var(--muted)]">Your exercise library is empty.</p>
          <p className="text-sm text-[var(--muted)]">
            Add exercises here and reuse them across strength workouts.
          </p>
        </div>
      )}

      {!loading && exercises.length > 0 && displayed.length === 0 && (
        <p className="text-sm text-[var(--muted)]">No exercises match your filters.</p>
      )}

      <div className="space-y-2">
        {displayed.map((exercise) =>
          editing?.id === exercise.id ? (
            <div key={exercise.id} className="rounded-xl border border-[var(--accent)] p-4 space-y-3">
              <p className="text-sm font-medium">Edit exercise</p>
              <ExerciseForm
                initial={{
                  name: exercise.name,
                  description: exercise.description ?? "",
                  video_url: exercise.video_url ?? "",
                  exercise_type: exercise.exercise_type ?? "",
                }}
                onSave={handleUpdate}
                onCancel={() => { setEditing(null); setSaveError(null); }}
                saving={saving}
                error={saveError}
              />
            </div>
          ) : (
            <div key={exercise.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {exercise.exercise_type && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${EXERCISE_TYPE_COLORS[exercise.exercise_type] ?? "bg-gray-100 text-gray-600"}`}>
                      {EXERCISE_TYPE_LABELS[exercise.exercise_type] ?? exercise.exercise_type}
                    </span>
                  )}
                  <p className="font-medium text-sm">{exercise.name}</p>
                </div>
                {exercise.description && (
                  <p className="text-xs text-[var(--muted)] leading-relaxed">{exercise.description}</p>
                )}
                {exercise.video_url && (
                  <a
                    href={exercise.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-[var(--accent)] hover:underline"
                  >
                    ▶ Watch video
                  </a>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => { setEditing(exercise); setCreating(false); setSaveError(null); }}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--background)] transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(exercise)}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--muted)] hover:text-red-500 hover:border-red-300 transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
