"use client";

import { useState } from "react";
import type { Exercise } from "@/types/database";
import type { ExerciseUsageEntry } from "@/lib/exerciseUsage";
import { EXERCISE_TYPE_LABELS } from "@/lib/paceUtils";

interface DeleteExerciseModalProps {
  exercise: Exercise;
  usage: ExerciseUsageEntry[];
  historyCount: number;
  candidates: Exercise[];
  onConfirm: (replacement?: { exerciseId: string; moveHistory: boolean }) => Promise<void>;
  onCancel: () => void;
}

const KIND_LABELS: Record<ExerciseUsageEntry["kind"], string> = {
  plan: "Plan",
  scheduled: "Scheduled",
  library: "Library",
};

export function DeleteExerciseModal({
  exercise,
  usage,
  historyCount,
  candidates,
  onConfirm,
  onCancel,
}: DeleteExerciseModalProps) {
  const [mode, setMode] = useState<"replace" | "delete">("replace");
  const [search, setSearch] = useState("");
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [moveHistory, setMoveHistory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const options = candidates
    .filter((e) => e.id !== exercise.id)
    .filter((e) => !q || e.name.toLowerCase().includes(q))
    .sort((a, b) => {
      // Likely duplicates (same name) float to the top.
      const aSame = a.name.toLowerCase() === exercise.name.toLowerCase() ? 0 : 1;
      const bSame = b.name.toLowerCase() === exercise.name.toLowerCase() ? 0 : 1;
      return aSame - bSame || a.name.localeCompare(b.name);
    });
  const replacement = candidates.find((e) => e.id === replacementId) ?? null;

  async function handleConfirm() {
    if (mode === "replace" && !replacementId) { setError("Pick a replacement exercise"); return; }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(mode === "replace" && replacementId ? { exerciseId: replacementId, moveHistory } : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90dvh] sm:max-h-[85vh]">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Delete &ldquo;{exercise.name}&rdquo;</h2>
            <button onClick={onCancel} className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none">×</button>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm">
              This exercise is used in {usage.length} workout{usage.length === 1 ? "" : "s"}:
            </p>
            <ul className="max-h-36 overflow-y-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)] text-sm">
              {usage.map((u) => (
                <li key={u.key} className="px-3 py-1.5 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--muted)] w-16 shrink-0">{KIND_LABELS[u.kind]}</span>
                  <span className="min-w-0 truncate">
                    {u.workoutTitle}
                    {u.kind !== "library" && <span className="text-[var(--muted)]"> · {u.context}</span>}
                    {u.stepCount > 1 && <span className="text-[var(--muted)]"> · ×{u.stepCount}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} className="mt-0.5" />
              <span>Replace it in these workouts with another exercise</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" checked={mode === "delete"} onChange={() => setMode("delete")} className="mt-0.5" />
              <span>
                Just delete it
                <span className="block text-xs text-[var(--muted)]">Workouts keep the step&rsquo;s name but lose the link to the library.</span>
              </span>
            </label>
          </div>

          {mode === "replace" && (
            <div className="space-y-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exercises…"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                {options.length === 0 ? (
                  <p className="text-sm text-[var(--muted)] px-3 py-3 text-center">No exercises match.</p>
                ) : (
                  options.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setReplacementId(e.id)}
                      className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                        replacementId === e.id ? "bg-[var(--accent)]/15" : "hover:bg-[var(--card)]"
                      }`}
                    >
                      <span className="min-w-0 truncate flex-1">{e.name}</span>
                      {e.exercise_type && (
                        <span className="text-xs text-[var(--muted)] shrink-0">{EXERCISE_TYPE_LABELS[e.exercise_type] ?? e.exercise_type}</span>
                      )}
                      {replacementId === e.id && <span className="text-[var(--accent)] shrink-0">✓</span>}
                    </button>
                  ))
                )}
              </div>
              {historyCount > 0 && (
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={moveHistory} onChange={(e) => setMoveHistory(e.target.checked)} className="mt-0.5" />
                  <span>
                    Also move its logged history ({historyCount} session{historyCount === 1 ? "" : "s"})
                    {replacement ? <> to &ldquo;{replacement.name}&rdquo;</> : null}
                  </span>
                </label>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={busy || (mode === "replace" && !replacementId)}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {busy ? "Deleting…" : mode === "replace" ? "Replace & delete" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
