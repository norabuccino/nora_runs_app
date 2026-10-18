import { LOAD_FORMAT_LABELS } from "@/lib/paceUtils";
import { LOAD_FORMAT_GUIDE, LOAD_FORMAT_TIP } from "@/lib/loadFormatGuide";
import { formatLoad } from "@/lib/strengthProgression";

/** Cheat sheet of every load format: what the logged number means, when to use it, and examples. */
export function LoadFormatGuide({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-2">
      <ul className={compact ? "space-y-2" : "grid gap-2 sm:grid-cols-2"}>
        {LOAD_FORMAT_GUIDE.map((entry) => {
          const sample = entry.key === "bodyweight" ? formatLoad(null, entry.key) : formatLoad(entry.key === "band" ? 3 : 25, entry.key);
          return (
            <li key={entry.key} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">{LOAD_FORMAT_LABELS[entry.key]}</p>
                {sample && <span className="shrink-0 text-xs text-[var(--muted)]">shows as “{sample}”</span>}
              </div>
              <p className="text-sm">{entry.meaning}</p>
              {!compact && <p className="text-xs text-[var(--muted)]">{entry.whenToUse}</p>}
              {entry.examples !== "—" && (
                <p className="text-xs text-[var(--muted)]">
                  <span className="font-medium">e.g.</span> {entry.examples}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-[var(--muted)]">{LOAD_FORMAT_TIP}</p>
    </div>
  );
}
