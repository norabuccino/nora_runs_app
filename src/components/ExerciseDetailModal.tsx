"use client";

import { MUSCLE_GROUP_LABELS, sortMuscleGroups } from "@/lib/muscleGroups";
import { EQUIPMENT_LABELS, sortEquipment } from "@/lib/equipment";
import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Exercise } from "@/types/database";
import { EXERCISE_TYPE_LABELS, EXERCISE_TYPE_COLORS, LOADING_CATEGORY_LABELS } from "@/lib/paceUtils";
import { getExerciseHistory, updateLoggedSets, type ExerciseHistoryEntry } from "@/app/actions/strengthSessions";
import { formatLoad, deriveCurrentLoad, formatActualSets, isBandLoad, loadInputLabel } from "@/lib/strengthProgression";
import { LoadInput } from "@/components/LoadInput";
import { BandColorsLink } from "@/components/BandColorsModal";
import { useBandColors } from "@/hooks/useBandColors";
import { setLogDrafts, setLogEdits, type SetLogDraft } from "@/lib/setLogForm";

interface LibraryUsage {
  workout_id: string;
  title: string;
}

interface PlanUsage {
  plan_id: string;
  plan_name: string;
  workout_title: string;
  count: number;
}

const setInputClass =
  "w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-center focus:outline-none focus:border-[var(--accent)]";

