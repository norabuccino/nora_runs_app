"use client";

import { isBandLoad } from "@/lib/strengthProgression";
import { BAND_LEVELS, bandColorFor, bandColorsForLoad, bandLevelText } from "@/lib/bandColors";
import { useBandColors } from "@/hooks/useBandColors";

interface LoadInputProps {
  loadFormat: string | null;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

/** A small dot in the band's color, for the user's own band set of that kind (nothing if that level has no color). */
export function BandSwatch({ level, loadFormat }: { level: number; loadFormat: string | null }) {
  const colors = bandColorsForLoad(useBandColors(), loadFormat);
  const color = bandColorFor(level, colors);
  if (!color) return null;
  return (
    <span
      title={color.label}
      className="inline-block w-3 h-3 rounded-full border border-[var(--border)] shrink-0"
      style={{ backgroundColor: color.hex }}
    />
  );
}

/**
 * The input for a logged set's load: a band-level dropdown for band
 * exercises (labelled with the user's band colors), otherwise a number box
 * (pounds or machine assistance).
 */
export function LoadInput({ loadFormat, value, onChange, className, disabled, "aria-label": ariaLabel }: LoadInputProps) {
  const colors = bandColorsForLoad(useBandColors(), loadFormat);
  if (isBandLoad(loadFormat)) {
    return (
      <span className="flex items-center gap-1.5 min-w-0">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={ariaLabel}
          className={className}
        >
          <option value="">—</option>
          {BAND_LEVELS.map((level) => (
            <option key={level.value} value={String(level.value)}>
              {bandLevelText(level.value, colors)}
            </option>
          ))}
        </select>
        {value !== "" && <BandSwatch level={Number(value)} loadFormat={loadFormat} />}
      </span>
    );
  }
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step="any"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
