"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RunningPace } from "@/types/database";
import { formatPace, parsePace } from "@/lib/paceUtils";
import { createPace, updatePace, deletePace } from "@/app/actions/paces";
import { PaceCalculator } from "@/components/PaceCalculator";
import { useUnitPreference } from "@/hooks/useUnitPreference";
import { formatPaceForUnit } from "@/lib/unitUtils";

const SUGGESTED_NAMES = ["Easy", "Long Run", "Tempo", "Threshold", "Recovery"];
const SUGGESTED_LOWER = new Set(SUGGESTED_NAMES.map((n) => n.toLowerCase()));

export default function PacesPage() {
  const [paces, setPaces] = useState<RunningPace[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPaceStr, setEditPaceStr] = useState("");
  const [newName, setNewName] = useState("");
  const [newPaceStr, setNewPaceStr] = useState("");
  const [suggestedInputs, setSuggestedInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [unitPref] = useUnitPreference();

  async function loadPaces() {
    const supabase = createClient();
    const { data } = await supabase.from("running_paces").select("*").order("created_at");
    setPaces(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadPaces();
  }, []);

  // Pre-fill suggested inputs from existing paces whenever paces or unit changes
  useEffect(() => {
    setSuggestedInputs((prev) => {
      const next = { ...prev };
      for (const name of SUGGESTED_NAMES) {
        const existing = paces.find((p) => p.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          const displaySec =
            unitPref === "km"
              ? existing.pace_seconds_per_mile / 1.60934
              : existing.pace_seconds_per_mile;
          next[name] = formatPace(Math.round(displaySec));
        }
      }
      return next;
    });
  }, [paces, unitPref]);

  function displaySec(pace: RunningPace) {
    return unitPref === "km"
      ? pace.pace_seconds_per_mile / 1.60934
      : pace.pace_seconds_per_mile;
  }

  function toStoredSec(paceStr: string): number | null {
    const parsed = parsePace(paceStr);
    if (!parsed) return null;
    return unitPref === "km" ? Math.round(parsed * 1.60934) : parsed;
  }

  function startEdit(pace: RunningPace) {
    setEditingId(pace.id);
    setEditName(pace.name);
    setEditPaceStr(formatPace(Math.round(displaySec(pace))));
    setError(null);
  }

  async function handleSaveSuggested(name: string) {
    const paceStr = suggestedInputs[name]?.trim();
    if (!paceStr) {
      setError(`Enter a pace for ${name}`);
      return;
    }
    const seconds = toStoredSec(paceStr);
    if (!seconds) {
      setError("Enter a valid pace (MM:SS)");
      return;
    }
    setError(null);
    const existing = paces.find((p) => p.name.toLowerCase() === name.toLowerCase());
    startTransition(async () => {
      if (existing) {
        await updatePace(existing.id, name, seconds);
      } else {
        await createPace(name, seconds);
      }
      await loadPaces();
    });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const seconds = toStoredSec(newPaceStr);
    if (!newName.trim() || !seconds) {
      setError("Enter a valid name and pace (MM:SS)");
      return;
    }
    setError(null);
    startTransition(async () => {
      await createPace(newName.trim(), seconds);
      setNewName("");
      setNewPaceStr("");
      await loadPaces();
    });
  }

  async function handleUpdate(id: string) {
    const seconds = toStoredSec(editPaceStr);
    if (!editName.trim() || !seconds) {
      setError("Enter a valid name and pace (MM:SS)");
      return;
    }
    setError(null);
    startTransition(async () => {
      await updatePace(id, editName.trim(), seconds);
      setEditingId(null);
      await loadPaces();
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this pace?")) return;
    startTransition(async () => {
      await deletePace(id);
      await loadPaces();
    });
  }

  // Custom paces = everything not in the suggested list
  const customPaces = paces.filter((p) => !SUGGESTED_LOWER.has(p.name.toLowerCase()));

  const inputClass =
    "rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Running Paces</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Save your training paces so the app can estimate workout durations and distances.
        </p>
      </div>

      {/* ── Common paces ── */}
      <div className="space-y-3">
        <div>
          <h2 className="font-semibold">Common paces</h2>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            Enter each pace in <strong>min / {unitPref}</strong> (MM:SS format). These will be available in all workout forms.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
          {SUGGESTED_NAMES.map((name) => {
            const existing = paces.find((p) => p.name.toLowerCase() === name.toLowerCase());
            const isSaved = !!existing && !!existing.pace_seconds_per_mile;
            return (
              <div key={name} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{name}</span>
                  {isSaved && (
                    <span className="ml-2 text-xs text-[var(--muted)] font-mono">
                      {formatPaceForUnit(existing.pace_seconds_per_mile, unitPref)}
                    </span>
                  )}
                </div>
                <input
                  value={suggestedInputs[name] ?? ""}
                  onChange={(e) =>
                    setSuggestedInputs((prev) => ({ ...prev, [name]: e.target.value }))
                  }
                  placeholder={`MM:SS /${unitPref}`}
                  className="w-24 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
                <button
                  onClick={() => handleSaveSuggested(name)}
                  disabled={isPending || !suggestedInputs[name]?.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
                >
                  {isSaved ? "Update" : "Save"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Custom paces ── */}
      <div className="space-y-3">
        <div>
          <h2 className="font-semibold">Custom paces</h2>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            Add any other paces you train at (e.g. marathon pace, 5K pace) in min / {unitPref}.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          {loading ? (
            <div className="p-4 text-sm text-[var(--muted)]">Loading…</div>
          ) : customPaces.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-3 text-xs text-[var(--muted)] font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-xs text-[var(--muted)] font-medium">
                    Pace / {unitPref}
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {customPaces.map((pace) => (
                  <tr key={pace.id} className="border-b border-[var(--border)] last:border-0">
                    {editingId === pace.id ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={editPaceStr}
                            onChange={(e) => setEditPaceStr(e.target.value)}
                            placeholder={`MM:SS /${unitPref}`}
                            className="w-24 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm font-mono focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleUpdate(pace.id)}
                              disabled={isPending}
                              className="text-xs text-[var(--accent)] hover:opacity-70"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-xs text-[var(--muted)]"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium">{pace.name}</td>
                        <td className="px-4 py-3 font-mono">
                          {formatPaceForUnit(pace.pace_seconds_per_mile, unitPref)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-3 justify-end">
                            <button
                              onClick={() => startEdit(pace)}
                              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(pace.id)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          <form
            onSubmit={handleAdd}
            className="flex gap-2 p-4 border-t border-[var(--border)] bg-[var(--card)]"
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Pace name (e.g. Marathon pace)"
              className={`flex-1 ${inputClass}`}
            />
            <input
              value={newPaceStr}
              onChange={(e) => setNewPaceStr(e.target.value)}
              placeholder="MM:SS"
              className={`w-24 font-mono ${inputClass}`}
            />
            <button
              type="submit"
              disabled={isPending}
              className="px-4 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Add
            </button>
          </form>

          {error && <p className="px-4 pb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>

      <PaceCalculator paces={paces} />
    </div>
  );
}