/** Inline editor for one past session's logged sets of this exercise. */
function SessionSetsEditor({ entry, onSaved, onCancel }: { entry: ExerciseHistoryEntry; onSaved: () => void; onCancel: () => void }) {
  const [drafts, setDrafts] = useState<Record<string, SetLogDraft>>(() => setLogDrafts(entry.sets));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const showReps = entry.plannedReps != null || entry.sets.some((s) => s.reps_completed != null);
  const showSeconds = !showReps && (entry.plannedDurationSeconds != null || entry.sets.some((s) => s.duration_seconds != null));

  function set(id: string, field: keyof SetLogDraft, value: string) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));
  }

  function save() {
    startTransition(async () => {
      try {
        await updateLoggedSets(setLogEdits(entry.sets, drafts));
        onSaved();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="px-3 pb-3 space-y-1.5">
      <div className="grid grid-cols-[4rem_1fr_1fr] gap-2 text-[10px] uppercase tracking-wide text-[var(--muted)]">
        <span>Set</span>
        <span className="text-center">{loadInputLabel(entry.loadFormat)}</span>
        <span className="text-center">{showReps ? "Reps" : showSeconds ? "Seconds" : ""}</span>
      </div>
      {entry.sets.map((s) => (
        <div key={s.id} className="grid grid-cols-[4rem_1fr_1fr] gap-2 items-center">
          <span className="text-xs text-[var(--muted)]">
            Set {s.set_number}
            {s.side && ` ${s.side === "left" ? "L" : "R"}`}
          </span>
          <LoadInput
            loadFormat={entry.loadFormat}
            value={drafts[s.id]?.weight ?? ""}
            onChange={(v) => set(s.id, "weight", v)}
            aria-label={`Set ${s.set_number} weight`}
            className={setInputClass}
          />
          {showReps || showSeconds ? (
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={drafts[s.id]?.[showReps ? "reps" : "seconds"] ?? ""}
              onChange={(e) => set(s.id, showReps ? "reps" : "seconds", e.target.value)}
              aria-label={`Set ${s.set_number} ${showReps ? "reps" : "seconds"}`}
              className={setInputClass}
            />
          ) : (
            <span />
          )}
        </div>
      ))}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-3 pt-1 text-xs">
        <button onClick={onCancel} className="text-[var(--muted)] hover:text-[var(--foreground)]">
          Cancel
        </button>
        <button onClick={save} disabled={isPending} className="font-medium text-[var(--accent)] hover:underline disabled:opacity-50">
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

interface ExerciseDetailModalProps {
  exercise: Exercise;
  onClose: () => void;
  onEdit?: (e: Exercise) => void;
  /** When set (e.g. opened from the exercise picker), shows an "Add exercise" button and stacks above the picker. */
  onSelect?: (e: Exercise) => void;
}

export function ExerciseDetailModal({ exercise, onClose, onEdit, onSelect }: ExerciseDetailModalProps) {
  const [libraryUsage, setLibraryUsage] = useState<LibraryUsage[]>([]);
  const [planUsage, setPlanUsage] = useState<PlanUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<ExerciseHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(exercise.track_load);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const bandColors = useBandColors();
  const [historyVersion, setHistoryVersion] = useState(0); // bumped after an edit to refetch

  useEffect(() => {
    if (!exercise.track_load) return;
    let cancelled = false;
    setLoadingHistory(true);
    getExerciseHistory(exercise.id).then((entries) => {
      if (!cancelled) {
        setHistory(entries);
        setLoadingHistory(false);
      }
    });
    return () => { cancelled = true; };
  }, [exercise.id, exercise.track_load, historyVersion]);

  useEffect(() => {
    async function fetchUsage() {
      const supabase = createClient();

      const [{ data: libRows }, { data: planRows }] = await Promise.all([
        supabase
          .from("workout_steps")
          .select("workout_id, workouts(id, title)")
          .eq("exercise_id", exercise.id)
          .not("workout_id", "is", null),
        supabase
          .from("workout_steps")
          .select("plan_workout_id, plan_workouts(id, title, plan_id, training_plans(id, name, source_plan_id))")
          .eq("exercise_id", exercise.id)
          .not("plan_workout_id", "is", null),
      ]);

      // Deduplicate library workouts
      const libSeen = new Map<string, LibraryUsage>();
      for (const row of (libRows ?? []) as unknown as { workout_id: string; workouts: { id: string; title: string } }[]) {
        if (row.workouts && !libSeen.has(row.workout_id)) {
          libSeen.set(row.workout_id, { workout_id: row.workout_id, title: row.workouts.title });
        }
      }
      setLibraryUsage(Array.from(libSeen.values()));

      // Deduplicate by plan_id, excluding personal plan copies
      const planSeen = new Map<string, PlanUsage>();
      for (const row of (planRows ?? []) as unknown as {
        plan_workouts: { id: string; title: string; plan_id: string; training_plans: { id: string; name: string; source_plan_id: string | null } } | null;
      }[]) {
        const pw = row.plan_workouts;
        if (!pw?.training_plans) continue;
        if (pw.training_plans.source_plan_id !== null) continue; // skip personal copies
        const planId = pw.plan_id;
        if (planSeen.has(planId)) {
          planSeen.get(planId)!.count++;
        } else {
          planSeen.set(planId, {
            plan_id: planId,
            plan_name: pw.training_plans.name,
            workout_title: pw.title,
            count: 1,
          });
        }
      }
      setPlanUsage(Array.from(planSeen.values()));
      setLoading(false);
    }

    fetchUsage();
  }, [exercise.id]);

  const typeBadge = exercise.exercise_type
    ? EXERCISE_TYPE_COLORS[exercise.exercise_type] ?? "bg-gray-100 text-gray-600"
    : null;
  const typeLabel = exercise.exercise_type
    ? EXERCISE_TYPE_LABELS[exercise.exercise_type] ?? exercise.exercise_type
    : null;

  const hasUsage = libraryUsage.length > 0 || planUsage.length > 0;
  const currentLoad = history[0] ? deriveCurrentLoad(history[0].sets) : null;
  const currentLoadLabel = currentLoad != null ? formatLoad(currentLoad, history[0].loadFormat, bandColors) : null;

  return (
    <div className={`fixed inset-0 ${onSelect ? "z-[70]" : "z-50"} flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm`}>
      <div className="w-full sm:max-w-lg bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90dvh] sm:max-h-[90vh]">
        <div className="p-4 sm:p-5 space-y-4">

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {typeBadge && typeLabel && (
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge}`}>
                    {typeLabel}
                  </span>
                )}
                {exercise.is_private && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    🔒 Private
                  </span>
                )}
                {exercise.track_load && exercise.loading_category && (
                  <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--muted)]">
                    {LOADING_CATEGORY_LABELS[exercise.loading_category] ?? exercise.loading_category}
                  </span>
                )}
              </div>
              <h2 className="font-semibold text-lg leading-snug">{exercise.name}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onEdit && (
                <button
                  onClick={() => onEdit(exercise)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--card)] transition-colors"
                >
                  Edit
                </button>
              )}
              <button
                onClick={onClose}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {onSelect && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onSelect(exercise)}
                className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Add exercise
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
              >
                Back
              </button>
            </div>
          )}

          {/* Description */}
          {exercise.description && (
            <p className="text-sm text-[var(--muted)] leading-relaxed">{exercise.description}</p>
          )}

          {/* Muscle groups */}
          {exercise.muscle_groups?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sortMuscleGroups(exercise.muscle_groups).map((g) => (
                <span key={g} className="px-2 py-0.5 rounded-full border border-[var(--border)] text-xs text-[var(--muted)]">
                  {MUSCLE_GROUP_LABELS[g]}
                </span>
              ))}
            </div>
          )}

          {/* Equipment */}
          {sortEquipment(exercise.equipment).length > 0 && (
            <p className="text-xs text-[var(--muted)]">
              <span className="font-medium">Equipment:</span> {sortEquipment(exercise.equipment).map((k) => EQUIPMENT_LABELS[k]).join(", ")}
            </p>
          )}

          {/* Source */}
          {exercise.sources?.length > 0 && (
            <p className="text-xs text-[var(--muted)]">
              <span className="font-medium">{exercise.sources.length > 1 ? "Sources:" : "Source:"}</span> {exercise.sources.join(", ")}
            </p>
          )}

          {/* Video */}
          {exercise.video_url && (
            <a
              href={exercise.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
            >
              ▶ Watch video
            </a>
          )}

          {/* Strength history */}
          {exercise.track_load && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                  Strength history
                  {isBandLoad(exercise.load_format) && (
                    <span className="normal-case tracking-normal font-normal ml-2">
                      <BandColorsLink />
                    </span>
                  )}
                </p>
                {currentLoadLabel && (
                  <p className="text-xs text-[var(--muted)]">
                    Current: <span className="font-medium text-[var(--foreground)]">{currentLoadLabel}</span>
                  </p>
                )}
              </div>
              {loadingHistory ? (
                <p className="text-xs text-[var(--muted)]">Loading…</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">No logged performances yet.</p>
              ) : (
                <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                  {history.map((entry) => {
                    const load = deriveCurrentLoad(entry.sets);
                    const loadLabel = load != null ? formatLoad(load, entry.loadFormat, bandColors) : null;
                    const actual = formatActualSets(entry.sets);
                    const editing = editingSession === entry.sessionId;
                    return (
                      <div key={entry.sessionId} className={editing ? "bg-[var(--card)]" : ""}>
                        <button
                          onClick={() => setEditingSession(editing ? null : entry.sessionId)}
                          disabled={entry.sets.length === 0}
                          title={entry.sets.length ? "Edit the logged sets" : undefined}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 text-xs text-left hover:bg-[var(--card)] transition-colors disabled:hover:bg-transparent"
                        >
                          <div className="min-w-0">
                            <p className="font-medium">{entry.sessionDate} · {entry.workoutTitle}</p>
                            {actual && <p className="text-[var(--muted)] mt-0.5">{actual}</p>}
                          </div>
                          <span className="flex items-center gap-2 shrink-0">
                            {loadLabel && <span className="font-medium">{loadLabel}</span>}
                            {entry.sets.length > 0 && <span className="text-[var(--muted)]">{editing ? "▴" : "✎"}</span>}
                          </span>
                        </button>
                        {editing && (
                          <SessionSetsEditor
                            entry={entry}
                            onCancel={() => setEditingSession(null)}
                            onSaved={() => {
                              setEditingSession(null);
                              setHistoryVersion((v) => v + 1);
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Library workouts */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Used in workout library</p>
            {loading ? (
              <p className="text-xs text-[var(--muted)]">Loading…</p>
            ) : libraryUsage.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">Not used in any library workouts.</p>
            ) : (
              <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                {libraryUsage.map((u) => (
                  <div key={u.workout_id} className="px-3 py-2 text-xs font-medium">
                    {u.title}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Plan workouts */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Used in plans</p>
            {loading ? (
              <p className="text-xs text-[var(--muted)]">Loading…</p>
            ) : planUsage.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">Not used in any plans.</p>
            ) : (
              <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                {planUsage.map((u) => (
                  <div key={u.plan_id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="font-medium">{u.plan_name}</span>
                    <span className="text-[var(--muted)]">
                      {u.count > 1 ? `${u.count} workouts` : u.workout_title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
