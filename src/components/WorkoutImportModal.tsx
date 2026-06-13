"use client";

import { useRef, useState } from "react";
import { importLibraryWorkouts, type LibraryImportRow } from "@/app/actions/workoutLibrary";

interface WorkoutImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

const VALID_TYPES = new Set([
  "run", "strength", "rest", "cross_train", "bike", "swim", "yoga", "elliptical",
]);
const VALID_RUN_TYPES = new Set([
  "easy_run", "tempo_run", "interval_run", "threshold_run", "recovery_run", "race", "long_run",
]);
const VALID_UNITS = new Set(["mi", "km", "m"]);

// ── Sample file content ────────────────────────────────────────────────────────

const SAMPLE_CSV = [
  "type,run_type,title,description,distance,distance_unit,pace_type,duration_minutes,notes",
  "run,easy_run,Easy run,Comfortable conversational pace,6,mi,Easy,60,",
  "run,long_run,Long run,Slow and steady long effort,14,mi,Easy,,",
  "run,tempo_run,Tempo run,Comfortably hard pace,5,mi,Tempo,40,",
  "run,interval_run,Track intervals,8x800m at fast pace,4,mi,Interval,50,",
  "strength,,Upper body,Push/pull day — 3 sets of 8,,,, 45,",
  "bike,,Easy bike,Low effort recovery spin,12,mi,,45,",
  "swim,,Swim workout,Endurance swim,1500,m,,45,",
  "yoga,,Yoga flow,Full body mobility and recovery,,,, 60,Recovery focused",
  "elliptical,,Elliptical cardio,Steady-state cardio,,,, 30,",
].join("\n");

function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "workout_import_sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Parsers ────────────────────────────────────────────────────────────────────

function parseCSV(text: string): LibraryImportRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: LibraryImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = cols[idx] ?? ""; });

    const type = raw.type;
    if (!VALID_TYPES.has(type)) throw new Error(`Row ${i + 1}: invalid type "${type}". Valid: ${[...VALID_TYPES].join(", ")}`);

    const run_type =
      raw.run_type && VALID_RUN_TYPES.has(raw.run_type) ? raw.run_type as LibraryImportRow["run_type"] : null;

    const rawDist = raw.distance ?? raw.distance_miles ?? "";
    const rawUnit = raw.distance_unit ?? "mi";
    const distance_unit = VALID_UNITS.has(rawUnit) ? rawUnit : "mi";

    rows.push({
      type: type as LibraryImportRow["type"],
      run_type,
      title: raw.title?.trim() || "Untitled",
      description: raw.description?.trim() || null,
      distance_miles: rawDist ? parseFloat(rawDist) : null,
      distance_unit,
      pace_type: raw.pace_type?.trim() || null,
      duration_minutes: raw.duration_minutes ? parseInt(raw.duration_minutes, 10) : null,
      notes: raw.notes?.trim() || null,
    });
  }
  return rows;
}

function parseJSON(text: string): LibraryImportRow[] {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("JSON must be an array of workout objects");
  return parsed.map((item, i) => {
    if (!VALID_TYPES.has(item.type)) throw new Error(`Item ${i + 1}: invalid type "${item.type}"`);
    const rawUnit = item.distance_unit ?? "mi";
    return {
      type: item.type,
      run_type: item.run_type ?? null,
      title: item.title || "Untitled",
      description: item.description ?? null,
      distance_miles: item.distance ?? item.distance_miles ?? null,
      distance_unit: VALID_UNITS.has(rawUnit) ? rawUnit : "mi",
      pace_type: item.pace_type ?? null,
      duration_minutes: item.duration_minutes ?? null,
      notes: item.notes ?? null,
      steps: item.steps ?? undefined,
    } as LibraryImportRow;
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WorkoutImportModal({ onClose, onImported }: WorkoutImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<LibraryImportRow[] | null>(null);
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
      await importLibraryWorkouts(rows);
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
            <h2 className="font-semibold">Import to library</h2>
            <button
              onClick={onClose}
              className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Instructions + sample download */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-3 text-sm">
            <p className="text-[var(--muted)]">
              Upload a <strong>.csv</strong> or <strong>.json</strong> file to bulk-add workouts to your library.
            </p>

            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Required columns (CSV)</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-[var(--muted)]">
                <span><code className="text-[var(--foreground)]">type</code> — run, strength, bike, swim, yoga, elliptical, cross_train, rest</span>
                <span><code className="text-[var(--foreground)]">title</code> — workout name</span>
                <span><code className="text-[var(--foreground)]">run_type</code> — easy_run, long_run, tempo_run, interval_run, threshold_run, recovery_run, race (leave blank if not a run)</span>
                <span><code className="text-[var(--foreground)]">distance</code> + <code className="text-[var(--foreground)]">distance_unit</code> — e.g. 6, mi  (mi / km / m)</span>
                <span><code className="text-[var(--foreground)]">pace_type</code> — matches a pace name you've saved</span>
                <span><code className="text-[var(--foreground)]">duration_minutes</code> — number</span>
                <span><code className="text-[var(--foreground)]">description</code>, <code className="text-[var(--foreground)]">notes</code> — optional text</span>
              </div>
            </div>

            <button
              type="button"
              onClick={downloadSampleCSV}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 12l-4-4h2.5V3h3v5H12L8 12z"/>
                <path d="M2 14h12v-1.5H2V14z"/>
              </svg>
              Download sample CSV
            </button>
          </div>

          {/* File input */}
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

          {/* Preview table */}
          {rows && rows.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Preview — {rows.length} workout{rows.length !== 1 ? "s" : ""} found
              </p>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--card)] text-[var(--muted)]">
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Title</th>
                      <th className="px-3 py-2 text-left font-medium">Distance</th>
                      <th className="px-3 py-2 text-left font-medium">Pace</th>
                      <th className="px-3 py-2 text-left font-medium">Min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t border-[var(--border)]">
                        <td className="px-3 py-2 whitespace-nowrap">{row.run_type ?? row.type}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate">{row.title}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row.distance_miles ? `${row.distance_miles} ${row.distance_unit ?? "mi"}` : "—"}
                        </td>
                        <td className="px-3 py-2">{row.pace_type ?? "—"}</td>
                        <td className="px-3 py-2">{row.duration_minutes ?? "—"}</td>
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
              {importing
                ? "Importing…"
                : rows
                ? `Import ${rows.length} workout${rows.length !== 1 ? "s" : ""} to library`
                : "Choose a file first"}
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
