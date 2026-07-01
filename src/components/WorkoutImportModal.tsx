"use client";

import { useRef, useState } from "react";
import { importLibraryWorkouts, type LibraryImportRow, type ImportStepRow } from "@/app/actions/workoutLibrary";

interface WorkoutImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

const VALID_TYPES = new Set([
  "run", "strength", "rest", "cross_train", "bike", "swim", "yoga", "elliptical",
]);
const VALID_RUN_TYPES = new Set([
  "easy_run", "tempo_run", "interval_run", "threshold_run", "recovery_run", "race", "long_run", "mp_hmp_run",
]);
const VALID_UNITS = new Set(["mi", "km", "m"]);

// ── Sample file content ────────────────────────────────────────────────────────

const SAMPLE_CSV = [
  "type,run_type,strength_type,title,description,distance,distance_unit,pace_type,duration_minutes,notes",
  "run,easy_run,,Easy run,Comfortable conversational pace,6,mi,Easy,60,",
  "run,long_run,,Long run,Slow and steady long effort,14,mi,Easy,,",
  "run,tempo_run,,Tempo run,Comfortably hard pace,5,mi,Tempo,40,",
  "run,interval_run,,Track intervals,8x800m at fast pace,4,mi,Interval,50,",
  "strength,,upper_body,Upper body,Push/pull day — 3 sets of 8,,,,45,",
  "strength,,lower_body,Lower body,Squat and hinge focus,,,,50,",
  "bike,,,Easy bike,Low effort recovery spin,12,mi,,45,",
  "swim,,,Swim workout,Endurance swim,1500,m,,45,",
  "yoga,,,Yoga flow,Full body mobility and recovery,,,,60,Recovery focused",
  "elliptical,,,Elliptical cardio,Steady-state cardio,,,,30,",
].join("\n");

const SAMPLE_JSON = JSON.stringify(
  [
    {
      type: "strength",
      strength_type: "upper_body",
      title: "Upper Body Supersets",
      description: "Push/pull supersets — 3 rounds each",
      duration_minutes: 55,
      steps: [
        {
          group_name: "Superset A — Push/Pull",
          repeat_count: 3,
          exercises: [
            { exercise_name: "Barbell Bench Press", reps: 8, weight_suggestion: "moderate" },
            { exercise_name: "Bent-Over Row", reps: 8, weight_suggestion: "moderate" },
          ],
        },
        {
          group_name: "Superset B — Shoulder/Back",
          repeat_count: 3,
          exercises: [
            { exercise_name: "Dumbbell Shoulder Press", reps: 10, weight_suggestion: "light" },
            { exercise_name: "Lat Pulldown", reps: 10 },
          ],
        },
        { exercise_name: "Push-Up", sets: 2, reps: 15, notes: "To failure on last set" },
      ],
    },
    {
      type: "strength",
      strength_type: "lower_body",
      title: "Lower Body Day",
      description: "Squat and hinge — straight sets",
      duration_minutes: 50,
      steps: [
        { exercise_name: "Barbell Squat", sets: 4, reps: 6, weight_suggestion: "heavy" },
        { exercise_name: "Romanian Deadlift", sets: 3, reps: 10, weight_suggestion: "moderate" },
        { exercise_name: "Bulgarian Split Squat", sets: 3, reps: 8, both_sides: true, weight_suggestion: "light" },
        { exercise_name: "Calf Raise", sets: 3, reps: 15 },
      ],
    },
    {
      type: "run",
      run_type: "interval_run",
      title: "Track Intervals",
      description: "8x800m workout",
      steps: [
        { step_type: "warmup", duration_minutes: 15, pace_type: "Easy" },
        {
          group_name: "8x800m",
          repeat_count: 8,
          exercises: [
            { step_type: "main", distance_miles: 0.5, pace_type: "Interval" },
            { step_type: "recovery", distance_miles: 0.25, pace_type: "Easy" },
          ],
        },
        { step_type: "cooldown", duration_minutes: 10, pace_type: "Easy" },
      ],
    },
  ],
  null,
  2
);

