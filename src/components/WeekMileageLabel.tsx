"use client";

import { useUnitPreference } from "@/hooks/useUnitPreference";

interface WeekMileageLabelProps {
  lowMi: number;
  highMi: number;
  actualMi?: number;
}

export function WeekMileageLabel({ lowMi, highMi, actualMi = 0 }: WeekMileageLabelProps) {
  const [unit] = useUnitPreference();

  const convert = (mi: number) => unit === "km" ? mi * 1.60934 : mi;
  const fmt = (val: number) => `${Math.round(val)} ${unit}`;

  if (highMi === 0 && actualMi === 0) return null;

  const low = convert(lowMi);
  const high = convert(highMi);
  const plannedLabel = Math.round(low) === Math.round(high) ? fmt(high) : `${fmt(low)} – ${fmt(high)}`;

  return (
    <span className="text-sm font-medium text-[var(--muted)] whitespace-nowrap shrink-0">
      {actualMi > 0 && (
        <span className="text-[var(--foreground)]">{fmt(convert(actualMi))} done</span>
      )}
      {actualMi > 0 && highMi > 0 && <span className="opacity-50"> / </span>}
      {highMi > 0 && plannedLabel}
    </span>
  );
}
