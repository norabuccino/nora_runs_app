"use client";

import { EQUIPMENT, EQUIPMENT_LABELS } from "@/lib/equipment";
import { useExerciseEquipment } from "@/hooks/useExerciseEquipment";
import {
  type EquipmentAdjustments,
  addEquipment,
  deriveEquipment,
  pruneAdjustments,
  removeEquipment,
  removedDerivedEquipment,
  resolveEquipment,
} from "@/lib/workoutEquipment";

const chipClass = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs";

interface WorkoutEquipmentEditorProps {
  exerciseIds: string[];
  value: EquipmentAdjustments;
  onChange: (value: EquipmentAdjustments) => void;
}

/** Form section: equipment pulled from the workout's exercises, with manual add/remove. */
export function WorkoutEquipmentEditor({ exerciseIds, value, onChange }: WorkoutEquipmentEditorProps) {
  const { equipmentByExercise, loaded } = useExerciseEquipment(exerciseIds);
  const derived = deriveEquipment(exerciseIds, equipmentByExercise);
  const current = resolveEquipment(derived, value);
  const removed = removedDerivedEquipment(derived, value);
  const addable = EQUIPMENT.filter((k) => !current.includes(k));

  function change(next: EquipmentAdjustments) {
    onChange(loaded ? pruneAdjustments(next, derived) : next);
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-[var(--muted)]">
        Equipment
        <span className="block">Pulled from the exercises — remove anything you won&apos;t need or add extras.</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {current.map((k) => (
          <span
            key={k}
            className={`${chipClass} ${derived.includes(k) ? "border-[var(--border)]" : "border-[var(--accent)]"}`}
            title={derived.includes(k) ? "From exercises" : "Added to this workout"}
          >
            {EQUIPMENT_LABELS[k]}
            <button
              type="button"
              onClick={() => change(removeEquipment(value, derived, k))}
              className="text-[var(--muted)] hover:text-[var(--foreground)] leading-none"
              aria-label={`Remove ${EQUIPMENT_LABELS[k]}`}
            >
              ×
            </button>
          </span>
        ))}
        {current.length === 0 && <span className="text-xs text-[var(--muted)]">{loaded ? "None" : "Loading…"}</span>}
        {addable.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && change(addEquipment(value, derived, e.target.value))}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            aria-label="Add equipment"
          >
            <option value="">+ Add equipment</option>
            {addable.map((k) => (
              <option key={k} value={k}>
                {EQUIPMENT_LABELS[k]}
              </option>
            ))}
          </select>
        )}
      </div>
      {removed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--muted)]">Removed:</span>
          {removed.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => change(addEquipment(value, derived, k))}
              className={`${chipClass} border-dashed border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]`}
              title="Restore"
            >
              <span className="line-through">{EQUIPMENT_LABELS[k]}</span> ↺
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface WorkoutEquipmentSummaryProps {
  exerciseIds: (string | null | undefined)[];
  added?: string[] | null;
  removed?: string[] | null;
}

/** Read-only "Equipment" section for workout previews; renders nothing when no equipment is needed. */
export function WorkoutEquipmentSummary({ exerciseIds, added, removed }: WorkoutEquipmentSummaryProps) {
  const { equipmentByExercise, loaded } = useExerciseEquipment(exerciseIds);
  if (!loaded) return null;
  const equipment = resolveEquipment(deriveEquipment(exerciseIds, equipmentByExercise), {
    added: added ?? [],
    removed: removed ?? [],
  });
  if (equipment.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Equipment</p>
      <div className="flex flex-wrap gap-1.5">
        {equipment.map((k) => (
          <span key={k} className={`${chipClass} border-[var(--border)]`}>
            {EQUIPMENT_LABELS[k]}
          </span>
        ))}
      </div>
    </div>
  );
}
