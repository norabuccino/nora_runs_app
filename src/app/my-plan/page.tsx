import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateUserPlan, deleteUserPlan } from "@/app/actions/userPlans";
import { PLAN_TYPE_LABELS } from "@/lib/paceUtils";
import type { PlanWorkout, RunningPace, TrainingPlan } from "@/types/database";
import { WeekGrid } from "@/components/WeekGrid";

export default async function MyPlanPage() {
  const supabase = await createClient();

  const { data: userPlans } = await supabase
    .from("user_plans")
    .select("*, training_plans(*)")
    .order("created_at", { ascending: false });

  const activePlan = userPlans?.find((up) => up.status === "active");
  const pastPlans = userPlans?.filter((up) => up.status !== "active") ?? [];

  const plan = (activePlan?.training_plans as unknown as TrainingPlan) ?? null;

  let planWorkouts: PlanWorkout[] = [];
  let paces: RunningPace[] = [];
  let sourcePlanName: string | null = null;
  let weekNotesMap: Record<number, string> = {};

  if (activePlan && plan) {
    const [{ data: w }, { data: p }, { data: sp }, { data: wn }] = await Promise.all([
      supabase
        .from("plan_workouts")
        .select("*")
        .eq("plan_id", activePlan.plan_id)
        .order("week_number")
        .order("day_of_week")
        .order("sort_order"),
      supabase.from("running_paces").select("*").order("created_at"),
      plan.source_plan_id
        ? supabase.from("training_plans").select("name").eq("id", plan.source_plan_id).single()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("plan_week_notes").select("*").eq("plan_id", activePlan.plan_id),
    ]);
    planWorkouts = (w as PlanWorkout[]) ?? [];
    paces = p ?? [];
    sourcePlanName = (sp as { name: string } | null)?.name ?? null;
    (wn ?? []).forEach((n: { week_number: number; purpose: string }) => { weekNotesMap[n.week_number] = n.purpose; });
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
    if (raceDate && plan) {
      const [y, m, d] = raceDate.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() - (plan.total_weeks * 7 - 1));
      const startDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
      await supabase2
        .from("user_plans")
        .update({ status: "paused" })
        .eq("user_id", user.id)
        .eq("status", "active");
    }
    await updateUserPlan(id, { status: "active" });
  }

  const weeks = plan ? Array.from({ length: plan.total_weeks }, (_, i) => i + 1) : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">My Plan</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Your active training plan and history.
        </p>
      </div>

      {activePlan && plan ? (
        <div className="space-y-8">
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

            <form action={handleChangeRaceDate} className="flex items-end gap-3">
              <input type="hidden" name="id" value={activePlan.id} />
              <div className="space-y-1">
                <label className="text-xs text-[var(--muted)]">Race date</label>
                <input
                  type="date"
                  name="race_date"
                  defaultValue={(() => {
                    const [y, m, d] = activePlan.start_date.split("-").map(Number);
                    const date = new Date(y, m - 1, d);
                    date.setDate(date.getDate() + plan.total_weeks * 7 - 1);
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  })()}
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
              {weeks.map((weekNum) => (
                <WeekGrid
                  key={weekNum}
                  weekNumber={weekNum}
                  workouts={planWorkouts}
                  paces={paces}
                  mode="view"
                  purpose={weekNotesMap[weekNum]}
                />
              ))}
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
      ) : (
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
