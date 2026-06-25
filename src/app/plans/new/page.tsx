"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPlan } from "@/app/actions/plans";
import type { PlanType, DifficultyType } from "@/types/database";
import { PLAN_TYPE_LABELS, DIFFICULTY_LABELS } from "@/lib/paceUtils";
import { createClient } from "@/lib/supabase/client";

export default function NewPlanPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<PlanType>("marathon");
  const [difficulty, setDifficulty] = useState<DifficultyType | "">("");
  const [daysPerWeek, setDaysPerWeek] = useState("3");
  const [description, setDescription] = useState("");
  const [totalWeeks, setTotalWeeks] = useState("16");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/plans"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") router.replace("/plans");
    }
    checkAdmin();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Plan name is required");
      return;
    }
    const weeks = parseInt(totalWeeks, 10);
    if (!weeks || weeks < 1 || weeks > 52) {
      setError("Total weeks must be between 1 and 52");
      return;
    }
    setError(null);
    startTransition(async () => {
      const dpw = type === "strength" ? parseInt(daysPerWeek, 10) : null;
      await createPlan({ name: name.trim(), type, difficulty: difficulty || null, days_per_week: dpw, description, total_weeks: weeks, source: source.trim() || null });
    });
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Training Plan</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          After creating the plan you&apos;ll be taken to the editor to add workouts.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <label className="text-sm font-medium">Plan name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 16-Week Marathon Build"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Plan type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PlanType)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {Object.entries(PLAN_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {type === "strength" && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Days per week</label>
            <select
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="2">2 days / week</option>
              <option value="3">3 days / week</option>
              <option value="4">4 days / week</option>
              <option value="5">5 days / week</option>
              <option value="6">6 days / week</option>
            </select>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium">Difficulty <span className="text-[var(--muted)] font-normal">(optional)</span></label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as DifficultyType | "")}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="">— Select —</option>
            {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Total weeks</label>
          <input
            type="number"
            min="1"
            max="52"
            value={totalWeeks}
            onChange={(e) => setTotalWeeks(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Description <span className="text-[var(--muted)]">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What's the goal of this plan? Any key details…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Source <span className="text-[var(--muted)] font-normal">(optional)</span></label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g. Coach, Book, YouTube…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Creating…" : "Create plan & add workouts →"}
        </button>
      </form>
    </div>
  );
}
