"use client";

import { useRef, useState } from "react";
import { importExercises, updateExercisesFromImport, type ExerciseImportRow } from "@/app/actions/exercises";
import { isUpdateImport, parseExerciseUpdateRecords, type ExerciseUpdateRow } from "@/lib/exerciseUpdateImport";
import { LOADING_CATEGORY_LABELS } from "@/lib/paceUtils";
import { EXERCISE_TYPE_LABELS } from "@/lib/paceUtils";
import { splitCSVLine, splitCSVRecords } from "@/lib/csvUtils";
import { parseSources } from "@/lib/exerciseSources";
import { MUSCLE_GROUP_LABELS, parseMuscleGroups } from "@/lib/muscleGroups";
import { EQUIPMENT_LABELS, parseEquipment } from "@/lib/equipment";

function muscleGroupsOrThrow(input: unknown, where: string): string[] {
  const { groups, unknown } = parseMuscleGroups(input);
  if (unknown.length) {
    throw new Error(`${where}: unknown muscle group "${unknown[0]}" — use one of ${Object.values(MUSCLE_GROUP_LABELS).join(", ")}`);
  }
  return groups;
}

function equipmentOrThrow(input: unknown, where: string): string[] {
  const { tags, unknown } = parseEquipment(input);
  if (unknown.length) {
    throw new Error(`${where}: unknown equipment "${unknown[0]}" — use one of ${Object.values(EQUIPMENT_LABELS).join(", ")}`);
  }
  return tags;
}

const VALID_TYPES = new Set(Object.keys(EXERCISE_TYPE_LABELS));

const SAMPLE_CSV = [
  "name,exercise_type,description,video_url,source,muscle_groups,equipment",
  "Barbell Squat,lower_body,\"3 sets of 8 — drive through heels, brace core\",,Coach; YouTube,Thighs; Hips & Glutes,Barbell",
  "Hip Flexor Stretch,stretch,30s each side — lunge position,,,Hips & Glutes,",
  "Box Jump,plyos,Jump onto box and land softly with bent knees,,,Thighs; Lower Legs,Box / step",
  "Leg Swing,warm_up,10 reps each direction,,,Hips & Glutes,Wall",
  "Foam Roll Quads,mobility,60s per side — pause on tight spots,,YouTube,Thighs,Foam roller",
].join("\n");

function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "exercise_import_sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function readCSV(text: string): { headers: string[]; records: Record<string, string>[] } {
  const lines = splitCSVRecords(text.replace(/^\uFEFF/, ""));
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");
  const headers = splitCSVLine(lines[0]).map((h) => h.toLowerCase());
  const records = lines.slice(1).map((line) => {
    const cols = splitCSVLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = cols[idx] ?? ""; });
    return raw;
  });
  return { headers, records };
}

function parseCSV(text: string): ExerciseImportRow[] {
  const { records } = readCSV(text);
  const rows: ExerciseImportRow[] = [];

  for (let i = 1; i <= records.length; i++) {
    const raw = records[i - 1];

    const name = raw.name?.trim();
    if (!name) throw new Error(`Row ${i + 1}: name is required`);

    const rawType = raw.exercise_type?.trim() ?? "";
    rows.push({
      name,
      exercise_type: VALID_TYPES.has(rawType) ? rawType : null,
      description: raw.description?.trim() || null,
      video_url: raw.video_url?.trim() || null,
      sources: parseSources(raw.source ?? raw.sources),
      muscle_groups: muscleGroupsOrThrow(raw.muscle_groups, `Row ${i + 1}`),
      equipment: equipmentOrThrow(raw.equipment, `Row ${i + 1}`),
    });
  }
  return rows;
}

