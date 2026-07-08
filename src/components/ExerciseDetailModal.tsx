"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Exercise } from "@/types/database";
import { EXERCISE_TYPE_LABELS, EXERCISE_TYPE_COLORS } from "@/lib/paceUtils";

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

interface ExerciseDetailModalProps {
  exercise: Exercise;
  onClose: () => void;
  onEdit: (e: Exercise) => void;
}

export function ExerciseDetailModal({ exercise, onClose, onEdit }: ExerciseDetailModalProps) {
  const [libraryUsage, setLibraryUsage] = useState<LibraryUsage[]>([]);
  const [planUsage, setPlanUsage] = useState<PlanUsage[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
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
              </div>
              <h2 className="font-semibold text-lg leading-snug">{exercise.name}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onEdit(exercise)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--card)] transition-colors"
              >
                Edit
              </button>
              <button
                onClick={onClose}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {/* Description */}
          {exercise.description && (
            <p className="text-sm text-[var(--muted)] leading-relaxed">{exercise.description}</p>
          )}

          {/* Source */}
          {exercise.source && (
            <p className="text-xs text-[var(--muted)]">
              <span className="font-medium">Source:</span> {exercise.source}
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
