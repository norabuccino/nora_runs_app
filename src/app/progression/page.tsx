"use client";

import { useEffect, useState } from "react";
import { StrengthProgression } from "@/components/StrengthProgression";
import { RunningProgression } from "@/components/RunningProgression";

type View = "strength" | "running";

const VIEW_KEY = "progressionView";

export default function ProgressionPage() {
  const [view, setView] = useState<View>("strength");

  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "running") setView("running");
    } catch {}
  }, []);

  function choose(next: View) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Progression</h1>
        <div role="tablist" className="inline-flex rounded-lg border border-[var(--border)] p-0.5 text-sm">
          {(["strength", "running"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => choose(v)}
              className={`rounded-md px-4 py-1.5 font-medium transition-colors ${
                view === v ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {v === "strength" ? "Strength" : "Running"}
            </button>
          ))}
        </div>
      </div>

      {view === "strength" ? <StrengthProgression /> : <RunningProgression />}
    </div>
  );
}
