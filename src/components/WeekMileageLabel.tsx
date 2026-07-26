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
        <span className="relative group inline-flex items-center text-yellow-500 dark:text-yellow-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-label="Aggressive mileage increase">
            <path d="M12 2 1 21h22L12 2Zm0 5.5c.55 0 1 .45 1 1v6a1 1 0 1 1-2 0v-6c0-.55.45-1 1-1ZM12 18a1.25 1.25 0 1 1 0-2.5A1.25 1.25 0 0 1 12 18Z" />
          </svg>
          <span className="pointer-events-none absolute right-0 bottom-full mb-1.5 hidden group-hover:block w-52 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-xs font-normal leading-snug px-2.5 py-1.5 shadow-lg z-20">
            Mileage is up ~{Math.round(increasePct!)}% from last week — more than the commonly recommended 10% per week
          </span>
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
