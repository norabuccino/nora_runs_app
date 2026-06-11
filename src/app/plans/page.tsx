import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PlanCard } from "@/components/PlanCard";

export default async function PlansPage() {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("training_plans")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Training Plans</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Your saved marathon and strength training plans.
          </p>
        </div>
        <Link
          href="/plans/new"
          className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + New plan
        </Link>
      </div>

      {!plans || plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center space-y-3">
          <p className="font-medium">No plans yet</p>
          <p className="text-sm text-[var(--muted)]">
            Create your first training plan to get started.
          </p>
          <Link
            href="/plans/new"
            className="inline-block px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Create a plan
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}
