"use client";

import { useState, useTransition } from "react";
import { BAND_COLOR_OPTIONS, BAND_LEVELS, bandColorFor, type BandColors } from "@/lib/bandColors";
import { saveBandColors } from "@/app/actions/userSettings";
import { publishBandColors, useBandColors } from "@/hooks/useBandColors";

/**
 * Lets the user say which color their own bands are at each level — it's
 * per user because every band set is colored differently.
 */
export function BandColorsModal({ onClose }: { onClose: () => void }) {
  const current = useBandColors();
  // null until the user changes something, so colors that finish loading after
  // the modal opens still show (and a save can't wipe them with an empty draft).
  const [edited, setEdited] = useState<BandColors | null>(null);
  const draft = edited ?? current;
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function setLevel(level: number, color: string) {
    const next = { ...draft };
    if (color) next[String(level)] = color;
    else delete next[String(level)];
    setEdited(next);
  }

  function save() {
    startTransition(async () => {
      try {
        publishBandColors(await saveBandColors(draft));
        onClose();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-sm bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">My band colors</h2>
            <p className="text-xs text-[var(--muted)]">Match each level to the color of your own bands. Only you see these.</p>
          </div>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none">
            ×
          </button>
        </div>

        <div className="space-y-2">
          {BAND_LEVELS.map((level) => {
            const color = bandColorFor(level.value, draft);
            return (
              <label key={level.value} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0">{level.label}</span>
                <span
                  className="inline-block w-4 h-4 rounded-full border border-[var(--border)] shrink-0"
                  style={{ backgroundColor: color?.hex ?? "transparent" }}
                />
                <select
                  value={draft[String(level.value)] ?? ""}
                  onChange={(e) => setLevel(level.value, e.target.value)}
                  className="flex-1 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm"
                >
                  <option value="">No color</option>
                  {BAND_COLOR_OPTIONS.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:border-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "🎨 My band colors" link that opens the editor in place. */
export function BandColorsLink({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`text-[var(--accent)] hover:underline ${className}`}>
        🎨 My band colors
      </button>
      {open && <BandColorsModal onClose={() => setOpen(false)} />}
    </>
  );
}
