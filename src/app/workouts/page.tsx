"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LibraryWorkoutWithSteps } from "@/types/database";
import { WorkoutLibraryForm, type WorkoutLibraryFormData } from "@/components/WorkoutLibraryForm";
import { AddToPlanModal } from "@/components/AddToPlanModal";
import { createLibraryWorkout, updateLibraryWorkout, deleteLibraryWorkout } from "@/app/actions/workoutLibrary";
import { WORKOUT_TYPE_COLORS, WORKOUT_TYPE_LABELS, RUN_TYPE_LABELS } from "@/lib/paceUtils";

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<LibraryWorkoutWithSteps[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryWorkoutWithSteps | null>(null);
  const [addToPlan, setAddToPlan] = useState<LibraryWorkoutWithSteps | null>(null);
  const [isPending, startTransition] = useTransition();

  async function load() {
    const supabase = createClient();
    const [{ data: ws }, { data: steps }] = await Promise.all([
      supabase.from("workouts").select("*").order("created_at", { ascending: false }),
      supabase.from("workout_steps").select("*").not("workout_id", "is", null).order("step_order"),
    ]);

    const stepsMap: Record<string, typeof steps> = {};
    (steps ?? []).forEach((s) => {
      if (!s.workout_id) return;
      if (!stepsMap[s.workout_id]) stepsMap[s.workout_id] = [];
      stepsMap[s.workout_id]!.push(s);
    });

    setWorkouts((ws ?? []).map((w) => ({ ...w, workout_steps: stepsMap[w.id] ?? [] })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave(data: WorkoutLibraryFormData) {
    const payload = {
      type: data.type,
      run_type: data.run_type || null,
      title: data.title,
      description: data.description || null,
      distance_miles: data.distance_miles ? parseFloat(data.distance_miles) : null,
      distance_unit: data.distance_unit ?? "mi",
      pace_type: data.pace_type || null,
      duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes, 10) : null,
      notes: data.notes || null,
      steps: data.steps.map((s) => ({
        step_type: s.step_type,
        label: s.label || null,
        pace_type: s.pace_type || null,
        duration_minutes: s.duration_minutes ? parseFloat(s.duration_minutes) : null,
        distance_miles: s.distance_miles ? parseFloat(s.distance_miles) : null,
        distance_unit: s.distance_unit ?? "mi",
        notes: s.notes || null,
        repeat_group_id: s.repeat_group_id ?? null,
        repeat_count: s.repeat_count ?? 1,
      })),
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workout Library</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Build reusable workouts and add them to any plan.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + New workout
        </button>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workouts.map((workout) => (
            <WorkoutLibraryCard
              key={workout.id}
              workout={workout}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddToPlan={(w) => setAddToPlan(w)}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <WorkoutLibraryForm
          existing={editing}
          onSave={handleSave}
          onCancel={() => { setFormOpen(false); setEditing(null); }}
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
          Deleting…
        </div>
      )}
    </div>
  );
}

interface WorkoutLibraryCardProps {
  workout: LibraryWorkoutWithSteps;
  onEdit: (w: LibraryWorkoutWithSteps) => void;
  onDelete: (w: LibraryWorkoutWithSteps) => void;
  onAddToPlan: (w: LibraryWorkoutWithSteps) => void;
}

function WorkoutLibraryCard({ workout, onEdit, onDelete, onAddToPlan }: WorkoutLibraryCardProps) {
  const typeBadge = WORKOUT_TYPE_COLORS[workout.type] ?? "bg-gray-100 text-gray-600";
  const typeLabel = workout.run_type
    ? RUN_TYPE_LABELS[workout.run_type]
    : WORKOUT_TYPE_LABELS[workout.type];

  const meta: string[] = [];
  if (workout.distance_miles) meta.push(`${workout.distance_miles} ${workout.distance_unit ?? "mi"}`);
  if (workout.pace_type) meta.push(workout.pace_type);
  if (workout.duration_minutes) meta.push(`${workout.duration_minutes} min`);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge}`}>
            {typeLabel}
          </span>
          <h3 className="font-medium text-sm leading-snug truncate">{workout.title}</h3>
        </div>
      </div>

      {workout.description && (
        <p className="text-xs text-[var(--muted)] line-clamp-2">{workout.description}</p>
      )}

      {meta.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {meta.map((m) => (
            <span key={m} className="text-xs bg-[var(--background)] border border-[var(--border)] rounded-md px-2 py-0.5">
              {m}
            </span>
          ))}
        </div>
      )}

      {workout.workout_steps.length > 0 && (
        <div className="space-y-1">
          {workout.workout_steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] flex-shrink-0" />
              <span className="capitalize">{step.label || step.step_type}</span>
              {step.duration_minutes && <span>· {step.duration_minutes} min</span>}
              {step.distance_miles && <span>· {step.distance_miles} {step.distance_unit ?? "mi"}</span>}
              {step.pace_type && <span>· {step.pace_type}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1 mt-auto">
        <button
          onClick={() => onAddToPlan(workout)}
          className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-1.5 text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Add to plan
        </button>
        <button
          onClick={() => onEdit(workout)}
          className="px-3 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--background)] transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(workout)}
          className="px-3 rounded-lg border border-[var(--border)] text-xs text-[var(--muted)] hover:text-red-500 hover:border-red-300 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
