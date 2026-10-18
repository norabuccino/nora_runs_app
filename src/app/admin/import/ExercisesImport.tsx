"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { adminImportExercises } from "@/app/actions/adminImport";
import { parseExerciseList } from "@/lib/exerciseTextImport";
import { normalizeExerciseName } from "@/lib/exerciseMatch";
import { EXERCISE_TYPE_LABELS } from "@/lib/paceUtils";
import { EQUIPMENT_LABELS } from "@/lib/equipment";
import { MUSCLE_GROUP_LABELS } from "@/lib/muscleGroups";

const PLACEHOLDER = `Goblet Squat
Hold a kettlebell at your chest and sit back between your heels.
Source: Coach Sam

Dead Bugs - Lie on your back, arms up; lower opposite arm and leg.
Clamshells
Copenhagen Plank

Box Jumps
Type: Plyos
Equipment: box`;

/** Add many exercises from a plain list, with equipment / muscle groups / type suggested from each name and description. */
export function ExercisesImport() {
  const [text, setText] = useState("");
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [useSuggestions, setUseSuggestions] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [typeOverrides, setTypeOverrides] = useState<Record<number, string>>({});
  const [included, setIncluded] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("exercises")
      .select("name")
      .then(({ data }) => setExisting(new Set((data ?? []).map((e) => normalizeExerciseName(e.name)))));
  }, []);

  const entries = useMemo(() => parseExerciseList(text), [text]);
  const rows = entries.map((e, i) => {
    const exists = existing.has(normalizeExerciseName(e.name));
    const equipment = useSuggestions || !e.suggested.equipment ? e.equipment : [];
    const muscle_groups = useSuggestions || !e.suggested.muscle_groups ? e.muscle_groups : [];
    const exercise_type = typeOverrides[i] ?? (useSuggestions || !e.suggested.exercise_type ? e.exercise_type : null) ?? "";
    return { entry: e, exists, include: included[i] ?? !exists, equipment, muscle_groups, exercise_type };
  });
  const toSave = rows.filter((r) => r.include);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { count } = await adminImportExercises(
        toSave.map((r) => ({
          name: r.entry.name,
          exercise_type: r.exercise_type || null,
          description: r.entry.description,
          video_url: r.entry.video_url,
          sources: r.entry.sources,
          muscle_groups: r.muscle_groups,
          equipment: r.equipment,
          is_private: isPrivate,
        }))
      );
      setMessage(`Added ${count} ${count === 1 ? "exercise" : "exercises"}.`);
      setText("");
      setTypeOverrides({});
      setIncluded({});
      setExisting((prev) => new Set([...prev, ...toSave.map((r) => normalizeExerciseName(r.entry.name))]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSaving(false);
    }
  }

  const chip = (label: string, suggested: boolean) => (
    <span
      key={label}
      className={`px-1.5 py-0.5 rounded-full text-[11px] ${suggested ? "border border-dashed border-[var(--accent)] text-[var(--accent)]" : "border border-[var(--border)]"}`}
    >
      {label}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMessage(null);
          }}
          placeholder={PLACEHOLDER}
          rows={12}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y"
        />
        <p className="text-xs text-[var(--muted)]">
          One exercise per line (<code>Name - description</code> works), or a name followed by its description, with a blank line between
          exercises. Optional lines: <code>Type:</code>, <code>Equipment:</code>, <code>Muscles:</code>, <code>Source:</code>,{" "}
          <code>Video:</code>.
        </p>
      </div>

      {entries.length > 0 && (
        <>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={useSuggestions} onChange={(e) => setUseSuggestions(e.target.checked)} className="accent-[var(--accent)]" />
              Use suggested type, equipment and muscle groups <span className="text-xs text-[var(--muted)]">(dashed)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="accent-[var(--accent)]" />
              Private
            </label>
          </div>

          <ul className="space-y-1.5">
            {rows.map((r, i) => (
              <li key={i} className={`rounded-lg border border-[var(--border)] p-2 space-y-1 ${r.include ? "" : "opacity-50"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={(e) => setIncluded((p) => ({ ...p, [i]: e.target.checked }))}
                      className="accent-[var(--accent)]"
                    />
                    {r.entry.name}
                    {r.exists && <span className="text-xs font-normal text-amber-600 dark:text-amber-400">already in the library</span>}
                  </label>
                  <select
                    value={r.exercise_type}
                    onChange={(e) => setTypeOverrides((p) => ({ ...p, [i]: e.target.value }))}
                    className="rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs"
                    aria-label="Exercise type"
                  >
                    <option value="">— No type —</option>
                    {Object.entries(EXERCISE_TYPE_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.muscle_groups.map((g) => chip(MUSCLE_GROUP_LABELS[g], r.entry.suggested.muscle_groups))}
                  {r.equipment.map((k) => chip(EQUIPMENT_LABELS[k], r.entry.suggested.equipment))}
                  {r.entry.sources.map((s) => chip(s, false))}
                </div>
                {r.entry.description && <p className="text-xs text-[var(--muted)] line-clamp-2">{r.entry.description}</p>}
                {r.entry.unknown.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">Not recognized: {r.entry.unknown.join(", ")}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}

      <button
        onClick={handleSave}
        disabled={saving || toSave.length === 0}
        className="w-full rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? "Adding…" : `Add ${toSave.length} ${toSave.length === 1 ? "exercise" : "exercises"}`}
      </button>
    </div>
  );
}
