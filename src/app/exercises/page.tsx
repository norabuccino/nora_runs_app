"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Exercise } from "@/types/database";
import { createExercise, updateExercise, deleteExercise, getExerciseUsage, bulkUpdateExercises } from "@/app/actions/exercises";
import { EXERCISE_TYPE_LABELS, EXERCISE_TYPE_COLORS, EXERCISE_TYPE_TEXT_COLORS, LOADING_CATEGORY_LABELS, LOAD_FORMAT_LABELS } from "@/lib/paceUtils";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import { ExerciseImportModal } from "@/components/ExerciseImportModal";
import { DeleteExerciseModal } from "@/components/DeleteExerciseModal";
import { SourcesInput } from "@/components/SourcesInput";
import { collectSources, formatSources, hasSource, normalizeSources } from "@/lib/exerciseSources";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, formatMuscleGroups, sortMuscleGroups, toggleMuscleGroup } from "@/lib/muscleGroups";
import { EQUIPMENT, EQUIPMENT_LABELS, formatEquipment, sortEquipment, toggleEquipment } from "@/lib/equipment";
import type { ExerciseUsageEntry } from "@/lib/exerciseUsage";
import { useCompactMode } from "@/hooks/useCompactMode";
import { csvEscape } from "@/lib/csvUtils";
import { byString, byStringDesc, thenBy } from "@/lib/sortUtils";

interface ExerciseFormData {
  name: string;
  description: string;
  video_url: string;
  exercise_type: string;
  sources: string[];
  muscle_groups: string[];
  equipment: string[];
  is_private: boolean;
  loading_category: string;
  track_load: boolean;
  load_format: string;
  default_increment: string;
}

const EMPTY_FORM: ExerciseFormData = {
  name: "",
  description: "",
  video_url: "",
  exercise_type: "",
  sources: [],
  muscle_groups: [],
  equipment: [],
  is_private: false,
  loading_category: "",
  track_load: false,
  load_format: "",
  default_increment: "",
};

