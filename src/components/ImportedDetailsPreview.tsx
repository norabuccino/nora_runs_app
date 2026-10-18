import { RUN_TYPE_LABELS, STRENGTH_TYPE_LABELS } from "@/lib/paceUtils";
import type { WorkoutTextDetails } from "@/lib/workoutTextDetails";

/** What the paste import found besides the steps (title, description, …). */
export function ImportedDetailsPreview({ details }: { details: WorkoutTextDetails }) {
  const rows: [string, string][] = [
    ["Title", details.title],
    ["Description", details.description],
    ["Run type", details.run_type ? RUN_TYPE_LABELS[details.run_type] ?? details.run_type : undefined],
    ["Strength type", details.strength_type ? STRENGTH_TYPE_LABELS[details.strength_type] ?? details.strength_type : undefined],
    ["Notes", details.notes],
    ["Source", details.source],
  ].filter((r): r is [string, string] => !!r[1]);
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] p-2 space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        Details <span className="font-normal normal-case tracking-normal">· fills fields you haven&apos;t filled in</span>
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-[var(--muted)]">{label}</dt>
            <dd className="whitespace-pre-line">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
