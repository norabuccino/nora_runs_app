import Link from "next/link";
import { PROGRESSION_BASICS, SUGGESTION_INDICATORS, SUGGESTION_ORDER } from "@/lib/progressionGuide";

/** One-line key to the suggestion icons, shown under the /progression table. */
export function SuggestionLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
      <span className="font-medium">Suggestion:</span>
      {SUGGESTION_ORDER.filter((s) => s !== "none").map((status) => {
        const s = SUGGESTION_INDICATORS[status];
        return (
          <span key={status}>
            <span className={`font-semibold ${s.color}`}>{s.icon}</span> {s.label}
          </span>
        );
      })}
      <Link href="/reference#progression" className="text-[var(--accent)] hover:underline">How these work</Link>
    </p>
  );
}

/** How the progression dashboard's columns and suggestions are worked out. */
export function ProgressionGuide() {
  return (
    <div className="space-y-3">
      <dl className="grid gap-2 sm:grid-cols-2">
        {PROGRESSION_BASICS.map((b) => (
          <div key={b.term} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 space-y-1">
            <dt className="text-sm font-semibold">{b.term}</dt>
            <dd className="text-sm">{b.meaning}</dd>
          </div>
        ))}
      </dl>
      <ul className="grid gap-2 sm:grid-cols-2">
        {SUGGESTION_ORDER.map((status) => {
          const s = SUGGESTION_INDICATORS[status];
          return (
            <li key={status} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 space-y-1">
              <p className="text-sm font-semibold">
                <span className={`inline-block w-4 ${s.color}`}>{s.icon}</span> {s.label}
              </p>
              <p className="text-sm">{s.meaning}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
