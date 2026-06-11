"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { TrainingPlan, PlanWorkout } from "@/types/database";
import { WeekGrid } from "@/components/WeekGrid";
import { WorkoutForm, type WorkoutFormData } from "@/components/WorkoutForm";
import { createWorkout, updateWorkout, deleteWorkout } from "@/app/actions/workouts";

export default function EditPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [workouts, setWorkouts] = useState<PlanWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState<{
    open: boolean;
    weekNumber: number;
    dayOfWeek: number;
    existing: PlanWorkout | null;
  }>({ open: false, weekNumber: 1, dayOfWeek: 0, existing: null });
  const [isPending, startTransition] = useTransition();

  async function load() {
    const supabase = createClient();
    const [{ data: p }, { data: w }] = await Promise.all([
      supabase.from("training_plans").select("*").eq("id", id).single(),
      supabase.from("plan_workouts").select("*").eq("plan_id", id).order("sort_order"),
    ]);
    setPlan(p);
    setWorkouts(w ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  function openAdd(weekNumber: number, dayOfWeek: number) {
    setFormState({ open: true, weekNumber, dayOfWeek, existing: null });
  }

  function openEdit(workout: PlanWorkout) {
    setFormState({ open: true, weekNumber: workout.week_number, dayOfWeek: workout.day_of_week, existing: workout });
  }

  function handleDelete(workout: PlanWorkout) {
    if (!confirm(`Delete "${workout.title}"?`)) return;
    startTransition(async () => {
      await deleteWorkout(workout.id, id);
      await load();
    });
  }

  async function handleSave(data: WorkoutFormData) {
    const payload = {
      plan_id: id,
      week_number: data.week_number,
      day_of_week: data.day_of_week,
      type: data.type,
      title: data.title,
      description: data.description || null,
      distance_miles: data.distance_miles ? parseFloat(data.distance_miles) : null,
      pace_type: data.pace_type || null,
      duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes, 10) : null,
      notes: data.notes || null,
      sort_order: data.sort_order,
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
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Link href={`/plans/${id}`} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
            ← {plan.name}
          </Link>
          <h1 className="text-2xl font-bold">Edit plan</h1>
        </div>
        <button
          onClick={() => router.push(`/plans/${id}`)}
          className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Done editing
        </button>
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

      {isPending && (
        <div className="fixed bottom-4 right-4 bg-[var(--foreground)] text-[var(--background)] text-xs px-3 py-2 rounded-lg">
          Saving…
        </div>
      )}
    </div>
  );
}
