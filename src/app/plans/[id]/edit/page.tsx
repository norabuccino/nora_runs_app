"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { TrainingPlan, PlanWorkout, WorkoutWithSteps } from "@/types/database";
import { WeekGrid } from "@/components/WeekGrid";
import { WorkoutForm, type WorkoutFormData } from "@/components/WorkoutForm";
import { WorkoutImportModal } from "@/components/WorkoutImportModal";
import { createWorkout, updateWorkout, deleteWorkout } from "@/app/actions/workouts";

export default function EditPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutWithSteps[]>([]);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState<{
    open: boolean;
    weekNumber: number;
    dayOfWeek: number;
    existing: WorkoutWithSteps | null;
  }>({ open: false, weekNumber: 1, dayOfWeek: 0, existing: null });
  const [showImport, setShowImport] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function load() {
    const supabase = createClient();
    const [{ data: p }, { data: w }, { data: s }] = await Promise.all([
      supabase.from("training_plans").select("*").eq("id", id).single(),
      supabase.from("plan_workouts").select("*").eq("plan_id", id).order("sort_order"),
      supabase.from("workout_steps").select("*").order("step_order"),
    ]);

    const stepsMap: Record<string, typeof s> = {};
    (s ?? []).forEach((step) => {
      if (!stepsMap[step.plan_workout_id]) stepsMap[step.plan_workout_id] = [];
      stepsMap[step.plan_workout_id]!.push(step);
    });

    const workoutsWithSteps: WorkoutWithSteps[] = (w ?? []).map((wk) => ({
      ...wk,
      workout_steps: stepsMap[wk.id] ?? [],
    }));

    setPlan(p);
    setWorkouts(workoutsWithSteps);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  function openAdd(weekNumber: number, dayOfWeek: number) {
    setFormState({ open: true, weekNumber, dayOfWeek, existing: null });
  }

  function openEdit(workout: PlanWorkout) {
    const full = workouts.find((w) => w.id === workout.id) ?? null;
    setFormState({ open: true, weekNumber: workout.week_number, dayOfWeek: workout.day_of_week, existing: full });
  }

  function handleDelete(workout: PlanWorkout) {
    if (!confirm(`Delete "${workout.title}"?`)) return;
    startTransition(async () => {
      await deleteWorkout(workout.id, id);
      await load();
    });
  }

  async function handleSave(data: WorkoutFormData) {
    const steps = data.steps.map((s) => ({
      step_type: s.step_type,
      label: s.label || null,
      pace_type: s.pace_type || null,
      duration_minutes: s.duration_minutes ? parseFloat(s.duration_minutes) : null,
      distance_miles: s.distance_miles ? parseFloat(s.distance_miles) : null,
      notes: s.notes || null,
      repeat_group_id: s.repeat_group_id ?? null,
      repeat_count: s.repeat_count ?? 1,
    }));

    const payload = {
      plan_id: id,
      week_number: data.week_number,
      day_of_week: data.day_of_week,
      type: data.type,
      run_type: data.run_type || null,
      title: data.title,
      description: data.description || null,
      distance_miles: data.distance_miles ? parseFloat(data.distance_miles) : null,
      pace_type: data.pace_type || null,
      duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes, 10) : null,
      notes: data.notes || null,
      sort_order: data.sort_order,
      steps,
    };

    if (formState.existing) {
      await updateWorkout(formState.existing.id, payload);
    } else {
      await createWorkout(payload);
    }
    setFormState((s) => ({ ...s, open: false }));
    await load();
  }

  if (loading) return <div className="text-sm text-[var(--muted)]">Loading…</div>;
  if (!plan) return <div className="text-sm text-red-500">Plan not found.</div>;

  const weeks = Array.from({ length: plan.total_weeks }, (_, i) => i + 1);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-0.5">
          <Link href={`/plans/${id}`} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
            ← {plan.name}
          </Link>
          <h1 className="text-2xl font-bold">Edit plan</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--card)] transition-colors"
          >
            Import workouts
          </button>
          <button
            onClick={() => router.push(`/plans/${id}`)}
            className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Done editing
          </button>
        </div>
      </div>

      <p className="text-sm text-[var(--muted)]">
        Click <strong>+ Add</strong> in any day cell to add a workout, or click <strong>Edit</strong> on an existing one.
      </p>

      <div className="space-y-10 overflow-x-auto pb-4">
        {weeks.map((weekNum) => (
          <WeekGrid
            key={weekNum}
            weekNumber={weekNum}
            workouts={workouts}
            mode="edit"
            onEdit={openEdit}
            onDelete={handleDelete}
            onAddWorkout={openAdd}
          />
        ))}
      </div>

      {formState.open && (
        <WorkoutForm
          planId={id}
          weekNumber={formState.weekNumber}
          dayOfWeek={formState.dayOfWeek}
          existing={formState.existing}
          onSave={handleSave}
          onCancel={() => setFormState((s) => ({ ...s, open: false }))}
        />
      )}

      {showImport && (
        <WorkoutImportModal
          planId={id}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            setShowImport(false);
            await load();
          }}
        />
      )}

      {isPending && (
        <div className="fixed bottom-4 right-4 bg-[var(--foreground)] text-[var(--background)] text-xs px-3 py-2 rounded-lg">
          Saving…
        </div>
      )}
    </div>
  );
}
