"use client";

import { useEffect, useState } from "react";
import { deletePlan, getPlanUsage, type PlanUsage } from "@/app/actions/plans";
import { planDeleteWarnings } from "@/lib/planDelete";

/** Confirms deleting a plan, saying first who's using it (people following it, your own logs, copies). */
export function DeletePlanModal({
  planId,
  planName,
  isAdmin,
  onDeleted,
  onCancel,
}: {
  planId: string;
  planName: string;
  isAdmin: boolean;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const [usage, setUsage] = useState<PlanUsage | null | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlanUsage(planId)
      .then(setUsage)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't check who uses this plan"));
  }, [planId]);

  const check = usage ? planDeleteWarnings(usage, isAdmin) : null;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const result = await deletePlan(planId);
    if (result.error) {
      setError(result.error);
      setDeleting(false);
      return;
    }
    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl p-4 space-y-3">
        <h2 className="font-semibold">Delete “{planName}”?</h2>
        <p className="text-sm text-[var(--muted)]">This deletes the plan and all of its workouts. It can&apos;t be undone.</p>

        {usage === undefined && !error && <p className="text-sm text-[var(--muted)]">Checking who uses this plan…</p>}
        {usage === null && <p className="text-sm text-red-600 dark:text-red-400">You can&apos;t delete this plan.</p>}
        {check?.blocked && <p className="text-sm text-red-600 dark:text-red-400">{check.blocked}</p>}
        {check && check.warnings.length > 0 && (
          <ul className="space-y-1.5">
            {check.warnings.map((w, i) => (
              <li
                key={w}
                className={`rounded-lg px-3 py-2 text-sm ${
                  i === 0 && usage!.followers > 0
                    ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-medium"
                    : "bg-[var(--card)] text-[var(--foreground)]"
                }`}
              >
                {w}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || !check || !!check.blocked}
            className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting
              ? "Deleting…"
              : usage && usage.followers > 0 && !check?.blocked
              ? `Delete for everyone (${usage.followers})`
              : "Delete plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
