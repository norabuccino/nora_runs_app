"use client";

import Link from "next/link";
import { useTransition } from "react";
import type { TrainingPlan } from "@/types/database";
import { PLAN_TYPE_LABELS, PLAN_TYPE_COLORS, DIFFICULTY_LABELS, DIFFICULTY_COLORS } from "@/lib/paceUtils";
import { assignPlan } from "@/app/actions/userPlans";
import { duplicatePlan } from "@/app/actions/plans";

const needsDaySetup = (plan: TrainingPlan) => plan.type === "strength" && !!plan.days_per_week;

interface PlanCardProps {
  plan: TrainingPlan;
  isAdmin?: boolean;
}

export function PlanCard({ plan, isAdmin = false }: PlanCardProps) {
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    const today = new Date().toISOString().split("T")[0];
    startTransition(async () => {
      await assignPlan(plan.id, today);
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      await duplicatePlan(plan.id);
    });
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] flex flex-col overflow-hidden">
      <Link
        href={`/plans/${plan.id}`}
        className="block p-5 hover:bg-[var(--background)] transition-colors group flex-1"
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-semibold text-sm leading-snug group-hover:underline">
              {plan.name}
            </h2>
            <span
              className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${PLAN_TYPE_COLORS[plan.type]}`}
            >
              {PLAN_TYPE_LABELS[plan.type]}
            </span>
          </div>
          {plan.description && (
            <p className="text-xs text-[var(--muted)] leading-relaxed line-clamp-2">
              {plan.description}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-[var(--muted)]">{plan.total_weeks} weeks</p>
            {plan.difficulty && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[plan.difficulty]}`}>
                {DIFFICULTY_LABELS[plan.difficulty]}
              </span>
            )}
            {plan.source && (
              <span className="text-xs text-[var(--muted)]">{plan.source}</span>
            )}
          </div>
        </div>
      </Link>
      <div className="border-t border-[var(--border)] px-4 py-3 flex gap-2">
        {isAdmin && (
          <>
            <Link
              href={`/plans/${plan.id}/edit`}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--background)] transition-colors"
            >
              Edit
            </Link>
            <button
              onClick={handleDuplicate}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--background)] disabled:opacity-50 transition-colors"
            >
              Duplicate
            </button>
          </>
        )}
        {needsDaySetup(plan) ? (
          <Link
            href={`/plans/${plan.id}`}
            className="flex-1 py-1.5 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-xs font-medium hover:opacity-90 transition-opacity text-center"
          >
            Set up plan →
          </Link>
        ) : (
          <button
            onClick={handleAdd}
            disabled={isPending}
            className="flex-1 py-1.5 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPending ? "Adding…" : "Add to my plans"}
          </button>
        )}
      </div>
    </div>
  );
}
