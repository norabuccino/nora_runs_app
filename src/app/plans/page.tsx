"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PlanCard } from "@/components/PlanCard";
import type { TrainingPlan, PlanType } from "@/types/database";
import { PLAN_TYPE_LABELS, PLAN_TYPE_COLORS } from "@/lib/paceUtils";

const FILTER_TABS: { value: PlanType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "marathon", label: PLAN_TYPE_LABELS.marathon },
  { value: "half_marathon", label: PLAN_TYPE_LABELS.half_marathon },
  { value: "5k_10k", label: PLAN_TYPE_LABELS["5k_10k"] },
  { value: "base_building", label: PLAN_TYPE_LABELS.base_building },
  { value: "strength", label: PLAN_TYPE_LABELS.strength },
  { value: "custom", label: PLAN_TYPE_LABELS.custom },
];

export default function PlansPage() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<PlanType | "all">("all");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data }, { data: { user } }] = await Promise.all([
        supabase.from("training_plans").select("*").is("source_plan_id", null).order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);
      setPlans(data ?? []);
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setIsAdmin(profile?.role === "admin");
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = activeFilter === "all"
    ? plans
    : plans.filter((p) => p.type === activeFilter);

  const typesInUse = new Set(plans.map((p) => p.type));
  const visibleTabs = FILTER_TABS.filter(
    (t) => t.value === "all" || typesInUse.has(t.value as PlanType)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Training Plans</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Your saved training plans.
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/plans/new"
            className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + New plan
          </Link>
        )}
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {!loading && plans.length === 0 && (
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
      )}

      {!loading && plans.length > 0 && (
        <div className="space-y-5">
          {visibleTabs.length > 2 && (
            <div className="flex flex-wrap gap-1.5">
              {visibleTabs.map(({ value, label }) => {
                const isActive = activeFilter === value;
                const colorClass = value !== "all" ? PLAN_TYPE_COLORS[value] : "";
                return (
                  <button
                    key={value}
                    onClick={() => setActiveFilter(value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? value === "all"
                          ? "bg-[var(--foreground)] text-[var(--background)]"
                          : colorClass
                        : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-8 text-center">
              No plans match this filter.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((plan) => (
                <PlanCard key={plan.id} plan={plan} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
