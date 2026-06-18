"use client";

import { useUnitPreference } from "@/hooks/useUnitPreference";

interface WeekMileageLabelProps {
  lowMi: number;
  highMi: number;
}

export function WeekMileageLabel({ lowMi, highMi }: WeekMileageLabelProps) {
  const [unit] = useUnitPreference();

  const convert = (mi: number) => unit === "km" ? mi * 1.60934 : mi;
  const fmt = (val: number) => `${val.toFixed(1)} ${unit}`;

  if (highMi === 0) return null;

  const low = convert(lowMi);
  const high = convert(highMi);
  const label = Math.abs(low - high) < 0.05 ? fmt(high) : `${fmt(low)} – ${fmt(high)}`;

  return (
    <span className="text-sm font-medium text-[var(--muted)] whitespace-nowrap shrink-0">
      {label}
    </span>
  );
}
