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
import { updatePlan, upsertWeekPurpose } from "@/app/actions/plans";
import { DIFFICULTY_LABELS } from "@/lib/paceUtils";
import type { DifficultyType } from "@/types/database";
import { CopyToDaysModal } from "@/components/CopyToDaysModal";

type AddFlow =
  | { step: "idle" }
  | { step: "library"; weekNumber: number; dayOfWeek: number }
  | { step: "form"; weekNumber: number; dayOfWeek: number; existing: WorkoutWithSteps | null };

export default function EditPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutWithSteps[]>([]);
  const [paces, setPaces] = useState<RunningPace[]>([]);
  const [weekNotes, setWeekNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [flow, setFlow] = useState<AddFlow>({ step: "idle" });
  const [copying, setCopying] = useState<PlanWorkout | null>(null);
  const [isPending, startTransition] = useTransition();
  const [planName, setPlanName] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [planDifficulty, setPlanDifficulty] = useState<DifficultyType | "">("");
  const [planSource, setPlanSource] = useState("");
  const [planSaving, setPlanSaving] = useState(false);

  async function load() {
    const supabase = createClient();
    const [{ data: p }, { data: w }, { data: s }, { data: pac }, { data: notes }, { data: { user } }] = await Promise.all([
      supabase.from("training_plans").select("*").eq("id", id).single(),
      supabase.from("plan_workouts").select("*").eq("plan_id", id).order("sort_order"),
      supabase.from("workout_steps").select("*").order("step_order"),
      supabase.from("running_paces").select("*").order("created_at"),
      supabase.from("plan_week_notes").select("*").eq("plan_id", id),
      supabase.auth.getUser(),
    ]);

    // Non-admins cannot edit base plans (only their own personal copies)
    if (p && !p.source_plan_id && user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") {
        router.replace(`/plans/${id}`);
        return;
      }
    }

    const stepsMap: Record<string, typeof s> = {};
    (s ?? []).forEach((step) => {
      if (!stepsMap[step.plan_workout_id]) stepsMap[step.plan_workout_id] = [];
      stepsMap[step.plan_workout_id]!.push(step);
    });

    const workoutsWithSteps: WorkoutWithSteps[] = (w ?? []).map((wk) => ({
      ...wk,
      workout_steps: stepsMap[wk.id] ?? [],
    }));

    const notesMap: Record<number, string> = {};
    (notes ?? []).forEach((n) => { notesMap[n.week_number] = n.purpose; });

    setPlan(p);
    if (p) {
      setPlanName((prev) => prev || p.name);
      setPlanDescription((prev) => prev || (p.description ?? ""));
      setPlanDifficulty((prev) => prev || (p.difficulty as DifficultyType | null) || "");
      setPlanSource((prev) => prev || (p.source ?? ""));
    }
    setWorkouts(workoutsWithSteps);
    setPaces(pac ?? []);
    setWeekNotes(notesMap);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleSavePlanMeta() {
    if (!planName.trim()) return;
    setPlanSaving(true);
    const desc = planDescription.trim() || undefined;
    const diff = (planDifficulty || null) as DifficultyType | null;
    const src = planSource.trim() || null;
    await updatePlan(id, { name: planName.trim(), description: desc, difficulty: diff, source: src });
    setPlan((p) => p ? { ...p, name: planName.trim(), description: desc ?? null, difficulty: diff, source: src } : p);
    setPlanSaving(false);
  }

  function openAdd(weekNumber: number, dayOfWeek: number, action: "library" | "form") {
    setFlow(action === "library"
      ? { step: "library", weekNumber, dayOfWeek }
      : { step: "form", weekNumber, dayOfWeek, existing: null }
    );
  }

  function openEdit(workout: PlanWorkout) {
    const full = workouts.find((w) => w.id === workout.id) ?? null;
    setFlow({ step: "form", weekNumber: workout.week_number, dayOfWeek: workout.day_of_week, existing: full });
  }

  async function handlePurposeChange(weekNumber: number, purpose: string) {
    setWeekNotes((prev) => ({ ...prev, [weekNumber]: purpose }));
    await upsertWeekPurpose(id, weekNumber, purpose);
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
      group_name: s.group_name || null,
      sets: s.sets ? parseInt(s.sets, 10) : null,
      reps: s.reps ? parseInt(s.reps, 10) : null,
      weight_suggestion: s.weight_suggestion || null,
      video_url: s.video_url || null,
      exercise_id: s.exercise_id || null,
      both_sides: s.both_sides ?? false,
    }));

    const payload = {
      plan_id: id,
      week_number: data.week_number!,
      day_of_week: data.day_of_week!,
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
        strength_type: data.strength_type || null,
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
          <select
            value={planDifficulty}
            onChange={(e) => setPlanDifficulty(e.target.value as DifficultyType | "")}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="">Difficulty: none</option>
            {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input
            type="text"
            value={planSource}
            onChange={(e) => setPlanSource(e.target.value)}
            placeholder="Source (optional)"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
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
            daysPerWeek={plan.days_per_week ?? 7}
            purpose={weekNotes[weekNum] ?? ""}
            onPurposeChange={(p) => handlePurposeChange(weekNum, p)}
            onEdit={openEdit}
            onDelete={handleDelete}
            onAddWorkout={openAdd}
            onDayLogicChange={handleDayLogicChange}
            onReorder={handleReorder}
            onCopy={setCopying}
          />
        ))}
      </div>

      {/* Pick from library */}
      {flow.step === "library" && (
        <LibraryPickerModal
          planId={id}
          weekNumber={flow.weekNumber}
          dayOfWeek={flow.dayOfWeek}
          onAdded={async () => { setFlow({ step: "idle" }); await load(); }}
          onCancel={() => setFlow({ step: "idle" })}
        />
      )}

      {/* Create new or edit existing */}
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
