import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLAN_TYPE_LABELS, DIFFICULTY_LABELS, DIFFICULTY_COLORS, WEEKDAY_NAMES, defaultDayMapping, DAY_NAMES } from "@/lib/paceUtils";
import { assignPlan } from "@/app/actions/userPlans";
import { duplicatePlan } from "@/app/actions/plans";
import { getIsAdmin } from "@/lib/profile";
import type { PlanWorkout, RunningPace } from "@/types/database";
import { PlanWeeklyView } from "@/components/PlanWeeklyView";

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
    if (plan?.type === "strength" && plan.days_per_week) {
      const today = new Date().toISOString().split("T")[0];
      const startDate = (formData.get("start_date") as string) || today;
      const dayMapping: number[] = [];
      for (let i = 0; i < plan.days_per_week; i++) {
        dayMapping.push(parseInt(formData.get(`day_${i}`) as string));
      }
      await assignPlan(id, startDate, dayMapping);
    } else {
      const raceDate = formData.get("race_date") as string;
      if (raceDate) {
        const [y, m, d] = raceDate.split("-").map(Number);
        const date = new Date(y, m - 1, d);
        date.setDate(date.getDate() - (plan!.total_weeks * 7 - 1));
        const startDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        await assignPlan(id, startDate);
      }
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
                className="self-start px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
              >
                Edit plan
              </Link>
            </>
          )}
          {!plan.source_plan_id && plan.type === "strength" && plan.days_per_week ? (
            <form action={handleAssign} className="space-y-3">
              <div className="space-y-2">
                {Array.from({ length: plan.days_per_week }, (_, i) => {
                  const defaults = defaultDayMapping(plan.days_per_week!);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-[var(--muted)] w-10 shrink-0">{DAY_NAMES[i]}</span>
                      <select
                        name={`day_${i}`}
                        defaultValue={defaults[i] ?? i}
                        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none"
                      >
                        {WEEKDAY_NAMES.map((name, j) => (
                          <option key={j} value={j}>{name}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 items-end flex-wrap">
                <div className="space-y-1">
                  <label className="text-xs text-[var(--muted)]">Start date</label>
                  <input
                    type="date"
                    name="start_date"
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Use this plan
                </button>
              </div>
            </form>
          ) : !plan.source_plan_id ? (
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
          ) : null}
        </div>
      </div>

      <PlanWeeklyView
        weeks={weeks}
        allWorkouts={(workouts ?? []) as PlanWorkout[]}
        daysPerWeek={plan.days_per_week ?? 7}
        weekNotes={weekNotes}
        paces={(paces ?? []) as RunningPace[]}
      />
    </div>
  );
}