function parseJSON(text: string): ExerciseImportRow[] {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("JSON must be an array of exercise objects");
  return parsed.map((item, i) => {
    const name = item.name?.trim();
    if (!name) throw new Error(`Item ${i + 1}: name is required`);
    const rawType = item.exercise_type ?? "";
    return {
      name,
      exercise_type: VALID_TYPES.has(rawType) ? rawType : null,
      description: item.description ?? null,
      video_url: item.video_url ?? null,
      sources: parseSources(item.sources ?? item.source),
      muscle_groups: muscleGroupsOrThrow(item.muscle_groups, `Item ${i + 1}`),
      equipment: equipmentOrThrow(item.equipment, `Item ${i + 1}`),
    };
  });
}

export function ExerciseImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ExerciseImportRow[] | null>(null);
  // Set instead of `rows` when the CSV has an `id` column (update existing exercises).
  const [updateRows, setUpdateRows] = useState<ExerciseUpdateRow[] | null>(null);
  const [unmatched, setUnmatched] = useState<string[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setRows(null);
    setUpdateRows(null);
    setUnmatched(null);
    const text = await file.text();
    try {
      if (!file.name.endsWith(".json")) {
        const { headers, records } = readCSV(text);
        if (isUpdateImport(headers)) {
          const parsedUpdates = parseExerciseUpdateRecords(records);
          if (parsedUpdates.length === 0) throw new Error("No exercises found in file");
          setUpdateRows(parsedUpdates);
          return;
        }
      }
      const parsed = file.name.endsWith(".json") ? parseJSON(text) : parseCSV(text);
      if (parsed.length === 0) throw new Error("No exercises found in file");
      setRows(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse file");
    }
  }

  async function handleImport() {
    if (updateRows) {
      setImporting(true);
      setImportError(null);
      try {
        const result = await updateExercisesFromImport(updateRows);
        if (result.unmatched.length) {
          setUnmatched(result.unmatched);
          setImporting(false);
        } else {
          onImported();
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Update failed");
        setImporting(false);
      }
      return;
    }
    if (!rows) return;
    setImporting(true);
    setImportError(null);
    try {
      await importExercises(rows);
      onImported();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-2xl bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90dvh] sm:max-h-[90vh]">
        <div className="p-4 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Import exercises</h2>
            <button
              onClick={onClose}
              className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-3 text-sm">
            <p className="text-[var(--muted)]">
              Upload a <strong>.csv</strong> or <strong>.json</strong> file to bulk-add exercises to your library.
            </p>
            <p className="text-xs text-[var(--muted)]">
              <strong className="text-[var(--foreground)]">To update existing exercises</strong> instead, include an{" "}
              <code className="text-[var(--foreground)]">id</code> column (Export includes it). Rows match by id, or by exact
              name when id is blank. Only the columns in the file change, blank cells leave a value as it is, and the name is
              never changed. Updatable columns also include <code className="text-[var(--foreground)]">loading_category</code>,{" "}
              <code className="text-[var(--foreground)]">track_load</code>, <code className="text-[var(--foreground)]">load_format</code> and{" "}
              <code className="text-[var(--foreground)]">default_increment</code>.
            </p>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Columns (CSV)</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-[var(--muted)]">
                <span><code className="text-[var(--foreground)]">name</code> — exercise name (required)</span>
                <span><code className="text-[var(--foreground)]">exercise_type</code> — warm_up, stretch, upper_body, lower_body, full_body, plyos, core, mobility</span>
                <span><code className="text-[var(--foreground)]">description</code> — coaching notes or cues (optional)</span>
                <span><code className="text-[var(--foreground)]">video_url</code> — link to video (optional)</span>
                <span><code className="text-[var(--foreground)]">source</code> — coach, book, etc.; separate several with <code className="text-[var(--foreground)]">;</code> (optional)</span>
                <span className="col-span-2"><code className="text-[var(--foreground)]">muscle_groups</code> — any of {Object.values(MUSCLE_GROUP_LABELS).join(", ")}; separate several with <code className="text-[var(--foreground)]">;</code> (optional)</span>
                <span className="col-span-2"><code className="text-[var(--foreground)]">equipment</code> — e.g. Dumbbells, Mini band, TRX, Box / step; separate several with <code className="text-[var(--foreground)]">;</code> (optional)</span>
              </div>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Wrap fields containing commas in double quotes (e.g. <code className="text-[var(--foreground)]">&quot;3 sets, 8 reps&quot;</code>).
              Unknown exercise types are imported without a type tag.
            </p>
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

          {updateRows && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Update preview — {updateRows.length} existing exercise{updateRows.length !== 1 ? "s" : ""} (nothing new is created)
              </p>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)] max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--card)] text-[var(--muted)]">
                      <th className="px-3 py-2 text-left font-medium">Exercise</th>
                      <th className="px-3 py-2 text-left font-medium">Changes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {updateRows.map((row, i) => {
                      const f = row.fields;
                      const parts = [
                        f.exercise_type && `Type: ${EXERCISE_TYPE_LABELS[f.exercise_type] ?? f.exercise_type}`,
                        f.equipment && `Equipment: ${f.equipment.map((k) => EQUIPMENT_LABELS[k]).join(", ") || "none"}`,
                        f.loading_category && `Loading: ${LOADING_CATEGORY_LABELS[f.loading_category]}`,
                        f.muscle_groups && `Muscles: ${f.muscle_groups.map((g) => MUSCLE_GROUP_LABELS[g]).join(", ")}`,
                        f.sources && `Sources: ${f.sources.join(", ")}`,
                        f.track_load !== undefined && `Track weights: ${f.track_load ? "on" : "off"}`,
                        f.load_format && `Load format: ${f.load_format}`,
                        f.default_increment !== undefined && `Increment: ${f.default_increment}`,
                        f.description && "Description",
                        f.video_url && "Video",
                      ].filter(Boolean);
                      return (
                        <tr key={i} className="border-t border-[var(--border)] align-top">
                          <td className="px-3 py-2 font-medium whitespace-nowrap">{row.name ?? row.id}</td>
                          <td className="px-3 py-2 text-[var(--muted)]">{parts.length ? parts.join(" · ") : "No changes"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {unmatched && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-3 text-sm space-y-2">
              <p>
                Updated the matching exercises. {unmatched.length} row{unmatched.length !== 1 ? "s" : ""} didn&apos;t match an
                exercise of yours and {unmatched.length !== 1 ? "were" : "was"} skipped:
              </p>
              <p className="text-xs text-[var(--muted)]">{unmatched.join(", ")}</p>
              <button type="button" onClick={onImported} className="text-sm font-medium text-[var(--accent)] hover:underline">
                Done
              </button>
            </div>
          )}

          {rows && rows.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Preview — {rows.length} exercise{rows.length !== 1 ? "s" : ""} found
              </p>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--card)] text-[var(--muted)]">
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Description</th>
                      <th className="px-3 py-2 text-left font-medium">Source</th>
                      <th className="px-3 py-2 text-left font-medium">Muscle groups</th>
                      <th className="px-3 py-2 text-left font-medium">Equipment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t border-[var(--border)]">
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{row.name}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row.exercise_type
                            ? (EXERCISE_TYPE_LABELS[row.exercise_type] ?? row.exercise_type)
                            : <span className="text-[var(--muted)]">—</span>}
                        </td>
                        <td className="px-3 py-2 max-w-[200px] truncate text-[var(--muted)]">
                          {row.description ?? "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-[var(--muted)]">
                          {row.sources.length ? row.sources.join(", ") : "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-[var(--muted)]">
                          {row.muscle_groups?.length ? row.muscle_groups.map((g) => MUSCLE_GROUP_LABELS[g]).join(", ") : "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-[var(--muted)]">
                          {row.equipment?.length ? row.equipment.map((k) => EQUIPMENT_LABELS[k]).join(", ") : "—"}
                        </td>
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
              disabled={(!rows && !updateRows) || importing || !!unmatched}
              className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {importing
                ? "Importing…"
                : updateRows
                ? `Update ${updateRows.length} exercise${updateRows.length !== 1 ? "s" : ""}`
                : rows
                ? `Import ${rows.length} exercise${rows.length !== 1 ? "s" : ""}`
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
