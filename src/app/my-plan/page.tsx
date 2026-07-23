import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateUserPlan, deleteUserPlan } from "@/app/actions/userPlans";
import { PLAN_TYPE_LABELS, raceDateToStartDate, startDateToRaceDate } from "@/lib/paceUtils";
import type { PlanWorkout, RunningPace, TrainingPlan } from "@/types/database";
import { MyPlanWeeks } from "@/components/MyPlanWeeks";

export default async function MyPlanPage() {
  const supabase = await createClient();

  const { data: userPlans } = await supabase
    .from("user_plans")
    .select("*, training_plans(*)")
    .order("created_at", { ascending: false });

  const activePlans = userPlans?.filter((up) => up.status === "active") ?? [];
  const pastPlans = userPlans?.filter((up) => up.status !== "active") ?? [];

  const activePlanIds = activePlans.map((up) => up.plan_id);
  const sourcePlanIds = activePlans
    .map((up) => (up.training_plans as unknown as TrainingPlan)?.source_plan_id)
    .filter(Boolean) as string[];

  const planWorkoutsMap: Record<string, PlanWorkout[]> = {};
  let paces: RunningPace[] = [];
  const sourcePlanNamesMap: Record<string, string | null> = {};
  const weekNotesMapByPlan: Record<string, Record<number, string>> = {};

  if (activePlans.length > 0) {
    const [{ data: allWorkouts }, { data: p }, { data: sourcePlans }, { data: allNotes }] = await Promise.all([
      supabase
        .from("plan_workouts")
        .select("*")
        .in("plan_id", activePlanIds)
        .order("week_number")
        .order("day_of_week")
        .order("sort_order"),
      supabase.from("running_paces").select("*").order("created_at"),
      sourcePlanIds.length > 0
        ? supabase.from("training_plans").select("id, name").in("id", sourcePlanIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("plan_week_notes").select("*").in("plan_id", activePlanIds),
    ]);

    paces = p ?? [];

    for (const planId of activePlanIds) {
      planWorkoutsMap[planId] = ((allWorkouts ?? []) as PlanWorkout[]).filter((w) => w.plan_id === planId);
    }

    for (const up of activePlans) {
      const plan = up.training_plans as unknown as TrainingPlan;
      const src = (sourcePlans ?? []).find((sp: { id: string; name: string }) => sp.id === plan.source_plan_id);
      sourcePlanNamesMap[up.plan_id] = src?.name ?? null;
    }

    for (const planId of activePlanIds) {
      weekNotesMapByPlan[planId] = {};
      (allNotes ?? [])
        .filter((n) => n.plan_id === planId)
        .forEach((n: { week_number: number; purpose: string }) => {
          weekNotesMapByPlan[planId][n.week_number] = n.purpose;
        });
    }
  }

  async function handlePause(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    await updateUserPlan(id, { status: "paused" });
  }

  async function handleComplete(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    await updateUserPlan(id, { status: "completed" });
  }

  async function handleChangeRaceDate(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const raceDate = formData.get("race_date") as string;
    const totalWeeks = parseInt(formData.get("total_weeks") as string);
    if (raceDate && totalWeeks) {
      await updateUserPlan(id, { start_date: raceDateToStartDate(raceDate, totalWeeks) });
    }
  }

  async function handleChangeStartDate(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const startDate = formData.get("start_date") as string;
    if (startDate) {
      await updateUserPlan(id, { start_date: startDate });
    }
  }

  async function handleDelete(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    await deleteUserPlan(id);
  }

  async function handleResume(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const supabase2 = await createClient();
    const { data: { user } } = await supabase2.auth.getUser();
    if (user) {
      // Get the type of the plan being resumed so we only pause same-type plans
      const { data: resumingPlan } = await supabase2
        .from("user_plans")
        .select("plan_id, training_plans(type)")
        .eq("id", id)
        .single();
      const planType = (resumingPlan?.training_plans as unknown as { type: string } | null)?.type;
      if (planType) {
        const { data: sameType } = await supabase2
          .from("user_plans")
          .select("id, training_plans!inner(type)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .eq("training_plans.type", planType);
        if (sameType?.length) {
          await supabase2
            .from("user_plans")
            .update({ status: "paused" })
            .in("id", (sameType as { id: string }[]).map((p) => p.id));
        }
      }
    }
    await updateUserPlan(id, { status: "active" });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">My Plan</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Your active training plan{activePlans.length !== 1 ? "s" : ""} and history.
        </p>
      </div>

      {activePlans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center space-y-3">
          <p className="font-medium">No active plan</p>
          <p className="text-sm text-[var(--muted)]">
            Go to a training plan and click &quot;Use this plan&quot; to assign it.
          </p>
          <Link
            href="/plans"
            className="inline-block px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Browse plans
          </Link>
        </div>
      ) : (
        <div className="space-y-12">
          {activePlans.map((activePlan) => {
            const plan = activePlan.training_plans as unknown as TrainingPlan;
            const planWorkouts = planWorkoutsMap[activePlan.plan_id] ?? [];
            const weekNotesMap = weekNotesMapByPlan[activePlan.plan_id] ?? {};
            const sourcePlanName = sourcePlanNamesMap[activePlan.plan_id] ?? null;
            const weeks = Array.from({ length: plan.total_weeks }, (_, i) => i + 1);
            const isStrength = plan.type === "strength";

            const raceDateStr = startDateToRaceDate(activePlan.start_date, plan.total_weeks);

            return (
              <div key={activePlan.id} className="space-y-8">
                {/* Plan info + controls */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-[var(--muted)] font-medium uppercase tracking-wide">Active plan</p>
                      <h2 className="text-lg font-semibold mt-0.5">{plan.name}</h2>
                      <p className="text-sm text-[var(--muted)]">
                        {PLAN_TYPE_LABELS[plan.type]} · {plan.total_weeks} weeks
                      </p>
                      {sourcePlanName && (
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                          Based on: {sourcePlanName}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/plans/${activePlan.plan_id}/edit`}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors"
                    >
                      Edit plan
                    </Link>
                  </div>

                  {isStrength ? (
                    <form action={handleChangeStartDate} className="flex items-end gap-3">
                      <input type="hidden" name="id" value={activePlan.id} />
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--muted)]">Start date</label>
                        <input
                          type="date"
                          name="start_date"
                          defaultValue={activePlan.start_date}
                          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors"
                      >
                        Update
                      </button>
                    </form>
                  ) : (
                    <form action={handleChangeRaceDate} className="flex items-end gap-3">
                      <input type="hidden" name="id" value={activePlan.id} />
                      <input type="hidden" name="total_weeks" value={plan.total_weeks} />
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--muted)]">Race date</label>
                        <input
                          type="date"
                          name="race_date"
                          defaultValue={raceDateStr}
                          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors"
                      >
                        Update
                      </button>
                    </form>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <form action={handlePause}>
                      <input type="hidden" name="id" value={activePlan.id} />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors"
                      >
                        Pause
                      </button>
                    </form>
                    <form action={handleComplete}>
                      <input type="hidden" name="id" value={activePlan.id} />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
                      >
                        Mark completed
                      </button>
                    </form>
                    <form action={handleDelete}>
                      <input type="hidden" name="id" value={activePlan.id} />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-red-500 hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950 transition-colors"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>

                {/* Full weekly plan view */}
                {planWorkouts.length > 0 ? (
                  <div className="space-y-10 overflow-x-auto pb-4">
                    <MyPlanWeeks
                      weeks={weeks}
                      planWorkouts={planWorkouts}
                      paces={paces}
                      weekNotesMap={weekNotesMap}
                      startDate={activePlan.start_date}
                      daysPerWeek={plan.days_per_week ?? undefined}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center space-y-2">
                    <p className="text-sm text-[var(--muted)]">No workouts in this plan yet.</p>
                    <Link
                      href={`/plans/${activePlan.plan_id}/edit`}
                      className="text-sm text-[var(--accent)] hover:opacity-70"
                    >
                      Add workouts →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pastPlans.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-[var(--muted)] uppercase tracking-wide">History</h2>
          <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
            {pastPlans.map((up) => (
              <div key={up.id} className="flex items-center justify-between px-4 py-3 gap-4">
                <div>
                  <p className="text-sm font-medium">
                    {(up.training_plans as unknown as TrainingPlan)?.name}
                  </p>
                  <p className="text-xs text-[var(--muted)] capitalize">
                    {up.status} · started {up.start_date}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {up.status === "paused" && (
                    <form action={handleResume}>
                      <input type="hidden" name="id" value={up.id} />
                      <button
                        type="submit"
                        className="text-xs text-[var(--accent)] hover:opacity-70"
                      >
                        Resume
                      </button>
                    </form>
                  )}
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={up.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-500 hover:opacity-70"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
