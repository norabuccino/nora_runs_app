"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Exercise } from "@/types/database";
import { createExercise, updateExercise, deleteExercise, bulkUpdateExercises } from "@/app/actions/exercises";
import { EXERCISE_TYPE_LABELS, EXERCISE_TYPE_COLORS } from "@/lib/paceUtils";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import { ExerciseImportModal } from "@/components/ExerciseImportModal";

interface ExerciseFormData {
  name: string;
  description: string;
  video_url: string;
  exercise_type: string;
  source: string;
  is_private: boolean;
}

const EMPTY_FORM: ExerciseFormData = { name: "", description: "", video_url: "", exercise_type: "", source: "", is_private: false };

const inputClass = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const labelClass = "text-xs text-[var(--muted)]";

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  ...Object.entries(EXERCISE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

type SortKey = "az" | "za" | "newest" | "oldest" | "type";

function applySort(items: Exercise[], sort: SortKey): Exercise[] {
  const sorted = [...items];
  switch (sort) {
    case "az":    return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "za":    return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "newest": return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "oldest": return sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case "type":  return sorted.sort((a, b) => {
      const ta = a.exercise_type ?? "";
      const tb = b.exercise_type ?? "";
      return ta !== tb ? ta.localeCompare(tb) : a.name.localeCompare(b.name);
    });
    default: return sorted;
  }
}

function ExerciseModal({
  title,
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  title: string;
  initial: ExerciseFormData;
  onSave: (data: ExerciseFormData) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
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
              <label className={labelClass}>Source <span className="text-[var(--muted)]">(optional)</span></label>
              <input
                type="text"
                value={form.source}
                onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
                placeholder="e.g. Coach, Book, YouTube…"
                className={inputClass}
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
  const [noDescriptionOnly, setNoDescriptionOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("az");
  const [compact, setCompact] = useState(false);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = useState("");
  const [bulkSource, setBulkSource] = useState("");
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    setCompact(window.matchMedia("(max-width: 640px)").matches);
  }, []);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase.from("exercises").select("*").order("name");
    setExercises(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleExport() {
    const csvEscape = (s: string | null) => s ? `"${s.replace(/"/g, '""')}"` : "";
    const headers = "name,exercise_type,description,video_url,source";
    const rows = exercises.map((e) =>
      [csvEscape(e.name), e.exercise_type ?? "", csvEscape(e.description), csvEscape(e.video_url), csvEscape(e.source)].join(",")
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

  const availableSources = Array.from(
    new Set(exercises.map((e) => e.source).filter(Boolean))
  ) as string[];

  const displayed = applySort(
    exercises.filter((e) => {
      if (typeFilter !== "all" && e.exercise_type !== typeFilter) return false;
      if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
      if (noDescriptionOnly && e.description?.trim()) return false;
      if (!search.trim()) return true;
      return (
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (e.source ?? "").toLowerCase().includes(search.toLowerCase())
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
        source: data.source.trim() || null,
        is_private: data.is_private,
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
        source: data.source.trim() || null,
        is_private: data.is_private,
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
  }

  function handleBulkApply() {
    if (selectedIds.size === 0) return;
    const updates: { exercise_type?: string | null; source?: string | null } = {};
    if (bulkType !== "") updates.exercise_type = bulkType || null;
    if (bulkSource.trim() !== "") updates.source = bulkSource.trim();
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

      {!loading && exercises.length > 0 && (
        <div className="space-y-4">
          {/* Search + sort */}
          <div className="flex gap-2 items-center">
            <input
              type="search"
              placeholder="Search exercises…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
              <option value="type">By type</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          {/* Filters */}
          <div className="space-y-2">
            {/* Type filter pills */}
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

            {/* Source filter pills */}
            {availableSources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSourceFilter("all")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    sourceFilter === "all"
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
                  }`}
                >
                  All sources
                </button>
                {availableSources.map((src) => (
                  <button
                    key={src}
                    onClick={() => setSourceFilter(src)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      sourceFilter === src
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
                    }`}
                  >
                    {src}
                  </button>
                ))}
              </div>
            )}

            {/* No-description filter */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setNoDescriptionOnly((v) => !v)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  noDescriptionOnly
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                    : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
                }`}
              >
                No description
              </button>
            </div>
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            source: editing.source ?? "",
            is_private: editing.is_private,
          }}
          onSave={handleUpdate}
          onCancel={() => { setEditing(null); setSaveError(null); }}
          saving={saving}
          error={saveError}
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
            placeholder="Source: no change"
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none w-36"
          />
          <button
            onClick={handleBulkApply}
            disabled={isPending || (bulkType === "" && !bulkSource.trim())}
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
        {exercise.source && (
          <span className="min-w-0 max-w-[20%] truncate text-xs text-[var(--muted)]">{exercise.source}</span>
        )}
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

      {exercise.source && (
        <p className="text-xs text-[var(--muted)]">{exercise.source}</p>
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
