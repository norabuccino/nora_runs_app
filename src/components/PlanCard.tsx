import Link from "next/link";
import type { TrainingPlan } from "@/types/database";
import { PLAN_TYPE_LABELS } from "@/lib/paceUtils";

interface PlanCardProps {
  plan: TrainingPlan;
}

const PLAN_TYPE_COLORS: Record<string, string> = {
  marathon: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  half_marathon: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  strength: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  custom: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function PlanCard({ plan }: PlanCardProps) {
  return (
    <Link
      href={`/plans/${plan.id}`}
      className="block rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 hover:border-[var(--foreground)] transition-colors group"
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
        <p className="text-xs text-[var(--muted)]">{plan.total_weeks} weeks</p>
      </div>
    </Link>
  );
}