function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "workout_import_sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function downloadSampleJSON() {
  const blob = new Blob([SAMPLE_JSON], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "workout_import_sample.json";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Step parsers ───────────────────────────────────────────────────────────────

function parseStep(raw: Record<string, unknown>): ImportStepRow {
  return {
    step_type: typeof raw.step_type === "string" ? raw.step_type : "main",
    exercise_name: typeof raw.exercise_name === "string" ? raw.exercise_name : null,
    label: typeof raw.label === "string" ? raw.label : null,
    pace_type: typeof raw.pace_type === "string" ? raw.pace_type : null,
    duration_minutes: raw.duration_minutes != null ? Number(raw.duration_minutes) || null : null,
    distance_miles: raw.distance_miles != null ? Number(raw.distance_miles) || null : null,
    distance_unit: typeof raw.distance_unit === "string" && VALID_UNITS.has(raw.distance_unit) ? raw.distance_unit : "mi",
    sets: raw.sets != null ? parseInt(String(raw.sets), 10) || null : null,
    reps: raw.reps != null ? parseInt(String(raw.reps), 10) || null : null,
    weight_suggestion: typeof raw.weight_suggestion === "string" ? raw.weight_suggestion : null,
    both_sides: raw.both_sides === true,
    notes: typeof raw.notes === "string" ? raw.notes : null,
    repeat_count: raw.repeat_count != null ? parseInt(String(raw.repeat_count), 10) || 1 : 1,
    group_name: typeof raw.group_name === "string" ? raw.group_name : null,
  };
}

// Handles three formats in a steps array:
//   1. Nested group: { group_name, repeat_count, exercises: [...] }
//   2. Flat step with group label: { ..., group: "A", repeat_count: 3 }
//   3. Regular flat step (no grouping)
// Resolves all forms to flat ImportStepRow[] with repeat_group_id set.
function processSteps(rawSteps: unknown[]): ImportStepRow[] {
  const result: ImportStepRow[] = [];
  let nextGroupId = 1;
  // flat format: group label → { id, repeatCount }
  const flatGroups = new Map<string, { id: number; repeatCount: number }>();

  for (const raw of rawSteps) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;

    if (Array.isArray(item.exercises)) {
      // Nested group / superset
      const groupName = typeof item.group_name === "string" ? item.group_name : null;
      const repeatCount = item.repeat_count != null ? Math.max(1, parseInt(String(item.repeat_count), 10) || 1) : 1;
      const groupId = nextGroupId++;

      for (const ex of item.exercises as unknown[]) {
        if (!ex || typeof ex !== "object") continue;
        result.push({
          ...parseStep(ex as Record<string, unknown>),
          repeat_group_id: groupId,
          repeat_count: repeatCount,
          group_name: groupName,
        });
      }
    } else {
      const step = parseStep(item);
      const groupLabel = typeof item.group === "string" ? item.group.trim() : null;

      if (groupLabel) {
        // Flat group label format
        const key = groupLabel.toLowerCase();
        const existing = flatGroups.get(key);
        if (existing) {
          result.push({ ...step, repeat_group_id: existing.id, repeat_count: step.repeat_count ?? existing.repeatCount });
        } else {
          const groupId = nextGroupId++;
          flatGroups.set(key, { id: groupId, repeatCount: step.repeat_count ?? 1 });
          result.push({ ...step, repeat_group_id: groupId, group_name: step.group_name ?? groupLabel });
        }
      } else {
        result.push({ ...step, repeat_group_id: null });
      }
    }
  }

  return result;
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
      strength_type: raw.strength_type?.trim() || null,
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
  return parsed.map((item: Record<string, unknown>, i) => {
    if (!VALID_TYPES.has(String(item.type ?? "")))
      throw new Error(`Item ${i + 1}: invalid type "${item.type}"`);
    const rawUnit = typeof item.distance_unit === "string" ? item.distance_unit : "mi";

    const rawSteps = Array.isArray(item.steps) ? item.steps : [];
    const steps = processSteps(rawSteps);

    return {
      type: item.type as LibraryImportRow["type"],
      run_type: typeof item.run_type === "string" ? item.run_type as LibraryImportRow["run_type"] : null,
      strength_type: typeof item.strength_type === "string" ? item.strength_type : null,
      title: typeof item.title === "string" ? item.title || "Untitled" : "Untitled",
      description: typeof item.description === "string" ? item.description : null,
      distance_miles: item.distance != null ? Number(item.distance) || null
        : item.distance_miles != null ? Number(item.distance_miles) || null : null,
      distance_unit: VALID_UNITS.has(rawUnit) ? rawUnit : "mi",
      pace_type: typeof item.pace_type === "string" ? item.pace_type : null,
      duration_minutes: item.duration_minutes != null ? Number(item.duration_minutes) || null : null,
      notes: typeof item.notes === "string" ? item.notes : null,
      steps: steps.length > 0 ? steps : undefined,
    } satisfies LibraryImportRow;
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WorkoutImportModal({ onClose, onImported }: WorkoutImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<LibraryImportRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [unmatchedExercises, setUnmatchedExercises] = useState<string[]>([]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setRows(null);
    setUnmatchedExercises([]);
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
    setUnmatchedExercises([]);
    try {
      const result = await importLibraryWorkouts(rows);
      if (result.unmatchedExercises.length > 0) {
        setUnmatchedExercises(result.unmatchedExercises);
      } else {
        onImported();
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
      setImporting(false);
    }
  }

  const totalSteps = rows?.reduce((sum, r) => sum + (r.steps?.length ?? 0), 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-2xl bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90dvh] sm:max-h-[90vh]">
        <div className="p-4 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Import to library</h2>
            <button
              onClick={onClose}
              className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Instructions + sample downloads */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-[var(--muted)]">
                Upload a <strong>.csv</strong> or <strong>.json</strong> file to bulk-add workouts to your library.
                Use CSV for simple workout imports, or JSON to include steps and exercises.
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">CSV columns</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-[var(--muted)]">
                <span><code className="text-[var(--foreground)]">type</code> — run, strength, bike, swim, yoga, elliptical, cross_train, rest</span>
                <span><code className="text-[var(--foreground)]">title</code> — workout name</span>
                <span><code className="text-[var(--foreground)]">run_type</code> — easy_run, long_run, interval_run, threshold_run, recovery_run, race (runs only)</span>
                <span><code className="text-[var(--foreground)]">strength_type</code> — upper_body, lower_body, full_body, core (strength only)</span>
                <span><code className="text-[var(--foreground)]">distance</code> + <code className="text-[var(--foreground)]">distance_unit</code> — e.g. 6, mi  (mi / km / m)</span>
                <span><code className="text-[var(--foreground)]">pace_type</code> — matches a pace name you've saved</span>
                <span><code className="text-[var(--foreground)]">duration_minutes</code> — number</span>
                <span><code className="text-[var(--foreground)]">description</code>, <code className="text-[var(--foreground)]">notes</code> — optional text</span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">JSON — steps, groups &amp; supersets</p>
              <p className="text-xs text-[var(--muted)]">
                Each JSON workout can include a <code className="text-[var(--foreground)]">steps</code> array. Steps can be flat (one exercise per object) or grouped into supersets.
              </p>
              <p className="text-xs text-[var(--muted)]">
                <strong className="text-[var(--foreground)]">Flat step fields:</strong> <code className="text-[var(--foreground)]">exercise_name</code> (auto-links to your library), <code className="text-[var(--foreground)]">sets</code>, <code className="text-[var(--foreground)]">reps</code>, <code className="text-[var(--foreground)]">weight_suggestion</code>, <code className="text-[var(--foreground)]">both_sides</code>, <code className="text-[var(--foreground)]">step_type</code>, <code className="text-[var(--foreground)]">pace_type</code>, <code className="text-[var(--foreground)]">duration_minutes</code>, <code className="text-[var(--foreground)]">distance_miles</code>, <code className="text-[var(--foreground)]">notes</code>.
              </p>
              <p className="text-xs text-[var(--muted)]">
                <strong className="text-[var(--foreground)]">Named group / superset:</strong> use <code className="text-[var(--foreground)]">{"{ group_name, repeat_count, exercises: [...] }"}</code> anywhere in the steps array to group exercises. The sample JSON shows both patterns.
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
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
              <button
                type="button"
                onClick={downloadSampleJSON}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 12l-4-4h2.5V3h3v5H12L8 12z"/>
                  <path d="M2 14h12v-1.5H2V14z"/>
                </svg>
                Download sample JSON (with steps)
              </button>
            </div>
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
                Preview — {rows.length} workout{rows.length !== 1 ? "s" : ""}
                {totalSteps > 0 && `, ${totalSteps} step${totalSteps !== 1 ? "s" : ""}`}
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
                      <th className="px-3 py-2 text-left font-medium">Steps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t border-[var(--border)]">
                        <td className="px-3 py-2 whitespace-nowrap">{row.run_type ?? row.strength_type ?? row.type}</td>
                        <td className="px-3 py-2 max-w-[140px] truncate">{row.title}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row.distance_miles ? `${row.distance_miles} ${row.distance_unit ?? "mi"}` : "—"}
                        </td>
                        <td className="px-3 py-2">{row.pace_type ?? "—"}</td>
                        <td className="px-3 py-2">{row.duration_minutes ?? "—"}</td>
                        <td className="px-3 py-2">{row.steps?.length ?? "—"}</td>
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

          {/* Unmatched exercise notice */}
          {unmatchedExercises.length > 0 && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 space-y-2">
              <p className="text-sm font-medium">Workouts imported successfully.</p>
              <p className="text-xs text-[var(--muted)]">
                These exercise names weren&apos;t found in your library and were saved as unlinked labels. You can link them later by editing each workout step.
              </p>
              <ul className="text-xs text-[var(--muted)] list-disc list-inside space-y-0.5">
                {unmatchedExercises.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onImported}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Close
              </button>
            </div>
          )}

          {unmatchedExercises.length === 0 && (
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
          )}
        </div>
      </div>
    </div>
  );
}
