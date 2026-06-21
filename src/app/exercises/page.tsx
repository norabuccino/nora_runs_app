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
}

const EMPTY_FORM: ExerciseFormData = { name: "", description: "", video_url: "", exercise_type: "", source: "" };

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
    case "az":   return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "za":   return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "newest": return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "oldest": return sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case "type": return sorted.sort((a, b) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90vh]">
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
                rows={2}
                placeholder="Cues, muscles targeted, coaching notes…"
                className={`${inputClass} resize-none`}
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
  const [sort, setSort] = useState<SortKey>("az");
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
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exercise Library</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Reusable exercises you can add to any strength workout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exercises.length === 0}
            className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--card)] disabled:opacity-40 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--card)] transition-colors"
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
            onClick={() => { setCreating(true); setSaveError(null); }}
            className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + New exercise
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search exercises…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass}
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] shrink-0"
          >
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="type">By type</option>
          </select>
        </div>

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

        {/* Source filter pills — only shown when sources exist */}
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
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {!loading && exercises.length === 0 && (
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
              <span className="ml-auto">{selectedIds.size} selected</span>
            </>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        {displayed.map((exercise) => (
          <div
            key={exercise.id}
            onClick={() => !selectMode && setDetail(exercise)}
            className={`rounded-lg border bg-[var(--card)] px-3 py-2.5 flex items-center gap-3 transition-colors ${
              selectMode ? "cursor-pointer" : "cursor-pointer hover:border-[var(--foreground)]"
            } ${selectedIds.has(exercise.id) ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
          >
            {selectMode && (
              <input
                type="checkbox"
                checked={selectedIds.has(exercise.id)}
                onChange={() => toggleSelect(exercise.id)}
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0 accent-[var(--accent)] w-4 h-4 cursor-pointer"
              />
            )}
            {exercise.exercise_type && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${EXERCISE_TYPE_COLORS[exercise.exercise_type] ?? "bg-gray-100 text-gray-600"}`}>
                {EXERCISE_TYPE_LABELS[exercise.exercise_type] ?? exercise.exercise_type}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{exercise.name}</p>
              {(exercise.description || exercise.source) && (
                <p className="text-xs text-[var(--muted)] truncate">
                  {exercise.source && <span className="font-medium">{exercise.source}{exercise.description ? " · " : ""}</span>}
                  {exercise.description}
                </p>
              )}
            </div>
            {exercise.video_url && (
              <span className="shrink-0 text-xs text-[var(--muted)]" title="Has video">▶</span>
            )}
            {!selectMode && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditing(exercise); setSaveError(null); }}
                  title="Edit"
                  className="shrink-0 w-7 h-7 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] text-sm flex items-center justify-center transition-colors"
                >
                  ✎
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(exercise); }}
                  disabled={isPending}
                  title="Delete"
                  className="shrink-0 w-7 h-7 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-red-500 hover:border-red-300 text-sm flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}
      </div>

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
