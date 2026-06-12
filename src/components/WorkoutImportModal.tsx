"use client";

import { useRef, useState } from "react";
import { importWorkouts, type ImportWorkoutRow } from "@/app/actions/workouts";

interface WorkoutImportModalProps {
  planId: string;
  onClose: () => void;
  onImported: () => void;
}

const VALID_TYPES = new Set(["run", "strength", "rest", "cross_train"]);
const VALID_RUN_TYPES = new Set(["easy_run", "tempo_run", "interval_run", "threshold_run", "recovery_run", "race", "long_run"]);
const VALID_PACE_TYPES = new Set(["easy", "tempo", "threshold", "race", "interval"]);

function parseCSV(text: string): ImportWorkoutRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: ImportWorkoutRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = cols[idx] ?? ""; });

    const week = parseInt(raw.week, 10);
    const day = parseInt(raw.day, 10);
    if (isNaN(week) || isNaN(day)) throw new Error(`Row ${i + 1}: week and day must be numbers`);

    const type = raw.type as ImportWorkoutRow["type"];
    if (!VALID_TYPES.has(type)) throw new Error(`Row ${i + 1}: invalid type "${raw.type}"`);

    const run_type = raw.run_type && VALID_RUN_TYPES.has(raw.run_type)
      ? (raw.run_type as ImportWorkoutRow["run_type"])
      : null;
    const pace_type = raw.pace_type && VALID_PACE_TYPES.has(raw.pace_type)
      ? (raw.pace_type as ImportWorkoutRow["pace_type"])
      : null;

    rows.push({
      week,
      day,
      type,
      run_type,
      title: raw.title || "Untitled",
      description: raw.description || null,
      distance_miles: raw.distance_miles ? parseFloat(raw.distance_miles) : null,
      pace_type,
      duration_minutes: raw.duration_minutes ? parseInt(raw.duration_minutes, 10) : null,
      notes: raw.notes || null,
    });
  }
  return rows;
}

function parseJSON(text: string): ImportWorkoutRow[] {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("JSON must be an array of workout objects");
  return parsed.map((item, i) => {
    if (typeof item.week !== "number" || typeof item.day !== "number") {
      throw new Error(`Item ${i + 1}: "week" and "day" must be numbers`);
    }
    if (!VALID_TYPES.has(item.type)) {
      throw new Error(`Item ${i + 1}: invalid type "${item.type}"`);
    }
    return {
      week: item.week,
      day: item.day,
      type: item.type,
      run_type: item.run_type ?? null,
      title: item.title || "Untitled",
      description: item.description ?? null,
      distance_miles: item.distance_miles ?? null,
      pace_type: item.pace_type ?? null,
      duration_minutes: item.duration_minutes ?? null,
      notes: item.notes ?? null,
      steps: item.steps ?? undefined,
    } as ImportWorkoutRow;
  });
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WorkoutImportModal({ planId, onClose, onImported }: WorkoutImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportWorkoutRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setRows(null);
    const text = await file.text();
    try {
      const parsed = file.name.endsWith(".json") ? parseJSON(text) : parseCSV(text);
      if (parsed.length === 0) throw new Error("No workouts found in file");
      setRows(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse file");
    }
  }

  async function handleImport() {
    if (!rows) return;
    setImporting(true);
    setImportError(null);
    try {
      await importWorkouts(planId, rows);
      onImported();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Import workouts</h2>
            <button
              onClick={onClose}
              className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="space-y-2 text-sm text-[var(--muted)]">
            <p>Upload a <strong>.csv</strong> or <strong>.json</strong> file. Workouts will be added to this plan without removing existing ones.</p>
            <details className="text-xs">
              <summary className="cursor-pointer hover:text-[var(--foreground)]">Show expected format</summary>
              <div className="mt-2 space-y-3">
                <div>
                  <p className="font-medium text-[var(--foreground)] mb-1">CSV columns:</p>
                  <code className="block bg-[var(--card)] rounded p-2 whitespace-pre-wrap">week,day,type,run_type,title,description,distance_miles,pace_type,duration_minutes,notes{"\n"}1,0,run,easy_run,Easy run,,5,easy,60,{"\n"}1,2,strength,,Upper body,,,, 45,</code>
                  <p className="mt-1">day is 0–6 (Mon–Sun)</p>
                </div>
                <div>
                  <p className="font-medium text-[var(--foreground)] mb-1">JSON array:</p>
                  <code className="block bg-[var(--card)] rounded p-2 whitespace-pre-wrap">{`[{ "week": 1, "day": 0, "type": "run", "run_type": "easy_run",\n  "title": "Easy run", "distance_miles": 5, "pace_type": "easy" }]`}</code>
                </div>
              </div>
            </details>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFile}
              className="block w-full text-sm text-[var(--muted)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[var(--foreground)] file:text-[var(--background)] hover:file:opacity-90 cursor-pointer"
            />
          </div>

          {parseError && (
            <p className="text-sm text-red-600 dark:text-red-400">{parseError}</p>
          )}

          {rows && rows.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Preview — {rows.length} workout{rows.length !== 1 ? "s" : ""} found
              </p>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--card)] text-[var(--muted)]">
                      <th className="px-3 py-2 text-left font-medium">Wk</th>
                      <th className="px-3 py-2 text-left font-medium">Day</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Title</th>
                      <th className="px-3 py-2 text-left font-medium">Dist</th>
                      <th className="px-3 py-2 text-left font-medium">Pace</th>
                      <th className="px-3 py-2 text-left font-medium">Min</th>
                      <th className="px-3 py-2 text-left font-medium">Steps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t border-[var(--border)]">
                        <td className="px-3 py-2">{row.week}</td>
                        <td className="px-3 py-2">{DAY_NAMES[row.day] ?? row.day}</td>
                        <td className="px-3 py-2">{row.run_type ?? row.type}</td>
                        <td className="px-3 py-2 max-w-[140px] truncate">{row.title}</td>
                        <td className="px-3 py-2">{row.distance_miles ?? "—"}</td>
                        <td className="px-3 py-2">{row.pace_type ?? "—"}</td>
                        <td className="px-3 py-2">{row.duration_minutes ?? "—"}</td>
                        <td className="px-3 py-2">{row.steps?.length ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importError && (
            <p className="text-sm text-red-600 dark:text-red-400">{importError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleImport}
              disabled={!rows || importing}
              className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {importing ? "Importing…" : rows ? `Import ${rows.length} workout${rows.length !== 1 ? "s" : ""}` : "Choose a file first"}
            </button>
            <button
              type="button"
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
