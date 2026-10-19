import { LOAD_FORMAT_LABELS, LOADING_CATEGORY_LABELS } from "@/lib/paceUtils";
import { LOAD_FORMAT_GUIDE, LOAD_FORMAT_TIP, type GuideEntry } from "@/lib/loadFormatGuide";
import { LOADING_CATEGORY_GUIDE } from "@/lib/loadingCategoryGuide";
import { formatLoad, isBandLoad } from "@/lib/strengthProgression";

/** Cards of guide entries: meaning, when to use it (full view only), and examples. */
function GuideCards({
  entries,
  labels,
  compact,
  aside,
}: {
  entries: GuideEntry[];
  labels: Record<string, string>;
  compact: boolean;
  aside?: (key: string) => string | null;
}) {
  return (
    <ul className={compact ? "space-y-2" : "grid gap-2 sm:grid-cols-2"}>
      {entries.map((entry) => {
        const note = aside?.(entry.key);
        return (
          <li key={entry.key} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">{labels[entry.key]}</p>
              {note && <span className="shrink-0 text-xs text-[var(--muted)]">{note}</span>}
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
  );
}

/** Cheat sheet of every load format: what the logged number means, when to use it, and examples. */
export function LoadFormatGuide({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-2">
      <GuideCards
        entries={LOAD_FORMAT_GUIDE}
        labels={LOAD_FORMAT_LABELS}
        compact={compact}
        aside={(key) => {
          const sample = key === "bodyweight" ? formatLoad(null, key) : formatLoad(isBandLoad(key) ? 3 : 25, key);
          return sample ? `shows as “${sample}”` : null;
        }}
      />
      <p className="text-xs text-[var(--muted)]">{LOAD_FORMAT_TIP}</p>
    </div>
  );
}

/** Cheat sheet of every loading category: the movement pattern it covers, with examples. */
export function LoadingCategoryGuide({ compact = false }: { compact?: boolean }) {
  return <GuideCards entries={LOADING_CATEGORY_GUIDE} labels={LOADING_CATEGORY_LABELS} compact={compact} />;
}
