"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LibraryWorkoutWithSteps, RunningPace, WorkoutType, RunType } from "@/types/database";
import { WorkoutLibraryForm, type WorkoutLibraryFormData } from "@/components/WorkoutLibraryForm";
import { AddToPlanModal } from "@/components/AddToPlanModal";
import { WorkoutImportModal } from "@/components/WorkoutImportModal";
import { WorkoutDetailModal } from "@/components/WorkoutDetailModal";
import {
  createLibraryWorkout,
  updateLibraryWorkout,
  deleteLibraryWorkout,
  duplicateLibraryWorkout,
  bulkUpdateLibraryWorkouts,
} from "@/app/actions/workoutLibrary";
import { WorkoutTypeBadges } from "@/components/WorkoutTypeBadges";
import { WorkoutFilterBar, applyWorkoutFilter, DEFAULT_FILTER, type WorkoutFilter } from "@/components/WorkoutFilterBar";
import { displayDistance } from "@/lib/unitUtils";

type SortKey = "az" | "za" | "type" | "duration_desc" | "duration_asc" | "newest" | "oldest";

function applySearch(items: LibraryWorkoutWithSteps[], query: string): LibraryWorkoutWithSteps[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter(
    (w) => w.title.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q)
  );
}

function applySort(items: LibraryWorkoutWithSteps[], sort: SortKey): LibraryWorkoutWithSteps[] {
  const sorted = [...items];
  switch (sort) {
    case "az":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "za":
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case "type": {
      return sorted.sort((a, b) => {
        const t = a.type.localeCompare(b.type);
        if (t !== 0) return t;
        const rt = (a.run_type ?? "").localeCompare(b.run_type ?? "");
        if (rt !== 0) return rt;
        return a.title.localeCompare(b.title);
      });
    }
    case "duration_desc":
      return sorted.sort((a, b) => (b.duration_minutes ?? 0) - (a.duration_minutes ?? 0));
    case "duration_asc":
      return sorted.sort((a, b) => (a.duration_minutes ?? 0) - (b.duration_minutes ?? 0));
    case "newest":
      return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "oldest":
      return sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    default:
      return sorted;
  }
}

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<LibraryWorkoutWithSteps[]>([]);
  const [paces, setPaces] = useState<RunningPace[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryWorkoutWithSteps | null>(null);
  const [addToPlan, setAddToPlan] = useState<LibraryWorkoutWithSteps | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [detail, setDetail] = useState<LibraryWorkoutWithSteps | null>(null);
  const [filter, setFilter] = useState<WorkoutFilter>(DEFAULT_FILTER);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [isPending, startTransition] = useTransition();
  const [compact, setCompact] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = useState("");
  const [bulkRunType, setBulkRunType] = useState("");
  const [bulkSource, setBulkSource] = useState("");

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    setCompact(mql.matches);
    const handler = (e: MediaQueryListEvent) => setCompact(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  function handleExport() {
    const csvEscape = (s: string | null | undefined) => s ? `"${s.replace(/"/g, '""')}"` : "";
    const headers = "type,run_type,strength_type,title,description,distance,distance_unit,pace_type,duration_minutes,notes,source";
    const rows = workouts.map((w) =>
      [
        w.type,
        w.run_type ?? "",
        w.strength_type ?? "",
        csvEscape(w.title),
        csvEscape(w.description),
        w.distance_miles ?? "",
        w.distance_unit ?? "mi",
        w.pace_type ?? "",
        w.duration_minutes ?? "",
        csvEscape(w.notes),
        csvEscape(w.source),
      ].join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workouts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportJSON() {
    const data = workouts.map((w) => {
      const steps = [...w.workout_steps].sort((a, b) => a.step_order - b.step_order);

      // Re-group flat steps by repeat_group_id → nested { group_name, repeat_count, exercises } objects
      const stepItems: unknown[] = [];
      const groupExercises = new Map<number, Record<string, unknown>[]>();

      for (const s of steps) {
        const stepObj: Record<string, unknown> = {};
        if (s.exercise_id && s.label) stepObj.exercise_name = s.label;
        else if (s.label) stepObj.label = s.label;
        if (s.step_type && s.step_type !== "main") stepObj.step_type = s.step_type;
        if (s.pace_type) stepObj.pace_type = s.pace_type;
        if (s.duration_minutes != null) stepObj.duration_minutes = s.duration_minutes;
        if (s.distance_miles != null) stepObj.distance_miles = s.distance_miles;
        if (s.distance_unit && s.distance_unit !== "mi") stepObj.distance_unit = s.distance_unit;
        if (s.sets != null) stepObj.sets = s.sets;
        if (s.reps != null) stepObj.reps = s.reps;
        if (s.weight_suggestion) stepObj.weight_suggestion = s.weight_suggestion;
        if (s.both_sides) stepObj.both_sides = s.both_sides;
        if (s.notes) stepObj.notes = s.notes;

        if (s.repeat_group_id != null) {
          const existing = groupExercises.get(s.repeat_group_id);
          if (existing) {
            existing.push(stepObj);
          } else {
            const exercises: Record<string, unknown>[] = [stepObj];
            groupExercises.set(s.repeat_group_id, exercises);
            const groupObj: Record<string, unknown> = { exercises };
            if (s.group_name) groupObj.group_name = s.group_name;
            if (s.repeat_count && s.repeat_count > 1) groupObj.repeat_count = s.repeat_count;
            stepItems.push(groupObj);
          }
        } else {
          stepItems.push(stepObj);
        }
      }

      const workout: Record<string, unknown> = { type: w.type, title: w.title };
      if (w.run_type) workout.run_type = w.run_type;
      if (w.strength_type) workout.strength_type = w.strength_type;
      if (w.description) workout.description = w.description;
      if (w.distance_miles != null) workout.distance_miles = w.distance_miles;
      if (w.distance_unit && w.distance_unit !== "mi") workout.distance_unit = w.distance_unit;
      if (w.pace_type) workout.pace_type = w.pace_type;
      if (w.duration_minutes != null) workout.duration_minutes = w.duration_minutes;
      if (w.notes) workout.notes = w.notes;
      if (w.source) workout.source = w.source;
      if (stepItems.length > 0) workout.steps = stepItems;
      return workout;
    });

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workouts.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function load() {
    const supabase = createClient();
    const [{ data: ws }, { data: pac }, { data: profile }] = await Promise.all([
      supabase.from("workouts").select("*, workout_steps(*)").order("created_at", { ascending: false }),
      supabase.from("running_paces").select("*").order("created_at"),
      supabase.from("profiles").select("role").single(),
    ]);
    setIsAdmin(profile?.role === "admin");

    setWorkouts(
      (ws ?? []).map((w) => ({
        ...w,
        workout_steps: [...((w as unknown as LibraryWorkoutWithSteps).workout_steps ?? [])].sort(
          (a, b) => a.step_order - b.step_order
        ),
      })) as LibraryWorkoutWithSteps[]
    );
    setPaces(pac ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave(data: WorkoutLibraryFormData) {
    const payload = {
      type: data.type,
      run_type: data.run_type || null,
      strength_type: data.strength_type || null,
      title: data.title,
      description: data.description || null,
      distance_miles: data.distance_miles ? parseFloat(data.distance_miles) : null,
      distance_unit: data.distance_unit ?? "mi",
      pace_type: data.pace_type || null,
      duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes, 10) : null,
      notes: data.notes || null,
      source: data.source || null,
      steps: data.steps.map((s) => {
        const rawDur = s.duration_minutes ? parseFloat(s.duration_minutes) : null;
        return {
          step_type: s.step_type,
          label: s.label || null,
          pace_type: s.pace_type || null,
          duration_minutes: rawDur != null ? (s.duration_unit === "sec" ? rawDur / 60 : rawDur) : null,
          duration_unit: s.duration_unit ?? "min",
          distance_miles: s.distance_miles ? parseFloat(s.distance_miles) : null,
          distance_unit: s.distance_unit ?? "mi",
          notes: s.notes || null,
          repeat_group_id: s.repeat_group_id ?? null,
          repeat_count: s.repeat_count ?? 1,
          group_name: s.group_name || null,
          sets: s.sets ? parseInt(s.sets, 10) : null,
          reps: s.reps ? parseInt(s.reps, 10) : null,
          weight_suggestion: s.weight_suggestion || null,
          video_url: s.video_url || null,
          exercise_id: s.exercise_id || null,
          both_sides: s.both_sides ?? false,
        };
      }),
    };

    if (editing) {
      await updateLibraryWorkout(editing.id, payload);
    } else {
      await createLibraryWorkout(payload);
    }
    setFormOpen(false);
    setEditing(null);
    await load();
  }

  function handleEdit(workout: LibraryWorkoutWithSteps) {
    setEditing(workout);
    setFormOpen(true);
  }

  function handleDelete(workout: LibraryWorkoutWithSteps) {
    if (!confirm(`Delete "${workout.title}" from your library?`)) return;
    startTransition(async () => {
      await deleteLibraryWorkout(workout.id);
      await load();
    });
  }

  function handleDuplicate(workout: LibraryWorkoutWithSteps) {
    startTransition(async () => {
      await duplicateLibraryWorkout(workout.id);
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
    setBulkRunType("");
    setBulkSource("");
  }

  function handleBulkApply() {
    if (selectedIds.size === 0) return;
    const updates: { type?: WorkoutType; run_type?: RunType | null; source?: string | null } = {};
    if (bulkType) {
      updates.type = bulkType as WorkoutType;
      updates.run_type = bulkType === "run" ? ((bulkRunType as RunType) || null) : null;
    } else if (bulkRunType) {
      updates.run_type = bulkRunType as RunType;
    }
    if (bulkSource.trim()) updates.source = bulkSource.trim();
    if (!Object.keys(updates).length) return;
    startTransition(async () => {
      await bulkUpdateLibraryWorkouts(Array.from(selectedIds), updates);
      exitSelectMode();
      await load();
    });
  }

  const displayed = applySort(
    applySearch(applyWorkoutFilter(workouts, filter), search),
    sort
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Workout Library</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Build reusable workouts and add them to any plan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {isAdmin && (
            <>
              <button
                onClick={handleExport}
                disabled={workouts.length === 0}
                className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--card)] disabled:opacity-40 transition-colors"
              >
                Export CSV
              </button>
              <button
                onClick={handleExportJSON}
                disabled={workouts.length === 0}
                className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--card)] disabled:opacity-40 transition-colors"
              >
                Export JSON
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--card)] transition-colors"
              >
                Import
              </button>
            </>
          )}
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
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + New workout
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {!loading && workouts.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <p className="text-[var(--muted)]">Your library is empty.</p>
          <p className="text-sm text-[var(--muted)]">
            Create workouts here and reuse them across multiple training plans.
          </p>
          <button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="mt-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
          >
            Add your first workout
          </button>
        </div>
      )}

      {!loading && workouts.length > 0 && (
        <div className="space-y-4">
          {/* Search + sort */}
          <div className="flex gap-2 items-center">
            <input
              type="search"
              placeholder="Search workouts…"
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
              <option value="duration_desc">Longest first</option>
              <option value="duration_asc">Shortest first</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          {/* Type + source filter */}
          <WorkoutFilterBar
            filter={filter}
            onChange={setFilter}
            sources={Array.from(new Set(workouts.map((w) => w.source).filter(Boolean))) as string[]}
            hasUnsourced={workouts.some((w) => !w.source)}
          />

          {selectMode && displayed.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
              <button
                onClick={() => setSelectedIds(new Set(displayed.map((w) => w.id)))}
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
            <p className="text-sm text-[var(--muted)] py-8 text-center">
              No workouts match.
            </p>
          ) : compact ? (
            <div className="flex flex-col gap-1">
              {displayed.map((workout) => (
                <WorkoutLibraryCard
                  key={workout.id}
                  workout={workout}
                  compact
                  selectMode={selectMode}
                  selected={selectedIds.has(workout.id)}
                  onToggleSelect={toggleSelect}
                  onDetail={setDetail}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onAddToPlan={(w) => setAddToPlan(w)}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {displayed.map((workout) => (
                <WorkoutLibraryCard
                  key={workout.id}
                  workout={workout}
                  selectMode={selectMode}
                  selected={selectedIds.has(workout.id)}
                  onToggleSelect={toggleSelect}
                  onDetail={setDetail}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onAddToPlan={(w) => setAddToPlan(w)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showImport && (
        <WorkoutImportModal
          onClose={() => setShowImport(false)}
          onImported={async () => { setShowImport(false); await load(); }}
        />
      )}

      {formOpen && (
        <WorkoutLibraryForm
          existing={editing}
          allWorkouts={workouts}
          paces={paces}
          onSave={handleSave}
          onCancel={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      {detail && (
        <WorkoutDetailModal
          workout={detail}
          onClose={() => setDetail(null)}
          onEdit={(w) => { setDetail(null); handleEdit(w); }}
        />
      )}

      {addToPlan && (
        <AddToPlanModal
          workoutId={addToPlan.id}
          workoutTitle={addToPlan.title}
          onClose={() => setAddToPlan(null)}
          onAdded={() => setAddToPlan(null)}
        />
      )}

      {isPending && (
        <div className="fixed bottom-4 right-4 bg-[var(--foreground)] text-[var(--background)] text-xs px-3 py-2 rounded-lg">
          Saving…
        </div>
      )}

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl p-3 flex flex-wrap items-center gap-2 max-w-[min(90vw,44rem)]">
          <span className="text-sm font-medium whitespace-nowrap pr-1">
            {selectedIds.size} selected
          </span>
          <select
            value={bulkType}
            onChange={(e) => { setBulkType(e.target.value); setBulkRunType(""); }}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="">Type: no change</option>
            <option value="run">Run</option>
            <option value="strength">Strength</option>
            <option value="bike">Bike</option>
            <option value="swim">Swim</option>
            <option value="yoga">Yoga</option>
            <option value="elliptical">Elliptical</option>
            <option value="cross_train">Cross-Train</option>
            <option value="rest">Rest</option>
          </select>
          <select
            value={bulkRunType}
            onChange={(e) => setBulkRunType(e.target.value)}
            disabled={bulkType !== "" && bulkType !== "run"}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none disabled:opacity-40"
          >
            <option value="">Run type: no change</option>
            <option value="easy_run">Easy Run</option>
            <option value="long_run">Long Run</option>
            <option value="mp_hmp_run">MP/HMP Run</option>
            <option value="interval_run">Interval Run</option>
            <option value="threshold_run">Threshold Run</option>
            <option value="recovery_run">Recovery Run</option>
            <option value="race">Race</option>
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
            disabled={isPending || (!bulkType && !bulkRunType && !bulkSource.trim())}
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

interface WorkoutLibraryCardProps {
  workout: LibraryWorkoutWithSteps;
  compact?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onDetail: (w: LibraryWorkoutWithSteps) => void;
  onEdit: (w: LibraryWorkoutWithSteps) => void;
  onDelete: (w: LibraryWorkoutWithSteps) => void;
  onDuplicate: (w: LibraryWorkoutWithSteps) => void;
  onAddToPlan: (w: LibraryWorkoutWithSteps) => void;
}

function WorkoutLibraryCard({ workout, compact, selectMode, selected, onToggleSelect, onDetail, onEdit, onDelete, onDuplicate, onAddToPlan }: WorkoutLibraryCardProps) {
  const distanceLabel = workout.distance_miles
    ? displayDistance(workout.distance_miles, workout.distance_unit ?? "mi")
    : null;
  const durationLabel = workout.duration_minutes ? `${workout.duration_minutes} min` : null;

  if (compact) {
    return (
      <div
        onClick={() => onDetail(workout)}
        className={`rounded-lg border bg-[var(--card)] px-3 py-2.5 flex items-center gap-3 transition-colors cursor-pointer hover:border-[var(--foreground)] ${selected ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
      >
        {selectMode && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect?.(workout.id)}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 accent-[var(--accent)] w-4 h-4 cursor-pointer"
          />
        )}
        <WorkoutTypeBadges type={workout.type} run_type={workout.run_type} strength_type={workout.strength_type} compact />
        <span className="text-sm font-medium truncate flex-1 min-w-0">{workout.title}</span>
        {(distanceLabel || durationLabel) && (
          <div className="flex-shrink-0 text-right">
            {distanceLabel && <p className="text-xs font-medium leading-tight">{distanceLabel}</p>}
            {durationLabel && <p className="text-xs text-[var(--muted)] leading-tight">{durationLabel}</p>}
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(workout); }}
          title="Edit"
          className="flex-shrink-0 w-7 h-7 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] text-sm flex items-center justify-center transition-colors"
        >
          ✎
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(workout); }}
          title="Duplicate"
          className="flex-shrink-0 w-7 h-7 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] text-sm flex items-center justify-center transition-colors"
        >
          ⧉
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAddToPlan(workout); }}
          title="Add to plan"
          className="flex-shrink-0 w-7 h-7 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-base font-medium hover:opacity-90 transition-opacity flex items-center justify-center"
        >
          +
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => onDetail(workout)}
      className={`rounded-xl border bg-[var(--card)] p-4 space-y-3 flex flex-col transition-colors cursor-pointer hover:border-[var(--foreground)] ${selected ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
    >
      <div className="flex items-start justify-between gap-2">
        {selectMode && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect?.(workout.id)}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 flex-shrink-0 accent-[var(--accent)] w-4 h-4 cursor-pointer"
          />
        )}
        <div className="space-y-1 min-w-0 flex-1">
          <WorkoutTypeBadges type={workout.type} run_type={workout.run_type} strength_type={workout.strength_type} />
          <h3 className="font-medium text-sm leading-snug truncate">{workout.title}</h3>
        </div>
        {(distanceLabel || durationLabel) && (
          <div className="text-right flex-shrink-0 space-y-0.5">
            {distanceLabel && <p className="text-xs font-medium">{distanceLabel}</p>}
            {durationLabel && <p className="text-xs text-[var(--muted)]">{durationLabel}</p>}
          </div>
        )}
      </div>

      {workout.description && (
        <p className="text-xs text-[var(--muted)] line-clamp-2">{workout.description}</p>
      )}

      <div className="flex gap-2 pt-1 mt-auto">
        <button
          onClick={(e) => { e.stopPropagation(); onAddToPlan(workout); }}
          className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-1.5 text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Add to plan
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(workout); }}
          className="px-3 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--background)] transition-colors"
        >
          Edit
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(workout); }}
          className="px-3 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--background)] transition-colors"
          title="Duplicate workout"
        >
          Duplicate
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(workout); }}
          className="px-3 rounded-lg border border-[var(--border)] text-xs text-[var(--muted)] hover:text-red-500 hover:border-red-300 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
