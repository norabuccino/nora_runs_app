"use client";

import { useUnitPreference } from "@/hooks/useUnitPreference";

interface WeekMileageLabelProps {
  lowMi: number;
  highMi: number;
  actualMi?: number;
  increasePct?: number | null;
}

const AGGRESSIVE_INCREASE_THRESHOLD_PCT = 10;

export function WeekMileageLabel({ lowMi, highMi, actualMi = 0, increasePct = null }: WeekMileageLabelProps) {
  const [unit] = useUnitPreference();

  const convert = (mi: number) => unit === "km" ? mi * 1.60934 : mi;
  const fmt = (val: number) => `${Math.round(val)} ${unit}`;

  if (highMi === 0 && actualMi === 0) return null;

  const low = convert(lowMi);
  const high = convert(highMi);
  const plannedLabel = Math.round(low) === Math.round(high) ? fmt(high) : `${fmt(low)} – ${fmt(high)}`;
  const isAggressiveIncrease = increasePct != null && increasePct > AGGRESSIVE_INCREASE_THRESHOLD_PCT;

  return (
    <span className="text-sm font-medium text-[var(--muted)] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5">
      {isAggressiveIncrease && (
        <span
          title={`Mileage is up ~${Math.round(increasePct!)}% from last week — more than the commonly recommended 10% per week`}
          className="cursor-help"
        >
          ⚠️
        </span>
      )}
      {actualMi > 0 && (
        <span className="text-[var(--foreground)]">{fmt(convert(actualMi))} done</span>
      )}
      {actualMi > 0 && highMi > 0 && <span className="opacity-50"> / </span>}
      {highMi > 0 && plannedLabel}
    </span>
  );
}
