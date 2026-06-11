"use client";

import { useState } from "react";
import type { RunningPace } from "@/types/database";
import { estimateDuration, formatPace, parsePace } from "@/lib/paceUtils";

interface PaceCalculatorProps {
  paces: RunningPace[];
}

export function PaceCalculator({ paces }: PaceCalculatorProps) {
  const [distance, setDistance] = useState("");
  const [selectedPaceId, setSelectedPaceId] = useState<string>(paces[0]?.id ?? "custom");
  const [customPace, setCustomPace] = useState("");

  const selectedPace = paces.find((p) => p.id === selectedPaceId);

  const paceSeconds =
    selectedPaceId === "custom"
      ? parsePace(customPace) ?? 0
      : selectedPace?.pace_seconds_per_mile ?? 0;

  const dist = parseFloat(distance);
  const result =
    dist > 0 && paceSeconds > 0
      ? estimateDuration(dist, paceSeconds)
      : null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
      <h2 className="font-semibold text-sm">Pace Calculator</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-[var(--muted)]">Distance (miles)</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="e.g. 6.2"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-[var(--muted)]">Pace</label>
          <select
            value={selectedPaceId}
            onChange={(e) => setSelectedPaceId(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {paces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({formatPace(p.pace_seconds_per_mile)} /mi)
              </option>
            ))}
            <option value="custom">Custom pace</option>
          </select>
        </div>
      </div>

      {selectedPaceId === "custom" && (
        <div className="space-y-1">
          <label className="text-xs text-[var(--muted)]">Custom pace (mm:ss per mile)</label>
          <input
            type="text"
            value={customPace}
            onChange={(e) => setCustomPace(e.target.value)}
            placeholder="e.g. 9:30"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
      )}

      <div className="rounded-lg bg-[var(--background)] border border-[var(--border)] p-4 text-center">
        {result ? (
          <>
            <p className="text-3xl font-bold">{result}</p>
            <p className="text-xs text-[var(--muted)] mt-1">
              {dist} mi @ {paceSeconds > 0 ? formatPace(paceSeconds) : "—"} /mi
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">Enter a distance and pace to see your estimate</p>
        )}
      </div>
    </div>
  );
}
