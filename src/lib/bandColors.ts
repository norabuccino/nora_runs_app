/**
 * Band resistance is logged as an ordered level (stored in `weight`) and shown
 * by name — bands are light/medium/heavy, not pounds; which color is which
 * level is per user (below). Keeping it numeric lets trends and "go up a band" still work.
 */
export const BAND_LEVELS: { value: number; label: string }[] = [
  { value: 1, label: "Extra light" },
  { value: 2, label: "Light" },
  { value: 3, label: "Medium" },
  { value: 4, label: "Heavy" },
  { value: 5, label: "Extra heavy" },
];

/**
 * Colors resistance bands come in. Each user maps their own band set's colors
 * onto the shared band levels (stored in `user_settings.band_colors`), since
 * one brand's red is another's green.
 */
export const BAND_COLOR_OPTIONS: { key: string; label: string; hex: string }[] = [
  { key: "tan", label: "Tan", hex: "#d2b48c" },
  { key: "yellow", label: "Yellow", hex: "#facc15" },
  { key: "orange", label: "Orange", hex: "#f97316" },
  { key: "red", label: "Red", hex: "#ef4444" },
  { key: "pink", label: "Pink", hex: "#ec4899" },
  { key: "purple", label: "Purple", hex: "#a855f7" },
  { key: "green", label: "Green", hex: "#22c55e" },
  { key: "blue", label: "Blue", hex: "#3b82f6" },
  { key: "gray", label: "Gray", hex: "#9ca3af" },
  { key: "black", label: "Black", hex: "#171717" },
  { key: "silver", label: "Silver", hex: "#c0c0c0" },
  { key: "gold", label: "Gold", hex: "#d4a017" },
];

/** Band level (as a string key, "1"–"5") → color key. Levels without a color are absent. */
export type BandColors = Record<string, string>;

/** Keeps only known levels and colors — the stored JSON is untyped. */
export function normalizeBandColors(raw: unknown): BandColors {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: BandColors = {};
  for (const level of BAND_LEVELS) {
    const color = (raw as Record<string, unknown>)[String(level.value)];
    if (typeof color === "string" && BAND_COLOR_OPTIONS.some((c) => c.key === color)) {
      result[String(level.value)] = color;
    }
  }
  return result;
}

export function bandColorFor(level: number, colors: BandColors | undefined) {
  const key = colors?.[String(level)];
  return key ? BAND_COLOR_OPTIONS.find((c) => c.key === key) ?? null : null;
}

/** "Medium", or "Medium (red)" once the user has given that level a color. */
export function bandLevelText(level: number, colors?: BandColors): string | null {
  const name = BAND_LEVELS.find((l) => l.value === level)?.label;
  if (!name) return null;
  const color = bandColorFor(level, colors);
  return color ? `${name} (${color.label.toLowerCase()})` : name;
}
