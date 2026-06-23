import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLAN_TYPE_LABELS, DAY_NAMES, WORKOUT_TYPE_COLORS, WORKOUT_TYPE_LABELS, RUN_TYPE_COLORS, RUN_TYPE_LABELS, getWorkoutEstimate, DIFFICULTY_LABELS, DIFFICULTY_COLORS } from "@/lib/paceUtils";
import { assignPlan } from "@/app/actions/userPlans";
import { duplicatePlan } from "@/app/actions/plans";
import { getIsAdmin } from "@/lib/profile";
import type { PlanWorkout } from "@/types/database";
import { WeekMileageLabel } from "@/components/WeekMileageLabel";

function toMiles(distance: number, unit: string): number {
  if (unit === "km") return distance / 1.60934;
  if (unit === "m") return distance / 1609.34;
  return distance;
}

function weekMileageRange(weekWorkouts: PlanWorkout[]): { low: number; high: number } {
  const byDay: Record<number, PlanWorkout[]> = {};
  for (let d = 0; d < 7; d++) byDay[d] = [];
  weekWorkouts.forEach((w) => { byDay[w.day_of_week].push(w); });

  let low = 0;
  let high = 0;

  for (let d = 0; d < 7; d++) {
    const day = byDay[d];
    if (!day.length) continue;
    const distances = day.map((w) =>
      w.distance_miles ? toMiles(parseFloat(String(w.distance_miles)), w.distance_unit ?? "mi") : 0
    );
    if ((day[0].day_logic ?? "or") === "and") {
      const sum = distances.reduce((a, b) => a + b, 0);
      low += sum;
      high += sum;
    } else {
      low += Math.min(...distances);
      high += Math.max(...distances);
    }
  }

  return { low, high };
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlanDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: plan }, { data: workouts }, { data: paces }, { data: weekNotesData }, isAdmin] = await Promise.all([
    supabase.from("training_plans").select("*").eq("id", id).single(),
    supabase.from("plan_workouts").select("*").eq("plan_id", id).order("week_number").order("day_of_week").order("sort_order"),
    supabase.from("running_paces").select("*").order("created_at"),
    supabase.from("plan_week_notes").select("*").eq("plan_id", id),
    getIsAdmin(),
  ]);

  const weekNotes: Record<number, string> = {};
  (weekNotesData ?? []).forEach((n) => { weekNotes[n.week_number] = n.purpose; });

  if (!plan) notFound();

  const weeks = Array.from({ length: plan.total_weeks }, (_, i) => i + 1);

  async function handleAssign(formData: FormData) {
    "use server";
    const raceDate = formData.get("race_date") as string;
    if (raceDate) {
      const [y, m, d] = raceDate.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() - (plan!.total_weeks * 7 - 1));
      const startDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      await assignPlan(id, startDate);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/plans" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
              ← Plans
            </Link>
          </div>
          <h1 className="text-2xl font-bold">{plan.name}</h1>
          <div className="flex items-center gap-3 text-sm text-[var(--muted)] flex-wrap">
            <span>{PLAN_TYPE_LABELS[plan.type]}</span>
            <span>·</span>
            <span>{plan.total_weeks} weeks</span>
            {plan.difficulty && (
              <>
                <span>·</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[plan.difficulty]}`}>
                  {DIFFICULTY_LABELS[plan.difficulty]}
                </span>
              </>
            )}
          </div>
          {plan.description && (
            <p className="text-sm text-[var(--muted)] max-w-xl">{plan.description}</p>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          {isAdmin && (
            <>
              <form action={async () => {
                "use server";
                await duplicatePlan(id);
              }}>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
                >
                  Duplicate
                </button>
              </form>
              <Link
                href={`/plans/${id}/edit`}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
              >
                Edit plan
              </Link>
            </>
          )}
          {!plan.source_plan_id && (
            <form action={handleAssign} className="flex gap-2 items-end">
              <div className="space-y-1">
                <label className="text-xs text-[var(--muted)]">Race date</label>
                <input
                  type="date"
                  name="race_date"
                  required
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Use this plan
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="space-y-10">
        {weeks.map((weekNum) => {
          const weekWorkouts = (workouts ?? []).filter((w) => w.week_number === weekNum);
          const { low, high } = weekMileageRange(weekWorkouts);
          return (
            <div key={weekNum} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-3 min-w-0">
                  <h2 className="font-semibold text-sm text-[var(--muted)] uppercase tracking-wide whitespace-nowrap">
                    Week {weekNum}
                  </h2>
                  {weekNotes[weekNum] && (
                    <p className="text-sm text-[var(--muted)] italic truncate">{weekNotes[weekNum]}</p>
                  )}
                </div>
                <WeekMileageLabel lowMi={low} highMi={high} />
              </div>
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                {weekWorkouts.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-[var(--muted)]">No workouts scheduled.</p>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {Array.from({ length: 7 }, (_, dayIndex) => {
                      const dayWorkouts = weekWorkouts
                        .filter((w) => w.day_of_week === dayIndex)
                        .sort((a, b) => a.sort_order - b.sort_order);
                      return (
                        <div key={dayIndex} className="flex gap-4 px-4 py-3">
                          <span className="text-xs font-medium text-[var(--muted)] w-14 shrink-0 pt-0.5">
                            {DAY_NAMES[dayIndex]}
                          </span>
                          <div className="flex-1 space-y-1.5">
                            {dayWorkouts.length === 0 ? (
                              <span className="text-xs text-[var(--muted)]">Rest</span>
                            ) : (
                              dayWorkouts.flatMap((w, i) => {
                                const estimate = getWorkoutEstimate(
                                  w.distance_miles,
                                  w.distance_unit ?? "mi",
                                  w.pace_type,
                                  w.duration_minutes,
                                  paces ?? []
                                );
                                const card = (
                                  <div key={w.id} className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${w.run_type ? (RUN_TYPE_COLORS[w.run_type] ?? WORKOUT_TYPE_COLORS[w.type]) : WORKOUT_TYPE_COLORS[w.type]}`}>
                                      {w.run_type ? (RUN_TYPE_LABELS[w.run_type] ?? WORKOUT_TYPE_LABELS[w.type]) : WORKOUT_TYPE_LABELS[w.type]}
                                    </span>
                                    <span className="text-sm font-medium">{w.title}</span>
                                    {w.distance_miles && (
                                      <span className="text-xs text-[var(--muted)]">{w.distance_miles} {w.distance_unit ?? "mi"}</span>
                                    )}
                                    {w.pace_type && (
                                      <span className="text-xs text-[var(--muted)] capitalize">{w.pace_type}</span>
                                    )}
                                    {estimate && (
                                      <span className="text-xs text-[var(--muted)]">~{estimate}</span>
                                    )}
                                  </div>
                                );
                                if (i === 0) return [card];
                                const logic = dayWorkouts[0].day_logic ?? "and";
                                const sep = (
                                  <div key={`logic-${i}`} className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-[var(--muted)] uppercase">
                                      {logic}
                                    </span>
                                  </div>
                                );
                                return [sep, card];
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
