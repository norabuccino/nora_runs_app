"use client";

import { BAND_LEVELS, isBandLoad } from "@/lib/strengthProgression";

interface LoadInputProps {
  loadFormat: string | null;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

/**
 * The input for a logged set's load: a band-level dropdown for band
 * exercises, otherwise a number box (pounds or machine assistance).
 */
export function LoadInput({ loadFormat, value, onChange, className, disabled, "aria-label": ariaLabel }: LoadInputProps) {
  if (isBandLoad(loadFormat)) {
    return (
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
            {level.label}
          </option>
        ))}
      </select>
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
