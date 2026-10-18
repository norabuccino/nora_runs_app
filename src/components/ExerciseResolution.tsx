"use client";

// Matching pasted exercise names to the exercise library, shared by the
// workout form's "Paste exercises" dialog and the admin bulk import.

import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { ExercisePickerModal, type ExercisePickResult } from "@/components/ExercisePickerModal";
import { matchExercise, normalizeExerciseName, type ExerciseMatch } from "@/lib/exerciseMatch";
import type { ExerciseResolution, ParsedExercise } from "@/lib/workoutTextImport";

export type LibraryExercise = { id: string; name: string; video_url: string | null };

export interface ResolvedExercise {
  key: string;
  /** Null until the user decides (no exact library match). */
  choice: ExerciseResolution | null;
  match: ExerciseMatch<LibraryExercise> | null;
}

/**
 * Loads the exercise library and tracks the user's decision per typed name
 * (normalized, so one decision covers every row with that name).
 */
export function useExerciseResolver(): {
  loading: boolean;
  resolve: (ex: ParsedExercise) => ResolvedExercise;
  choose: (key: string, choice: ExerciseResolution) => void;
  openPicker: (key: string, name: string, tab: "library" | "new") => void;
  pickerModal: ReactNode;
} {
  const [exercises, setExercises] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [choices, setChoices] = useState<Record<string, ExerciseResolution>>({});
  const [picker, setPicker] = useState<{ key: string; name: string; tab: "library" | "new" } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("exercises").select("id, name, video_url").order("name");
      setExercises(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  function resolve(ex: ParsedExercise): ResolvedExercise {
    const key = normalizeExerciseName(ex.name);
    if (ex.isRest) return { key, choice: { exercise_id: "", label: "Rest", video_url: "" }, match: null };
    const match = matchExercise(ex.name, exercises);
    const chosen = choices[key];
    if (chosen) return { key, choice: chosen, match };
    if (match.exercise) {
      const e = match.exercise;
      return { key, choice: { exercise_id: e.id, label: e.name, video_url: e.video_url ?? "" }, match };
    }
    return { key, choice: null, match };
  }

  function choose(key: string, choice: ExerciseResolution) {
    setChoices((prev) => ({ ...prev, [key]: choice }));
  }

  function handlePicked(result: ExercisePickResult) {
    if (!picker) return;
    if (result.exercise_id && !exercises.some((e) => e.id === result.exercise_id)) {
      setExercises((prev) => [...prev, { id: result.exercise_id, name: result.name, video_url: result.video_url || null }]);
    }
    choose(picker.key, { exercise_id: result.exercise_id, label: result.name, video_url: result.video_url });
    setPicker(null);
  }

  const pickerModal = picker ? (
    <ExercisePickerModal
      key={`${picker.key}-${picker.tab}`}
      initialTab={picker.tab}
      initialName={picker.name}
      onSelect={handlePicked}
      onCancel={() => setPicker(null)}
    />
  ) : null;

  return { loading, resolve, choose, openPicker: (key, name, tab) => setPicker({ key, name, tab }), pickerModal };
}

const btn = "text-xs px-2 py-0.5 rounded-md border border-[var(--border)] hover:bg-[var(--card)] transition-colors";

/** One parsed exercise: what it matched (or "?"), its prescription, and the decision buttons. */
export function ResolvedExerciseRow({
  ex,
  summary,
  resolved,
  onChoose,
  onOpenPicker,
}: {
  ex: ParsedExercise;
  summary: string;
  resolved: ResolvedExercise;
  onChoose: (key: string, choice: ExerciseResolution) => void;
  onOpenPicker: (key: string, name: string, tab: "library" | "new") => void;
}) {
  const { key, choice, match } = resolved;
  const isLibrary = !!choice?.exercise_id;
  return (
    <li className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm">
            {ex.isRest ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Rest</span>
            ) : choice ? (
              <>
                <span className={isLibrary ? "text-[var(--accent)]" : "text-[var(--muted)]"}>{isLibrary ? "✓" : "○"}</span>{" "}
                <span className="font-medium">{choice.label}</span>
                {!isLibrary && <span className="text-xs text-[var(--muted)]"> · one-off, not in library</span>}
                {normalizeExerciseName(choice.label) !== key && <span className="text-xs text-[var(--muted)]"> · typed “{ex.name}”</span>}
              </>
            ) : (
              <>
                <span className="text-amber-600 dark:text-amber-400">?</span> <span className="font-medium">{ex.name}</span>
                <span className="text-xs text-[var(--muted)]"> · not in your library</span>
              </>
            )}
          </p>
          {summary && <p className="text-xs text-[var(--muted)]">{summary}</p>}
        </div>
        {choice && !ex.isRest && (
          <button type="button" onClick={() => onOpenPicker(key, ex.name, "library")} className={`${btn} shrink-0`}>
            Change
          </button>
        )}
      </div>

      {!choice && (
        <div className="flex flex-wrap items-center gap-1.5">
          {match?.suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChoose(key, { exercise_id: s.id, label: s.name, video_url: s.video_url ?? "" })}
              className={`${btn} border-[var(--accent)] text-[var(--accent)]`}
            >
              Use “{s.name}”
            </button>
          ))}
          <button type="button" onClick={() => onOpenPicker(key, ex.name, "new")} className={btn}>
            + Create new exercise
          </button>
          <button type="button" onClick={() => onOpenPicker(key, ex.name, "library")} className={btn}>
            Pick from library
          </button>
          <button type="button" onClick={() => onChoose(key, { exercise_id: "", label: ex.name, video_url: "" })} className={btn}>
            Keep as one-off
          </button>
        </div>
      )}
    </li>
  );
}
