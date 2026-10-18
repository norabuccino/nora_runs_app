"use client";

import { useState } from "react";
import { WorkoutsImport } from "./WorkoutsImport";
import { PlanImport } from "./PlanImport";
import { ExercisesImport } from "./ExercisesImport";

const TABS = [
  { key: "workouts", label: "Workouts" },
  { key: "plan", label: "Plan" },
  { key: "exercises", label: "Exercises" },
] as const;

type Tab = (typeof TABS)[number]["key"];

/** Admin bulk import from plain text: many library workouts, a whole plan, or a list of exercises. */
export function AdminImport() {
  const [tab, setTab] = useState<Tab>("workouts");
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Bulk import</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Paste plain text to set up many things at once. Nothing is saved until you review the preview and confirm.
        </p>
      </div>
      <div className="flex gap-1 rounded-lg border border-[var(--border)] p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              tab === t.key ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "workouts" && <WorkoutsImport />}
      {tab === "plan" && <PlanImport />}
      {tab === "exercises" && <ExercisesImport />}
    </div>
  );
}
