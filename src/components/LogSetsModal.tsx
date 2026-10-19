"use client";

import { useEffect, useState, useTransition } from "react";
import type { PlanWorkout, WorkoutStep } from "@/types/database";
import { getOrCreateWorkoutSession, saveLoggedSets } from "@/app/actions/strengthSessions";
import { buildSetLogForm, setLogChanges, updateSetLogRow, type SetLogExercise } from "@/lib/setLogForm";
import { loadInputLabel } from "@/lib/strengthProgression";
import { LoadInput } from "@/components/LoadInput";
import { LOAD_FORMAT_LABELS, parseDateLocal } from "@/lib/paceUtils";

interface LogSetsModalProps {
  workout: PlanWorkout;
  steps: WorkoutStep[];
  sessionSource: Parameters<typeof getOrCreateWorkoutSession>[0];
  onClose: () => void;
  /** Called after the sets are saved (and the session marked complete). */
  onSaved: () => void;
}

const inputClass =
  "w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm text-center focus:outline-none focus:border-[var(--accent)]";

/**
 * Log a strength workout's sets after the fact — every set as an editable row
 * (weight / reps / time), saved in one go — for backfilling history without
 * stepping through the live StrengthWorkoutPlayer. Reopening it edits what was logged.
 */
export function LogSetsModal({ workout, steps, sessionSource, onClose, onSaved }: LogSetsModalProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [form, setForm] = useState<SetLogExercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getOrCreateWorkoutSession(sessionSource)
      .then((result) => {
        if (cancelled) return;
        setSessionId(result.session.id);
        setForm(buildSetLogForm(steps, result.exercises));
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
    // Load once on open — the workout doesn't change while the sheet is up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(exerciseIndex: number, rowIndex: number, field: "weight" | "reps" | "seconds" | "done", value: string | boolean) {
    setForm((f) => (f ? updateSetLogRow(f, exerciseIndex, rowIndex, field, value) : f));
  }

  function handleSave() {
    if (!form || !sessionId) return;
    const { upserts, removals } = setLogChanges(form);
    startTransition(async () => {
      try {
        await saveLoggedSets(sessionId, upserts, removals);
        onSaved();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const dateLabel = parseDateLocal(sessionSource.sessionDate).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl flex flex-col max-h-[90dvh] sm:max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-[var(--border)]">
          <div className="min-w-0">
            <h2 className="font-semibold truncate">Log sets · {workout.title}</h2>
            <p className="text-xs text-[var(--muted)]">{dateLabel} · untick any set you didn&apos;t do</p>
          </div>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none">
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!form && !error && <p className="text-sm text-[var(--muted)]">Loading…</p>}
          {form && form.length === 0 && (
            <p className="text-sm text-[var(--muted)]">
              None of this workout&apos;s exercises are linked to your exercise library, so there are no sets to log.
              Mark the workout done instead.
            </p>
          )}
          {form?.map((ex, i) => (
            <div key={ex.stepId} className="rounded-lg border border-[var(--border)]">
              <div className="px-3 py-2 border-b border-[var(--border)]">
                {ex.groupName && (
                  <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{ex.groupName}</p>
                )}
                <p className="text-sm font-medium">{ex.name}</p>
                {ex.loadFormat && (
                  <p className="text-xs text-[var(--muted)]">{LOAD_FORMAT_LABELS[ex.loadFormat] ?? ex.loadFormat}</p>
                )}
              </div>
              <div className="px-3 py-2 space-y-1.5">
                <div className="grid grid-cols-[4.5rem_1fr_1fr_1.5rem] gap-2 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  <span>Set</span>
                  <span className="text-center">{ex.weighted ? loadInputLabel(ex.loadFormat) : ""}</span>
                  <span className="text-center">{ex.repsBased ? "Reps" : ex.timed ? "Seconds" : ""}</span>
                  <span />
                </div>
                {ex.rows.map((row, j) => (
                  <div
                    key={`${row.setNumber}-${row.side}`}
                    className={`grid grid-cols-[4.5rem_1fr_1fr_1.5rem] gap-2 items-center ${row.done ? "" : "opacity-50"}`}
                  >
                    <span className="text-xs text-[var(--muted)]">
                      Set {row.setNumber}
                      {row.side && ` ${row.side === "left" ? "L" : "R"}`}
                    </span>
                    {ex.weighted ? (
                      <LoadInput
                        loadFormat={ex.loadFormat}
                        value={row.weight}
                        onChange={(v) => update(i, j, "weight", v)}
                        disabled={!row.done}
                        aria-label={`Set ${row.setNumber} weight`}
                        className={inputClass}
                      />
                    ) : (
                      <span />
                    )}
                    {ex.repsBased || ex.timed ? (
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={ex.repsBased ? row.reps : row.seconds}
                        onChange={(e) => update(i, j, ex.repsBased ? "reps" : "seconds", e.target.value)}
                        disabled={!row.done}
                        aria-label={`Set ${row.setNumber} ${ex.repsBased ? "reps" : "seconds"}`}
                        className={inputClass}
                      />
                    ) : (
                      <span />
                    )}
                    <input
                      type="checkbox"
                      checked={row.done}
                      onChange={(e) => update(i, j, "done", e.target.checked)}
                      aria-label={`Set ${row.setNumber} done`}
                      className="w-4 h-4 accent-[var(--accent)]"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 p-4 sm:p-5 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:border-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form || form.length === 0 || isPending}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save sets"}
          </button>
        </div>
      </div>
    </div>
  );
}
