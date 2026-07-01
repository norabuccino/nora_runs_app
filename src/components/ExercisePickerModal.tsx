"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Exercise } from "@/types/database";
import { createExercise } from "@/app/actions/exercises";
import { EXERCISE_TYPE_LABELS, EXERCISE_TYPE_COLORS } from "@/lib/paceUtils";

export interface ExercisePickResult {
  exercise_id: string;
  name: string;
  description: string;
  video_url: string;
}

interface ExercisePickerModalProps {
  onSelect: (result: ExercisePickResult) => void;
  onCancel: () => void;
}

export function ExercisePickerModal({ onSelect, onCancel }: ExercisePickerModalProps) {
  const [tab, setTab] = useState<"library" | "new">("library");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  // Create new form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newExerciseType, setNewExerciseType] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("exercises")
        .select("*")
        .order("name");
      setExercises(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const availableSources = Array.from(new Set(exercises.map((e) => e.source).filter(Boolean))) as string[];

  const displayed = exercises.filter((e) => {
    if (typeFilter !== "all" && e.exercise_type !== typeFilter) return false;
    if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
    if (!search.trim()) return true;
    return e.name.toLowerCase().includes(search.toLowerCase());
  });

  function handleSelect(exercise: Exercise) {
    onSelect({
      exercise_id: exercise.id,
      name: exercise.name,
      description: exercise.description ?? "",
      video_url: exercise.video_url ?? "",
    });
  }

  async function handleCreate() {
    if (!newName.trim()) { setCreateError("Name is required"); return; }
    setCreating(true);
    setCreateError(null);
    try {
      if (saveToLibrary) {
        const exercise = await createExercise({
          name: newName.trim(),
          description: newDescription.trim() || null,
          video_url: newVideoUrl.trim() || null,
          exercise_type: newExerciseType || null,
        });
        onSelect({
          exercise_id: exercise.id,
          name: exercise.name,
          description: exercise.description ?? "",
          video_url: exercise.video_url ?? "",
        });
      } else {
        onSelect({
          exercise_id: "",
          name: newName.trim(),
          description: newDescription.trim(),
          video_url: newVideoUrl.trim(),
        });
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create exercise");
      setCreating(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
  const typeFilters = [
    { value: "all", label: "All" },
    ...Object.entries(EXERCISE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90dvh] sm:max-h-[85vh] flex flex-col">
        <div className="p-4 space-y-3 flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between shrink-0">
            <h2 className="font-semibold">Select exercise</h2>
            <button onClick={onCancel} className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none">×</button>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 rounded-lg border border-[var(--border)] overflow-hidden shrink-0">
            {(["library", "new"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                  tab === t
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {t === "library" ? "From library" : "Create new"}
              </button>
            ))}
          </div>

          {tab === "library" && (
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <input
                type="search"
                placeholder="Search exercises…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputClass} shrink-0`}
                autoFocus
              />

              {/* Type filter pills */}
              <div className="flex flex-wrap gap-1 shrink-0">
                {typeFilters.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTypeFilter(value)}
                    className={`px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                      typeFilter === value
                        ? "bg-[var(--accent)] text-white"
                        : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Source filter pills */}
              {availableSources.length > 0 && (
                <div className="flex flex-wrap gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSourceFilter("all")}
                    className={`px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                      sourceFilter === "all"
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    All sources
                  </button>
                  {availableSources.map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setSourceFilter(src)}
                      className={`px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                        sourceFilter === src
                          ? "bg-[var(--foreground)] text-[var(--background)]"
                          : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {src}
                    </button>
                  ))}
                </div>
              )}

              <div className="overflow-y-auto flex-1 space-y-1">
                {loading && <p className="text-xs text-[var(--muted)] text-center py-4">Loading…</p>}

                {!loading && exercises.length === 0 && (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-sm text-[var(--muted)]">Your exercise library is empty.</p>
                    <button
                      type="button"
                      onClick={() => setTab("new")}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      Create your first exercise →
                    </button>
                  </div>
                )}

                {!loading && exercises.length > 0 && displayed.length === 0 && (
                  <p className="text-xs text-[var(--muted)] text-center py-4">No exercises match your filters.</p>
                )}

                {displayed.map((exercise) => (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => handleSelect(exercise)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 flex items-start gap-3 hover:border-[var(--foreground)] transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {exercise.exercise_type && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${EXERCISE_TYPE_COLORS[exercise.exercise_type] ?? ""}`}>
                            {EXERCISE_TYPE_LABELS[exercise.exercise_type] ?? exercise.exercise_type}
                          </span>
                        )}
                        <p className="text-sm font-medium">{exercise.name}</p>
                      </div>
                      {exercise.description && (
                        <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-1">{exercise.description}</p>
                      )}
                    </div>
                    {exercise.video_url && (
                      <span className="text-xs text-[var(--muted)] shrink-0 mt-0.5">▶</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "new" && (
            <div className="space-y-3 flex-1">
              <div className="space-y-1">
                <label className="text-xs text-[var(--muted)]">Type</label>
                <select
                  value={newExerciseType}
                  onChange={(e) => setNewExerciseType(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Select type —</option>
                  {Object.entries(EXERCISE_TYPE_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--muted)]">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Barbell Squat"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setCreateError(null); }}
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--muted)]">Description <span className="text-[var(--muted)]">(optional)</span></label>
                <textarea
                  placeholder="Cues, muscles targeted, etc."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={4}
                  className={`${inputClass} resize-y`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--muted)]">Video URL <span className="text-[var(--muted)]">(optional)</span></label>
                <input
                  type="url"
                  placeholder="https://youtube.com/..."
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  className={inputClass}
                />
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveToLibrary}
                  onChange={(e) => setSaveToLibrary(e.target.checked)}
                  className="rounded border-[var(--border)] accent-[var(--accent)]"
                />
                Save to exercise library
              </label>

              {createError && <p className="text-xs text-red-500">{createError}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {creating ? "Adding…" : "Add exercise"}
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
          )}
        </div>
      </div>
    </div>
  );
}
