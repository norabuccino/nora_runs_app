"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addLibraryWorkoutToPlan } from "@/app/actions/workoutLibrary";
import type { TrainingPlan } from "@/types/database";
import { DAY_NAMES } from "@/lib/paceUtils";

interface AddToPlanModalProps {
  workoutId: string;
  workoutTitle: string;
  onClose: () => void;
  onAdded: () => void;
}

export function AddToPlanModal({ workoutId, workoutTitle, onClose, onAdded }: AddToPlanModalProps) {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [weekNumber, setWeekNumber] = useState(1);
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("training_plans")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPlans(data ?? []);
        if (data?.length) setSelectedPlanId(data[0].id);
      });
  }, []);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  async function handleAdd() {
    if (!selectedPlanId) return;
    setSaving(true);
    setError(null);
    try {
      await addLibraryWorkoutToPlan(workoutId, selectedPlanId, weekNumber, dayOfWeek);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add workout");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-sm bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl">
        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Add to plan</h2>
            <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none">×</button>
          </div>

          <p className="text-sm text-[var(--muted)]">
            Adding <span className="font-medium text-[var(--foreground)]">{workoutTitle}</span> to a plan slot.
          </p>

          {plans.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No plans found. Create a plan first.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-[var(--muted)]">Plan</label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => {
                    setSelectedPlanId(e.target.value);
                    setWeekNumber(1);
                    setDayOfWeek(0);
                  }}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-[var(--muted)]">Week</label>
                  <select
                    value={weekNumber}
                    onChange={(e) => setWeekNumber(parseInt(e.target.value, 10))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    {Array.from({ length: selectedPlan?.total_weeks ?? 1 }, (_, i) => i + 1).map((w) => (
                      <option key={w} value={w}>Week {w}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[var(--muted)]">Day</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    {DAY_NAMES.map((name, i) => (
                      <option key={i} value={i}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !selectedPlanId}
              className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {saving ? "Adding…" : "Add to plan"}
            </button>
            <button
              onClick={onClose}
              className="px-4 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
