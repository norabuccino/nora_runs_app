"use client";

import { useEffect, useState, useTransition } from "react";
import { CREATED_BY_LABELS, canEditContent, matchesCreatedBy, ownershipOf, type CreatedByFilter } from "@/lib/contentOwnership";
import { useViewer } from "@/hooks/useViewer";
import { createClient } from "@/lib/supabase/client";
import type { Exercise } from "@/types/database";
import { createExercise, updateExercise, deleteExercise, getExerciseUsage, bulkUpdateExercises } from "@/app/actions/exercises";
import { EXERCISE_TYPE_LABELS, EXERCISE_TYPE_COLORS, EXERCISE_TYPE_TEXT_COLORS, LOAD_FORMAT_LABELS } from "@/lib/paceUtils";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import { ExerciseImportModal } from "@/components/ExerciseImportModal";
import { DeleteExerciseModal } from "@/components/DeleteExerciseModal";
import {
  ActiveFilterChips,
  FilterCheckbox,
  FilterPanel,
  FilterSelect,
  FiltersButton,
  Pill,
  PillRow,
  activeFilterList,
} from "@/components/FilterControls";
import { ExerciseFormFields } from "@/components/ExerciseFormFields";
import { EMPTY_EXERCISE_FORM, exerciseFormToPayload, exerciseToForm, type ExerciseFormData } from "@/lib/exerciseForm";
import { collectSources, formatSources, hasSource, normalizeSources } from "@/lib/exerciseSources";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, formatMuscleGroups, sortMuscleGroups } from "@/lib/muscleGroups";
import { EQUIPMENT, EQUIPMENT_LABELS, formatEquipment, sortEquipment } from "@/lib/equipment";
import type { ExerciseUsageEntry } from "@/lib/exerciseUsage";
import { useCompactMode } from "@/hooks/useCompactMode";
import { csvEscape } from "@/lib/csvUtils";
import { byString, byStringDesc, thenBy } from "@/lib/sortUtils";


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
            <ExerciseFormFields value={form} onChange={setForm} sourceSuggestions={sourceSuggestions} />

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
  const [createdByFilter, setCreatedByFilter] = useState<CreatedByFilter>("all");
  const viewer = useViewer();
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
  const activeFilters = activeFilterList([
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
    createdByFilter !== "all" && { key: "createdBy", label: CREATED_BY_LABELS[createdByFilter], clear: () => setCreatedByFilter("all") },
  ]);

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
      if (!matchesCreatedBy(createdByFilter, ownershipOf(e.user_id, viewer))) return false;
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
      await createExercise(exerciseFormToPayload(data));
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
      await updateExercise(editing.id, exerciseFormToPayload(data));
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
    setCreatedByFilter("all");
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
    setCreatedByFilter("all");
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
            className="hidden sm:inline-block px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--card)] disabled:opacity-40 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="hidden sm:inline-block px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--card)] transition-colors"
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
            <FiltersButton
              open={filtersOpen}
              onToggle={() => setFiltersOpen((o) => !o)}
              count={activeFilters.length}
              controls="exercise-filters"
            />
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
          <PillRow>
            {TYPE_FILTERS.map(({ value, label }) => (
              <Pill
                key={value}
                active={typeFilter === value}
                activeClass={value === "all" ? undefined : EXERCISE_TYPE_COLORS[value]}
                onClick={() => enterCategory(value)}
              >
                {label}
              </Pill>
            ))}
          </PillRow>

          {/* Collapsible filter panel */}
          {filtersOpen && (
            <FilterPanel id="exercise-filters">
              <FilterSelect label="Muscle group" value={muscleFilter} onChange={setMuscleFilter}>
                <option value="all">Any</option>
                {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{MUSCLE_GROUP_LABELS[g]}</option>)}
              </FilterSelect>
              <FilterSelect label="Equipment" value={equipmentFilter} onChange={setEquipmentFilter}>
                <option value="all">Any</option>
                <option value="__none__">No equipment</option>
                {EQUIPMENT.map((k) => <option key={k} value={k}>{EQUIPMENT_LABELS[k]}</option>)}
              </FilterSelect>
              {availableSources.length > 0 && (
                <FilterSelect label="Source" value={sourceFilter} onChange={setSourceFilter}>
                  <option value="all">Any</option>
                  {availableSources.map((src) => <option key={src} value={src}>{src}</option>)}
                </FilterSelect>
              )}
              <FilterSelect
                label="Weight tracking"
                value={trackingFilter}
                onChange={(v) => setTrackingFilter(v as "all" | "tracked" | "untracked")}
              >
                <option value="all">Any</option>
                <option value="tracked">Tracked</option>
                <option value="untracked">Not tracked</option>
              </FilterSelect>
              <FilterSelect label="Created by" value={createdByFilter} onChange={(v) => setCreatedByFilter(v as CreatedByFilter)}>
                <option value="all">Anyone</option>
                <option value="mine">{CREATED_BY_LABELS.mine}</option>
                <option value="site">{CREATED_BY_LABELS.site}</option>
              </FilterSelect>
              <FilterCheckbox label="Missing description" checked={noDescriptionOnly} onChange={setNoDescriptionOnly} />
            </FilterPanel>
          )}

          {/* Active filters as removable chips + result count */}
          <ActiveFilterChips count={displayed.length} noun={["exercise", "exercises"]} filters={activeFilters} />

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
                  canEdit={canEditContent(exercise.user_id, viewer)}
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
                  canEdit={canEditContent(exercise.user_id, viewer)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {creating && (
        <ExerciseModal
          title="New exercise"
          initial={EMPTY_EXERCISE_FORM}
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
          onEdit={canEditContent(detail.user_id, viewer) ? (e) => { setDetail(null); setEditing(e); setSaveError(null); } : undefined}
        />
      )}

      {editing && (
        <ExerciseModal
          title="Edit exercise"
          initial={exerciseToForm(editing)}
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
  /** Own exercise, or a site exercise for an admin — otherwise no Edit/Delete. */
  canEdit: boolean;
}

function ExerciseCard({ exercise, compact, selectMode, selected, isPending, onToggleSelect, onDetail, onEdit, onDelete, canEdit }: ExerciseCardProps) {
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
        {canEdit && (
          <>
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
          </>
        )}
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

      {canEdit && (
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
      )}
    </div>
  );
}