const inputClass = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const labelClass = "text-xs text-[var(--muted)]";
const filterSelectClass = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  ...Object.entries(EXERCISE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

// Order shown on the category landing page.
const CATEGORY_TYPES = Object.keys(EXERCISE_TYPE_LABELS);

type SortKey = "az" | "za" | "newest" | "oldest" | "type";

function applySort(items: Exercise[], sort: SortKey): Exercise[] {
  const byName = byString<Exercise>((e) => e.name);
  switch (sort) {
    case "az": return [...items].sort(byName);
    case "za": return [...items].sort(byStringDesc((e) => e.name));
    case "newest": return [...items].sort(byStringDesc((e) => e.created_at));
    case "oldest": return [...items].sort(byString((e) => e.created_at));
    case "type": return [...items].sort(thenBy(
      byString((e) => e.exercise_type ?? ""),
      byName
    ));
    default: return items;
  }
}

// Marks exercises whose weights/reps are logged and shown on /progression.
function TrackedIcon({ exercise, className = "" }: { exercise: Exercise; className?: string }) {
  const format = exercise.load_format ? LOAD_FORMAT_LABELS[exercise.load_format] ?? exercise.load_format : null;
  const label = `Weights tracked${format ? ` (${format})` : ""}`;
  return (
    <span className={`shrink-0 text-xs font-bold text-[var(--accent)] ${className}`} title={label} aria-label={label}>
      ↗
    </span>
  );
}

function ExerciseModal({
  title,
  initial,
  onSave,
  onCancel,
  saving,
  error,
  sourceSuggestions,
}: {
  title: string;
  initial: ExerciseFormData;
  onSave: (data: ExerciseFormData) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  sourceSuggestions: string[];
}) {
  const [form, setForm] = useState(initial);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90dvh] sm:max-h-[90vh]">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{title}</h2>
            <button onClick={onCancel} className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none">×</button>
          </div>

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
                rows={8}
                placeholder="Cues, muscles targeted, coaching notes…"
                className={`${inputClass} resize-y`}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Muscle groups <span className="text-[var(--muted)]">(optional — pick any that apply)</span></label>
              <div className="flex flex-wrap gap-1.5">
                {MUSCLE_GROUPS.map((g) => {
                  const on = form.muscle_groups.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, muscle_groups: toggleMuscleGroup(p.muscle_groups, g) }))}
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
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Equipment <span className="text-[var(--muted)]">(optional — pick any that apply)</span></label>
              <div className="flex flex-wrap gap-1.5">
                {EQUIPMENT.map((g) => {
                  const on = form.equipment.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, equipment: toggleEquipment(p.equipment, g) }))}
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
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Sources <span className="text-[var(--muted)]">(optional — press Enter to add each)</span></label>
              <SourcesInput
                value={form.sources}
                onChange={(sources) => setForm((p) => ({ ...p, sources }))}
                suggestions={sourceSuggestions}
                placeholder="e.g. Coach, Book, YouTube…"
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

            <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
              <input
                type="checkbox"
                checked={form.is_private}
                onChange={(e) => setForm((p) => ({ ...p, is_private: e.target.checked }))}
                className="w-4 h-4 accent-[var(--accent)]"
              />
              <span className="text-sm">Private — only visible to you</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
              <input
                type="checkbox"
                checked={form.track_load}
                onChange={(e) => setForm((p) => ({ ...p, track_load: e.target.checked }))}
                className="w-4 h-4 accent-[var(--accent)]"
              />
              <span className="text-sm">Track load — log weight/reps and show up in Strength Progression</span>
            </label>

            {form.track_load && (
              <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
                <div className="space-y-1">
                  <label className={labelClass}>Loading category <span className="text-[var(--muted)]">(optional)</span></label>
                  <select
                    value={form.loading_category}
                    onChange={(e) => setForm((p) => ({ ...p, loading_category: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">— None —</option>
                    {Object.entries(LOADING_CATEGORY_LABELS).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Load format</label>
                  <select
                    value={form.load_format}
                    onChange={(e) => setForm((p) => ({ ...p, load_format: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">— Select format —</option>
                    {Object.entries(LOAD_FORMAT_LABELS).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </select>
                  <p className="text-xs text-[var(--muted)]">
                    How to interpret a logged number — e.g. per hand so &quot;15&quot; means 15 lb/hand, not 15 lb total.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Default increment <span className="text-[var(--muted)]">(optional)</span></label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={form.default_increment}
                    onChange={(e) => setForm((p) => ({ ...p, default_increment: e.target.value }))}
                    placeholder="e.g. 2.5"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-2 pt-1">
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
        </div>
      </div>
    </div>
  );
}

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [muscleFilter, setMuscleFilter] = useState("all");
  const [equipmentFilter, setEquipmentFilter] = useState("all");
  const [noDescriptionOnly, setNoDescriptionOnly] = useState(false);
  const [trackingFilter, setTrackingFilter] = useState<"all" | "tracked" | "untracked">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("az");
  // null = on the category-picker landing page; set once a category (or "all") is chosen.
  const [category, setCategory] = useState<string | "all" | null>(null);
  const [compact, setCompact] = useCompactMode();
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [deleting, setDeleting] = useState<{ exercise: Exercise; usage: ExerciseUsageEntry[]; historyCount: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = useState("");
  const [bulkSource, setBulkSource] = useState("");
  // "add:<group>" or "remove:<group>"; "" = no change.
  const [bulkMuscle, setBulkMuscle] = useState("");
  const [bulkEquipment, setBulkEquipment] = useState("");
  const [bulkTrack, setBulkTrack] = useState<"" | "on" | "off">("");
  const [bulkLoadFormat, setBulkLoadFormat] = useState("");
  const [showImport, setShowImport] = useState(false);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase.from("exercises").select("*").order("name");
    setExercises(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleExport() {
    const headers = "id,name,exercise_type,description,video_url,source,muscle_groups,equipment,loading_category,track_load,load_format,default_increment";
    const rows = exercises.map((e) =>
      [
        e.id,
        csvEscape(e.name),
        e.exercise_type ?? "",
        csvEscape(e.description),
        csvEscape(e.video_url),
        csvEscape(formatSources(e.sources)),
        csvEscape(formatMuscleGroups(e.muscle_groups)),
        csvEscape(formatEquipment(e.equipment)),
        e.loading_category ?? "",
        e.track_load ? "true" : "false",
        e.load_format ?? "",
        e.default_increment ?? "",
      ].join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exercises.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const availableSources = collectSources(exercises);

  // Filters beyond type/search, shown as removable chips under the toolbar.
  const activeFilters: { key: string; label: string; clear: () => void }[] = [
    muscleFilter !== "all" && { key: "muscle", label: MUSCLE_GROUP_LABELS[muscleFilter] ?? muscleFilter, clear: () => setMuscleFilter("all") },
    equipmentFilter !== "all" && {
      key: "equipment",
      label: equipmentFilter === "__none__" ? "No equipment" : EQUIPMENT_LABELS[equipmentFilter] ?? equipmentFilter,
      clear: () => setEquipmentFilter("all"),
    },
    sourceFilter !== "all" && { key: "source", label: sourceFilter, clear: () => setSourceFilter("all") },
    trackingFilter !== "all" && {
      key: "tracking",
      label: trackingFilter === "tracked" ? "Tracked" : "Not tracked",
      clear: () => setTrackingFilter("all"),
    },
    noDescriptionOnly && { key: "nodesc", label: "Missing description", clear: () => setNoDescriptionOnly(false) },
  ].filter((f): f is { key: string; label: string; clear: () => void } => !!f);

  function clearFilters() {
    setMuscleFilter("all");
    setEquipmentFilter("all");
    setSourceFilter("all");
    setTrackingFilter("all");
    setNoDescriptionOnly(false);
  }

  const displayed = applySort(
    exercises.filter((e) => {
      if (typeFilter !== "all" && e.exercise_type !== typeFilter) return false;
      if (sourceFilter !== "all" && !hasSource(e.sources, sourceFilter)) return false;
      if (muscleFilter !== "all" && !e.muscle_groups?.includes(muscleFilter)) return false;
      if (equipmentFilter === "__none__" && sortEquipment(e.equipment).length) return false;
      if (equipmentFilter !== "all" && equipmentFilter !== "__none__" && !e.equipment?.includes(equipmentFilter)) return false;
      if (noDescriptionOnly && e.description?.trim()) return false;
      if (trackingFilter === "tracked" && !e.track_load) return false;
      if (trackingFilter === "untracked" && e.track_load) return false;
      if (!search.trim()) return true;
      return (
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
        formatSources(e.sources).toLowerCase().includes(search.toLowerCase())
      );
    }),
    sort
  );

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
        sources: normalizeSources(data.sources),
        muscle_groups: sortMuscleGroups(data.muscle_groups),
        equipment: sortEquipment(data.equipment),
        is_private: data.is_private,
        loading_category: data.loading_category || null,
        track_load: data.track_load,
        load_format: data.track_load ? data.load_format || null : null,
        default_increment: data.track_load && data.default_increment ? parseFloat(data.default_increment) : null,
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
        sources: normalizeSources(data.sources),
        muscle_groups: sortMuscleGroups(data.muscle_groups),
        equipment: sortEquipment(data.equipment),
        is_private: data.is_private,
        loading_category: data.loading_category || null,
        track_load: data.track_load,
        load_format: data.track_load ? data.load_format || null : null,
        default_increment: data.track_load && data.default_increment ? parseFloat(data.default_increment) : null,
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
    startTransition(async () => {
      // If any workout uses this exercise, offer to swap in a replacement first.
      const { workouts, historyCount } = await getExerciseUsage(exercise.id);
      if (workouts.length > 0) {
        setDeleting({ exercise, usage: workouts, historyCount });
        return;
      }
      if (!confirm(`Delete "${exercise.name}"?`)) return;
      await deleteExercise(exercise.id);
      await load();
    });
  }

  async function handleConfirmDelete(replacement?: { exerciseId: string; moveHistory: boolean }) {
    if (!deleting) return;
    await deleteExercise(deleting.exercise.id, replacement);
    setDeleting(null);
    await load();
  }

  function enterCategory(type: string) {
    setTypeFilter(type);
    setSourceFilter("all");
    setMuscleFilter("all");
    setEquipmentFilter("all");
    setNoDescriptionOnly(false);
    setTrackingFilter("all");
    setCategory(type);
  }

  function backToCategories() {
    setCategory(null);
    setTypeFilter("all");
    setSourceFilter("all");
    setMuscleFilter("all");
    setEquipmentFilter("all");
    setNoDescriptionOnly(false);
    setTrackingFilter("all");
    setSearch("");
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkType("");
    setBulkSource("");
    setBulkMuscle("");
    setBulkEquipment("");
    setBulkTrack("");
    setBulkLoadFormat("");
  }

  function handleBulkApply() {
    if (selectedIds.size === 0) return;
    const updates: Parameters<typeof bulkUpdateExercises>[1] = {};
    if (bulkType !== "") updates.exercise_type = bulkType || null;
    if (bulkSource.trim() !== "") updates.addSources = normalizeSources([bulkSource]);
    if (bulkTrack === "on") {
      updates.track_load = true;
      if (bulkLoadFormat) updates.load_format = bulkLoadFormat;
    } else if (bulkTrack === "off") {
      updates.track_load = false;
    }
    if (bulkEquipment) {
      const [action, item] = bulkEquipment.split(":");
      if (action === "add") updates.addEquipment = [item];
      else updates.removeEquipment = [item];
    }
    if (bulkMuscle) {
      const [action, group] = bulkMuscle.split(":");
      if (action === "add") updates.addMuscleGroups = [group];
      else updates.removeMuscleGroups = [group];
    }
    if (!Object.keys(updates).length) return;
    startTransition(async () => {
      await bulkUpdateExercises(Array.from(selectedIds), updates);
      exitSelectMode();
      await load();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Exercise Library</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Reusable exercises you can add to any strength workout.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            onClick={handleExport}
            disabled={exercises.length === 0}
            className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--card)] disabled:opacity-40 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--card)] transition-colors"
          >
            Import
          </button>
          <button
            onClick={() => { setSelectMode((m) => { if (m) exitSelectMode(); return !m; }); }}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              selectMode
                ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                : "border-[var(--border)] hover:bg-[var(--card)]"
            }`}
          >
            {selectMode ? "Done" : "Select"}
          </button>
          <button
            onClick={() => setCompact((c) => !c)}
            title={compact ? "Switch to card view" : "Switch to compact view"}
            className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--background)] transition-colors text-[var(--muted)]"
          >
            {compact ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
          <button
            onClick={() => { setCreating(true); setSaveError(null); }}
            className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + New exercise
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {!loading && exercises.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <p className="text-[var(--muted)]">Your exercise library is empty.</p>
          <p className="text-sm text-[var(--muted)]">
            Add exercises here and reuse them across strength workouts.
          </p>
          <button
            onClick={() => { setCreating(true); setSaveError(null); }}
            className="mt-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
          >
            Add your first exercise
          </button>
        </div>
      )}

      {/* Category landing page — most people want just their one category,
          not the whole library, so land here first and filter down from a
          click rather than defaulting straight into the full list. */}
      {!loading && exercises.length > 0 && category === null && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">Pick a category to browse, or view everything at once.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CATEGORY_TYPES.map((type) => {
              const count = exercises.filter((e) => e.exercise_type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => enterCategory(type)}
                  className={`group rounded-xl border border-[var(--border)] ${EXERCISE_TYPE_COLORS[type]} p-4 text-center space-y-1 hover:border-[var(--foreground)] transition-colors`}
                >
                  <p className={`text-lg font-semibold ${EXERCISE_TYPE_TEXT_COLORS[type]}`}>
                    {EXERCISE_TYPE_LABELS[type]}
                  </p>
                  <p className="text-xs opacity-70">
                    {count} exercise{count === 1 ? "" : "s"}
                  </p>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => enterCategory("all")}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            View all exercises →
          </button>
        </div>
      )}

      {!loading && exercises.length > 0 && category !== null && (
        <div className="space-y-4">
          <button
            onClick={backToCategories}
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            ← All categories
          </button>

          {/* Search + filters toggle + sort */}
          <div className="flex gap-2 items-center">
            <input
              type="search"
              placeholder="Search…"
              aria-label="Search exercises"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-controls="exercise-filters"
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                filtersOpen || activeFilters.length
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
              </svg>
              Filters
              {activeFilters.length > 0 && (
                <span className="rounded-full bg-[var(--foreground)] text-[var(--background)] text-[10px] font-semibold leading-none px-1.5 py-0.5 tabular-nums">
                  {activeFilters.length}
                </span>
              )}
            </button>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort exercises"
              className="shrink-0 w-24 sm:w-auto rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 sm:px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
              <option value="type">By type</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          {/* Type pills — one swipeable row instead of wrapping onto several lines */}
          <div className="-mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-1.5 w-max sm:w-auto sm:flex-wrap">
              {TYPE_FILTERS.map(({ value, label }) => {
                const isActive = typeFilter === value;
                const colorClass = value !== "all" ? EXERCISE_TYPE_COLORS[value] : "";
                return (
                  <button
                    key={value}
                    onClick={() => enterCategory(value)}
                    className={`shrink-0 whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? value === "all"
                          ? "bg-[var(--foreground)] text-[var(--background)]"
                          : colorClass
                        : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Collapsible filter panel */}
          {filtersOpen && (
            <div
              id="exercise-filters"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
            >
              <label className="space-y-1 min-w-0">
                <span className="text-[11px] font-medium text-[var(--muted)]">Muscle group</span>
                <select value={muscleFilter} onChange={(e) => setMuscleFilter(e.target.value)} className={filterSelectClass}>
                  <option value="all">Any</option>
                  {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{MUSCLE_GROUP_LABELS[g]}</option>)}
                </select>
              </label>
              <label className="space-y-1 min-w-0">
                <span className="text-[11px] font-medium text-[var(--muted)]">Equipment</span>
                <select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)} className={filterSelectClass}>
                  <option value="all">Any</option>
                  <option value="__none__">No equipment</option>
                  {EQUIPMENT.map((k) => <option key={k} value={k}>{EQUIPMENT_LABELS[k]}</option>)}
                </select>
              </label>
              {availableSources.length > 0 && (
                <label className="space-y-1 min-w-0">
                  <span className="text-[11px] font-medium text-[var(--muted)]">Source</span>
                  <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={filterSelectClass}>
                    <option value="all">Any</option>
                    {availableSources.map((src) => <option key={src} value={src}>{src}</option>)}
                  </select>
                </label>
              )}
              <label className="space-y-1 min-w-0">
                <span className="text-[11px] font-medium text-[var(--muted)]">Weight tracking</span>
                <select
                  value={trackingFilter}
                  onChange={(e) => setTrackingFilter(e.target.value as "all" | "tracked" | "untracked")}
                  className={filterSelectClass}
                >
                  <option value="all">Any</option>
                  <option value="tracked">Tracked</option>
                  <option value="untracked">Not tracked</option>
                </select>
              </label>
              <label className="flex items-center gap-2 min-w-0 self-end pb-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={noDescriptionOnly}
                  onChange={(e) => setNoDescriptionOnly(e.target.checked)}
                  className="accent-[var(--accent)] w-4 h-4"
                />
                Missing description
              </label>
            </div>
          )}

          {/* Active filters as removable chips + result count */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[var(--muted)] tabular-nums mr-1">
              {displayed.length} exercise{displayed.length === 1 ? "" : "s"}
            </span>
            {activeFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={f.clear}
                aria-label={`Remove filter: ${f.label}`}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--card)] border border-[var(--border)] pl-2.5 pr-2 py-0.5 hover:border-[var(--foreground)] transition-colors"
              >
                {f.label}
                <span aria-hidden className="text-[var(--muted)]">×</span>
              </button>
            ))}
            {activeFilters.length > 1 && (
              <button type="button" onClick={clearFilters} className="text-[var(--accent)] hover:underline ml-1">
                Clear all
              </button>
            )}
          </div>

          {/* Select all / deselect row */}
          {selectMode && displayed.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
              <button
                onClick={() => setSelectedIds(new Set(displayed.map((e) => e.id)))}
                className="hover:text-[var(--foreground)] transition-colors"
              >
                Select all ({displayed.length})
              </button>
              {selectedIds.size > 0 && (
                <>
                  <span>·</span>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="hover:text-[var(--foreground)] transition-colors"
                  >
                    Deselect all
                  </button>
                </>
              )}
              {selectedIds.size > 0 && (
                <span className="ml-auto">{selectedIds.size} selected</span>
              )}
            </div>
          )}

          {displayed.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-8 text-center">No exercises match.</p>
          ) : compact ? (
            <div className="flex flex-col gap-1">
              {displayed.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  compact
                  selectMode={selectMode}
                  selected={selectedIds.has(exercise.id)}
                  onToggleSelect={toggleSelect}
                  onDetail={setDetail}
                  onEdit={(e) => { setEditing(e); setSaveError(null); }}
                  onDelete={handleDelete}
                  isPending={isPending}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {displayed.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  selectMode={selectMode}
                  selected={selectedIds.has(exercise.id)}
                  onToggleSelect={toggleSelect}
                  onDetail={setDetail}
                  onEdit={(e) => { setEditing(e); setSaveError(null); }}
                  onDelete={handleDelete}
                  isPending={isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {creating && (
        <ExerciseModal
          title="New exercise"
          initial={EMPTY_FORM}
          onSave={handleCreate}
          onCancel={() => { setCreating(false); setSaveError(null); }}
          saving={saving}
          error={saveError}
          sourceSuggestions={availableSources}
        />
      )}

      {detail && (
        <ExerciseDetailModal
          exercise={detail}
          onClose={() => setDetail(null)}
          onEdit={(e) => { setDetail(null); setEditing(e); setSaveError(null); }}
        />
      )}

      {editing && (
        <ExerciseModal
          title="Edit exercise"
          initial={{
            name: editing.name,
            description: editing.description ?? "",
            video_url: editing.video_url ?? "",
            exercise_type: editing.exercise_type ?? "",
            sources: editing.sources ?? [],
            muscle_groups: editing.muscle_groups ?? [],
            equipment: editing.equipment ?? [],
            is_private: editing.is_private,
            loading_category: editing.loading_category ?? "",
            track_load: editing.track_load,
            load_format: editing.load_format ?? "",
            default_increment: editing.default_increment != null ? String(editing.default_increment) : "",
          }}
          onSave={handleUpdate}
          onCancel={() => { setEditing(null); setSaveError(null); }}
          saving={saving}
          error={saveError}
          sourceSuggestions={availableSources}
        />
      )}

      {deleting && (
        <DeleteExerciseModal
          exercise={deleting.exercise}
          usage={deleting.usage}
          historyCount={deleting.historyCount}
          candidates={exercises}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {showImport && (
        <ExerciseImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); load(); }}
        />
      )}

      {/* Floating bulk edit toolbar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl p-3 flex flex-wrap items-center gap-2 max-w-[min(90vw,44rem)]">
          <span className="text-sm font-medium whitespace-nowrap pr-1">
            {selectedIds.size} selected
          </span>
          <select
            value={bulkType}
            onChange={(e) => setBulkType(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="">Type: no change</option>
            <option value="">— clear type —</option>
            {Object.entries(EXERCISE_TYPE_LABELS).map(([val, lbl]) => (
              <option key={val} value={val}>{lbl}</option>
            ))}
          </select>
          <input
            type="text"
            value={bulkSource}
            onChange={(e) => setBulkSource(e.target.value)}
            placeholder="Add source…"
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none w-36"
          />
          <select
            value={bulkMuscle}
            onChange={(e) => setBulkMuscle(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="">Muscle group: no change</option>
            <optgroup label="Add">
              {MUSCLE_GROUPS.map((g) => (
                <option key={g} value={`add:${g}`}>+ {MUSCLE_GROUP_LABELS[g]}</option>
              ))}
            </optgroup>
            <optgroup label="Remove">
              {MUSCLE_GROUPS.map((g) => (
                <option key={g} value={`remove:${g}`}>− {MUSCLE_GROUP_LABELS[g]}</option>
              ))}
            </optgroup>
          </select>
          <select
            value={bulkEquipment}
            onChange={(e) => setBulkEquipment(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="">Equipment: no change</option>
            <optgroup label="Add">
              {EQUIPMENT.map((k) => (
                <option key={k} value={`add:${k}`}>+ {EQUIPMENT_LABELS[k]}</option>
              ))}
            </optgroup>
            <optgroup label="Remove">
              {EQUIPMENT.map((k) => (
                <option key={k} value={`remove:${k}`}>− {EQUIPMENT_LABELS[k]}</option>
              ))}
            </optgroup>
          </select>
          <select
            value={bulkTrack}
            onChange={(e) => setBulkTrack(e.target.value as "" | "on" | "off")}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="">Weight tracking: no change</option>
            <option value="on">Track weights</option>
            <option value="off">Stop tracking weights</option>
          </select>
          {bulkTrack === "on" && (
            <select
              value={bulkLoadFormat}
              onChange={(e) => setBulkLoadFormat(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
            >
              <option value="">Load format: no change</option>
              {Object.entries(LOAD_FORMAT_LABELS).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleBulkApply}
            disabled={isPending || (bulkType === "" && !bulkSource.trim() && !bulkMuscle && !bulkEquipment && !bulkTrack)}
            className="px-3 py-1.5 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap"
          >
            Apply
          </button>
          <button
            onClick={exitSelectMode}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

interface ExerciseCardProps {
  exercise: Exercise;
  compact?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  isPending?: boolean;
  onToggleSelect?: (id: string) => void;
  onDetail: (e: Exercise) => void;
  onEdit: (e: Exercise) => void;
  onDelete: (e: Exercise) => void;
}

function ExerciseCard({ exercise, compact, selectMode, selected, isPending, onToggleSelect, onDetail, onEdit, onDelete }: ExerciseCardProps) {
  const typeBadge = exercise.exercise_type ? (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${EXERCISE_TYPE_COLORS[exercise.exercise_type] ?? "bg-gray-100 text-gray-600"}`}>
      {EXERCISE_TYPE_LABELS[exercise.exercise_type] ?? exercise.exercise_type}
    </span>
  ) : null;

  if (compact) {
    return (
      <div
        onClick={() => onDetail(exercise)}
        className={`rounded-lg border bg-[var(--card)] px-3 py-2.5 flex items-center gap-3 transition-colors cursor-pointer hover:border-[var(--foreground)] ${selected ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
      >
        {selectMode && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect?.(exercise.id)}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 accent-[var(--accent)] w-4 h-4 cursor-pointer"
          />
        )}
        {typeBadge}
        <span className="text-sm font-medium truncate flex-1 min-w-0">{exercise.name}</span>
        {exercise.sources?.length > 0 && (
          <span className="min-w-0 max-w-[20%] truncate text-xs text-[var(--muted)]">{exercise.sources.join(", ")}</span>
        )}
        {exercise.track_load && <TrackedIcon exercise={exercise} />}
        {exercise.is_private && (
          <span className="shrink-0 text-xs text-[var(--muted)]" title="Private">🔒</span>
        )}
        {exercise.video_url && (
          <span className="shrink-0 text-xs text-[var(--muted)]" title="Has video">▶</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(exercise); }}
          title="Edit"
          className="flex-shrink-0 w-7 h-7 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] text-sm flex items-center justify-center transition-colors"
        >
          ✎
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(exercise); }}
          disabled={isPending}
          title="Delete"
          className="flex-shrink-0 w-7 h-7 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-red-500 hover:border-red-300 text-sm flex items-center justify-center transition-colors disabled:opacity-50"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => onDetail(exercise)}
      className={`rounded-xl border bg-[var(--card)] p-4 space-y-3 flex flex-col transition-colors cursor-pointer hover:border-[var(--foreground)] ${selected ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
    >
      <div className="flex items-start justify-between gap-2">
        {selectMode && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect?.(exercise.id)}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 flex-shrink-0 accent-[var(--accent)] w-4 h-4 cursor-pointer"
          />
        )}
        <div className="space-y-1 min-w-0 flex-1">
          {typeBadge}
          <h3 className="font-medium text-sm leading-snug truncate">{exercise.name}</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {exercise.track_load && <TrackedIcon exercise={exercise} className="pt-0.5" />}
          {exercise.is_private && (
            <span className="text-xs text-[var(--muted)] pt-0.5" title="Private">🔒</span>
          )}
          {exercise.video_url && (
            <span className="text-xs text-[var(--muted)] pt-0.5" title="Has video">▶</span>
          )}
        </div>
      </div>

      {exercise.description && (
        <p className="text-xs text-[var(--muted)] line-clamp-2">{exercise.description}</p>
      )}

      {exercise.muscle_groups?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sortMuscleGroups(exercise.muscle_groups).map((g) => (
            <span key={g} className="px-2 py-0.5 rounded-full border border-[var(--border)] text-[10px] text-[var(--muted)]">
              {MUSCLE_GROUP_LABELS[g]}
            </span>
          ))}
        </div>
      )}

      {sortEquipment(exercise.equipment).length > 0 && (
        <p className="text-xs text-[var(--muted)]">
          <span className="font-medium">Equipment:</span> {sortEquipment(exercise.equipment).map((k) => EQUIPMENT_LABELS[k]).join(", ")}
        </p>
      )}

      {exercise.sources?.length > 0 && (
        <p className="text-xs text-[var(--muted)]">{exercise.sources.join(", ")}</p>
      )}

      <div className="flex gap-2 pt-1 mt-auto">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(exercise); }}
          className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-1.5 text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Edit
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(exercise); }}
          disabled={isPending}
          className="px-3 rounded-lg border border-[var(--border)] text-xs text-[var(--muted)] hover:text-red-500 hover:border-red-300 transition-colors disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
