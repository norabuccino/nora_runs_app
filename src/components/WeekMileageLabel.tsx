"use client";

import { useUnitPreference } from "@/hooks/useUnitPreference";

interface WeekMileageLabelProps {
  lowMi: number;
  highMi: number;
}

export function WeekMileageLabel({ lowMi, highMi }: WeekMileageLabelProps) {
  const [unit] = useUnitPreference();

  const convert = (mi: number) => unit === "km" ? mi * 1.60934 : mi;
  const fmt = (val: number) => `${Math.round(val)} ${unit}`;

  if (highMi === 0) return null;

  const low = convert(lowMi);
  const high = convert(highMi);
  const label = Math.round(low) === Math.round(high) ? fmt(high) : `${fmt(low)} – ${fmt(high)}`;

  return (
    <span className="text-sm font-medium text-[var(--muted)] whitespace-nowrap shrink-0">
      {label}
    </span>
  );
}
