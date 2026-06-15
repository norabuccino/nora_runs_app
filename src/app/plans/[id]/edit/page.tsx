"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { TrainingPlan, PlanWorkout, WorkoutWithSteps, RunningPace } from "@/types/database";
import { WeekGrid } from "@/components/WeekGrid";
import { WorkoutForm, type WorkoutFormData } from "@/components/WorkoutForm";
import { LibraryPickerModal } from "@/components/LibraryPickerModal";
import { createWorkout, updateWorkout, deleteWorkout, updateDayLogic, batchUpdateWorkoutPositions, copyWorkoutToDays } from "@/app/actions/workouts";
import { createLibraryWorkout } from "@/app/actions/workoutLibrary";
import { updatePlan } from "@/app/actions/plans";
import { DAY_NAMES } from "@/lib/paceUtils";
import { CopyToDaysModal } from "@/components/CopyToDaysModal";

type AddFlow =
  | { step: "idle" }
  | { step: "picking"; weekNumber: number; dayOfWeek: number }
  | { step: "library"; weekNumber: number; dayOfWeek: number }
  | { step: "form"; weekNumber: number; dayOfWeek: number; existing: WorkoutWithSteps | null };

export default function EditPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutWithSteps[]>([]);
  const [paces, setPaces] = useState<RunningPace[]>([]);
  const [loading, setLoading] = useState(true);
  const [flow, setFlow] = useState<AddFlow>({ step: "idle" });
  const [copying, setCopying] = useState<PlanWorkout | null>(null);
  const [isPending, startTransition] = useTransition();
  const [planName, setPlanName] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [planSaving, setPlanSaving] = useState(false);

  async function load() {
    const supabase = createClient();
    const [{ data: p }, { data: w }, { data: s }, { data: pac }] = await Promise.all([
      supabase.from("training_plans").select("*").eq("id", id).single(),
      supabase.from("plan_workouts").select("*").eq("plan_id", id).order("sort_order"),
      supabase.from("workout_steps").select("*").order("step_order"),
      supabase.from("running_paces").select("*").order("created_at"),
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
    if (p) {
      setPlanName((prev) => prev || p.name);
      setPlanDescription((prev) => prev || (p.description ?? ""));
    }
    setWorkouts(workoutsWithSteps);
    setPaces(pac ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleSavePlanMeta() {
    if (!planName.trim()) return;
    setPlanSaving(true);
    const desc = planDescription.trim() || undefined;
    await updatePlan(id, { name: planName.trim(), description: desc });
    setPlan((p) => p ? { ...p, name: planName.trim(), description: desc ?? null } : p);
    setPlanSaving(false);
  }

  function openAdd(weekNumber: number, dayOfWeek: number) {
    setFlow({ step: "picking", weekNumber, dayOfWeek });
  }

  function openEdit(workout: PlanWorkout) {
    const full = workouts.find((w) => w.id === workout.id) ?? null;
    setFlow({ step: "form", weekNumber: workout.week_number, dayOfWeek: workout.day_of_week, existing: full });
  }

  function handleReorder(updates: { id: string; week_number: number; day_of_week: number; sort_order: number }[]) {
    startTransition(async () => {
      await batchUpdateWorkoutPositions(id, updates);
      await load();
    });
  }

  function handleDayLogicChange(weekNumber: number, dayOfWeek: number, logic: "and" | "or") {
    startTransition(async () => {
      await updateDayLogic(id, weekNumber, dayOfWeek, logic);
      await load();
    });
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
      distance_unit: s.distance_unit ?? "mi",
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
      distance_unit: data.distance_unit ?? "mi",
      pace_type: data.pace_type || null,
      duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes, 10) : null,
      notes: data.notes || null,
      sort_order: data.sort_order,
      steps,
    };

    const existing = flow.step === "form" ? flow.existing : null;
    if (existing) {
      await updateWorkout(existing.id, payload);
    } else {
      const nextSortOrder = workouts.filter(
        (w) => w.week_number === data.week_number && w.day_of_week === data.day_of_week
      ).length;
      await createWorkout({ ...payload, sort_order: nextSortOrder });
    }

    if (data.saveToLibrary) {
      await createLibraryWorkout({
        type: data.type,
        run_type: data.run_type || null,
        title: data.title,
        description: data.description || null,
        distance_miles: data.distance_miles ? parseFloat(data.distance_miles) : null,
        distance_unit: data.distance_unit ?? "mi",
        pace_type: data.pace_type || null,
        duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes, 10) : null,
        notes: data.notes || null,
        steps,
      });
    }

    setFlow({ step: "idle" });
    await load();
  }

  if (loading) return <div className="text-sm text-[var(--muted)]">Loading…</div>;
  if (!plan) return <div className="text-sm text-red-500">Plan not found.</div>;

  const weeks = Array.from({ length: plan.total_weeks }, (_, i) => i + 1);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={`/plans/${id}`} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          ← Back to plan
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/plans/${id}`)}
            className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Done editing
          </button>
        </div>
      </div>

      {/* Plan name + description */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <h2 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Plan details</h2>
        <div className="space-y-2">
          <input
            type="text"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder="Plan name"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <textarea
            value={planDescription}
            onChange={(e) => setPlanDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <button
          onClick={handleSavePlanMeta}
          disabled={planSaving || !planName.trim()}
          className="px-4 py-1.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] disabled:opacity-50 transition-colors"
        >
          {planSaving ? "Saving…" : "Save"}
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
            onDayLogicChange={handleDayLogicChange}
            onReorder={handleReorder}
            onCopy={setCopying}
          />
        ))}
      </div>

      {/* Step 1: Choose how to add */}
      {flow.step === "picking" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                Add workout — Wk {flow.weekNumber}, {DAY_NAMES[flow.dayOfWeek]}
              </h2>
              <button
                onClick={() => setFlow({ step: "idle" })}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFlow({ ...flow, step: "library" })}
                className="rounded-xl border border-[var(--border)] p-4 text-left hover:border-[var(--foreground)] transition-colors space-y-1.5"
              >
                <p className="text-sm font-medium">From library</p>
                <p className="text-xs text-[var(--muted)]">Pick a saved workout</p>
              </button>
              <button
                onClick={() => setFlow({ ...flow, step: "form", existing: null })}
                className="rounded-xl border border-[var(--border)] p-4 text-left hover:border-[var(--foreground)] transition-colors space-y-1.5"
              >
                <p className="text-sm font-medium">Create new</p>
                <p className="text-xs text-[var(--muted)]">Build from scratch</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2a: Pick from library */}
      {flow.step === "library" && (
        <LibraryPickerModal
          planId={id}
          weekNumber={flow.weekNumber}
          dayOfWeek={flow.dayOfWeek}
          onAdded={async () => { setFlow({ step: "idle" }); await load(); }}
          onCancel={() => setFlow({ step: "picking", weekNumber: flow.weekNumber, dayOfWeek: flow.dayOfWeek })}
        />
      )}

      {/* Step 2b: Create new (or edit existing) */}
      {flow.step === "form" && (
        <WorkoutForm
          planId={id}
          weekNumber={flow.weekNumber}
          dayOfWeek={flow.dayOfWeek}
          existing={flow.existing}
          paces={paces}
          showSaveToLibrary={!flow.existing}
          onSave={handleSave}
          onCancel={() => setFlow({ step: "idle" })}
        />
      )}

      {copying && plan && (
        <CopyToDaysModal
          workout={copying}
          planId={id}
          totalWeeks={plan.total_weeks}
          onClose={() => setCopying(null)}
          onCopied={async () => { setCopying(null); await load(); }}
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
