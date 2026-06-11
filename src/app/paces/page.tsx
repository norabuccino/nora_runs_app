"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RunningPace } from "@/types/database";
import { formatPace, parsePace } from "@/lib/paceUtils";
import { createPace, updatePace, deletePace } from "@/app/actions/paces";
import { PaceCalculator } from "@/components/PaceCalculator";

export default function PacesPage() {
  const [paces, setPaces] = useState<RunningPace[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPaceStr, setEditPaceStr] = useState("");
  const [newName, setNewName] = useState("");
  const [newPaceStr, setNewPaceStr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadPaces() {
    const supabase = createClient();
    const { data } = await supabase
      .from("running_paces")
      .select("*")
      .order("created_at");
    setPaces(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadPaces(); }, []);

  function startEdit(pace: RunningPace) {
    setEditingId(pace.id);
    setEditName(pace.name);
    setEditPaceStr(formatPace(pace.pace_seconds_per_mile));
    setError(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const seconds = parsePace(newPaceStr);
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
    const seconds = parsePace(editPaceStr);
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

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Running Paces</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Save your training paces so the app can estimate workout durations.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-[var(--muted)]">Loading…</div>
        ) : paces.length === 0 ? (
          <div className="p-6 text-sm text-[var(--muted)]">No paces yet. Add one below.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-xs text-[var(--muted)] font-medium">Name</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--muted)] font-medium">Pace / mile</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paces.map((pace) => (
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
                          placeholder="MM:SS"
                          className="w-24 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm focus:outline-none"
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
                      <td className="px-4 py-3 font-mono">{formatPace(pace.pace_seconds_per_mile)}</td>
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
        )}

        <form onSubmit={handleAdd} className="flex gap-2 p-4 border-t border-[var(--border)] bg-[var(--card)]">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Pace name (e.g. Easy)"
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <input
            value={newPaceStr}
            onChange={(e) => setNewPaceStr(e.target.value)}
            placeholder="MM:SS"
            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
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

      <PaceCalculator paces={paces} />
    </div>
  );
}
