// Where an exercise is used — the workout steps that reference it, grouped by
// the workout they belong to. Powers the "replace before deleting" flow.

export type ExerciseUsageStepRow = {
  plan_workout_id: string | null;
  workout_id: string | null;
  scheduled_workout_id: string | null;
  plan_workouts: { title: string; training_plans: { name: string } | null } | null;
  workouts: { title: string } | null;
  scheduled_workouts: { title: string; scheduled_date: string } | null;
};

export type ExerciseUsageKind = "plan" | "library" | "scheduled";

export type ExerciseUsageEntry = {
  kind: ExerciseUsageKind;
  key: string;
  workoutTitle: string;
  context: string; // plan name, "Workout library", or the scheduled date
  stepCount: number;
};

const KIND_ORDER: Record<ExerciseUsageKind, number> = { plan: 0, scheduled: 1, library: 2 };

export function summarizeExerciseUsage(rows: ExerciseUsageStepRow[]): ExerciseUsageEntry[] {
  const byKey = new Map<string, ExerciseUsageEntry>();
  for (const row of rows) {
    let entry: Omit<ExerciseUsageEntry, "stepCount"> | null = null;
    if (row.plan_workout_id) {
      entry = {
        kind: "plan",
        key: `plan:${row.plan_workout_id}`,
        workoutTitle: row.plan_workouts?.title ?? "Untitled workout",
        context: row.plan_workouts?.training_plans?.name ?? "Plan",
      };
    } else if (row.scheduled_workout_id) {
      entry = {
        kind: "scheduled",
        key: `scheduled:${row.scheduled_workout_id}`,
        workoutTitle: row.scheduled_workouts?.title ?? "Untitled workout",
        context: row.scheduled_workouts?.scheduled_date ?? "Scheduled",
      };
    } else if (row.workout_id) {
      entry = {
        kind: "library",
        key: `library:${row.workout_id}`,
        workoutTitle: row.workouts?.title ?? "Untitled workout",
        context: "Workout library",
      };
    }
    if (!entry) continue;
    const existing = byKey.get(entry.key);
    if (existing) existing.stepCount += 1;
    else byKey.set(entry.key, { ...entry, stepCount: 1 });
  }
  return Array.from(byKey.values()).sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.context.localeCompare(b.context) ||
      a.workoutTitle.localeCompare(b.workoutTitle)
  );
}
