export type DistanceUnit = "mi" | "km" | "m";
export type GlobalUnit = "mi" | "km";

const KM_PER_MI = 1.60934;
const MI_PER_KM = 1 / KM_PER_MI;
const M_PER_MI = 1609.34;
const MI_PER_M = 1 / M_PER_MI;

export function toMiles(value: number, unit: DistanceUnit): number {
  if (unit === "mi") return value;
  if (unit === "km") return value * MI_PER_KM;
  return value * MI_PER_M;
}

export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return value;
  const miles = toMiles(value, from);
  if (to === "mi") return miles;
  if (to === "km") return miles * KM_PER_MI;
  return miles * M_PER_MI;
}

// Format a pace stored as seconds/mile into a readable string for the given display unit
export function formatPaceForUnit(secondsPerMile: number, unit: DistanceUnit): string {
  const seconds = unit === "mi" ? secondsPerMile : secondsPerMile * MI_PER_KM;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  const unitLabel = unit === "mi" ? "/mi" : "/km";
  return `${mins}:${String(secs).padStart(2, "0")} ${unitLabel}`;
}

// Read the stored global preference synchronously (safe in client components)
export function getStoredUnit(): GlobalUnit {
  if (typeof window === "undefined") return "mi";
  const stored = window.localStorage.getItem("unitPref");
  return stored === "km" ? "km" : "mi";
}

// Format a distance value with its unit for display
export function displayDistance(value: number | null, unit: string): string | null {
  if (!value) return null;
  const u = unit ?? "mi";
  if (u === "m") return `${Math.round(value)} m`;
  return `${parseFloat(value.toFixed(1))} ${u}`;
}
