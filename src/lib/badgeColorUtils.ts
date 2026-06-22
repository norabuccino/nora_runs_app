export type BadgeColorEntry = {
  lightBg: string;
  lightText: string;
  darkBg: string;
  darkText: string;
};

export type BadgeColorMap = Record<string, BadgeColorEntry>;

// Mirrors the values in globals.css — used to pre-populate the color picker
export const BADGE_DEFAULTS: BadgeColorMap = {
  "workout-run":          { lightBg: "#dbeafe", lightText: "#1e40af", darkBg: "#1e3a8a", darkText: "#bfdbfe" },
  "workout-strength":     { lightBg: "#ffedd5", lightText: "#9a3412", darkBg: "#7c2d12", darkText: "#fed7aa" },
  "workout-rest":         { lightBg: "#f3f4f6", lightText: "#4b5563", darkBg: "#1f2937", darkText: "#9ca3af" },
  "workout-cross-train":  { lightBg: "#ccfbf1", lightText: "#115e59", darkBg: "#134e4a", darkText: "#99f6e4" },
  "workout-bike":         { lightBg: "#cffafe", lightText: "#155e75", darkBg: "#164e63", darkText: "#a5f3fc" },
  "workout-swim":         { lightBg: "#e0f2fe", lightText: "#075985", darkBg: "#0c4a6e", darkText: "#bae6fd" },
  "workout-yoga":         { lightBg: "#ede9fe", lightText: "#5b21b6", darkBg: "#4c1d95", darkText: "#ddd6fe" },
  "workout-elliptical":   { lightBg: "#ecfccb", lightText: "#3f6212", darkBg: "#365314", darkText: "#d9f99d" },
  "plan-marathon":        { lightBg: "#f3e8ff", lightText: "#6b21a8", darkBg: "#581c87", darkText: "#e9d5ff" },
  "plan-half-marathon":   { lightBg: "#dce4ff", lightText: "#1e3a8a", darkBg: "#1a2d70", darkText: "#b8caff" },
  "plan-5k-10k":          { lightBg: "#d0f4ea", lightText: "#005c44", darkBg: "#003d2d", darkText: "#80e8c8" },
  "plan-base-building":   { lightBg: "#eef5c8", lightText: "#4a6900", darkBg: "#2e4500", darkText: "#c8e870" },
  "plan-strength":        { lightBg: "#f5ddd8", lightText: "#8c1f0f", darkBg: "#621008", darkText: "#f5c0b5" },
  "plan-custom":          { lightBg: "#f0eaff", lightText: "#5c309a", darkBg: "#35186a", darkText: "#cbb8ff" },
  "run-easy-run":         { lightBg: "#dcfce7", lightText: "#166534", darkBg: "#14532d", darkText: "#bbf7d0" },
  "run-interval-run":     { lightBg: "#fee2e2", lightText: "#991b1b", darkBg: "#7f1d1d", darkText: "#fecaca" },
  "run-threshold-run":    { lightBg: "#fef3c7", lightText: "#92400e", darkBg: "#78350f", darkText: "#fde68a" },
  "run-recovery-run":     { lightBg: "#e5e0ff", lightText: "#4020b8", darkBg: "#251865", darkText: "#c5b8ff" },
  "run-race":             { lightBg: "#fce7f3", lightText: "#9d174d", darkBg: "#831843", darkText: "#fbcfe8" },
  "run-long-run":         { lightBg: "#e0e7ff", lightText: "#3730a3", darkBg: "#312e81", darkText: "#c7d2fe" },
  "run-mp-hmp-run":       { lightBg: "#fef9c3", lightText: "#854d0e", darkBg: "#713f12", darkText: "#fef08a" },
  "exercise-warm-up":     { lightBg: "#f5f5f4", lightText: "#44403c", darkBg: "#292524", darkText: "#d6d3d1" },
  "exercise-stretch":     { lightBg: "#e2f5e8", lightText: "#145c2a", darkBg: "#0c3d1c", darkText: "#a8e8b8" },
  "exercise-lift":        { lightBg: "#ffd5da", lightText: "#8c001e", darkBg: "#5c0015", darkText: "#ffb0bb" },
  "exercise-plyos":       { lightBg: "#ffeab5", lightText: "#7a4800", darkBg: "#4d2c00", darkText: "#ffd880" },
  "exercise-core":        { lightBg: "#f1f5f9", lightText: "#334155", darkBg: "#1e293b", darkText: "#cbd5e1" },
  "exercise-mobility":    { lightBg: "#ffdecb", lightText: "#8b2600", darkBg: "#5a1800", darkText: "#ffbfa0" },
  "strength-upper-body":  { lightBg: "#ffe4e6", lightText: "#9f1239", darkBg: "#881337", darkText: "#fecdd3" },
  "strength-lower-body":  { lightBg: "#d1fae5", lightText: "#065f46", darkBg: "#064e3b", darkText: "#a7f3d0" },
  "strength-full-body":   { lightBg: "#fae8ff", lightText: "#86198f", darkBg: "#701a75", darkText: "#f5d0fe" },
  "strength-core":        { lightBg: "#dce8f8", lightText: "#1a3d6b", darkBg: "#0d2545", darkText: "#a8c8f0" },
  "strength-plyometrics": { lightBg: "#f4f4f5", lightText: "#3f3f46", darkBg: "#27272a", darkText: "#d4d4d8" },
  "strength-mobility":    { lightBg: "#f5f5f5", lightText: "#404040", darkBg: "#262626", darkText: "#d4d4d4" },
};

export type BadgeLayoutConfig = {
  hidden: string[];
  custom: { column: string; key: string; label: string }[];
};

export const DEFAULT_BADGE_LAYOUT: BadgeLayoutConfig = { hidden: [], custom: [] };

export function buildBadgeColorStyle(overrides: BadgeColorMap): string {
  if (!Object.keys(overrides).length) return "";
  const lightVars = Object.entries(overrides)
    .map(([k, c]) => `  --badge-${k}-bg: ${c.lightBg};\n  --badge-${k}-text: ${c.lightText};`)
    .join("\n");
  const darkVars = Object.entries(overrides)
    .map(([k, c]) => `  --badge-${k}-bg: ${c.darkBg};\n  --badge-${k}-text: ${c.darkText};`)
    .join("\n");
  return `:root {\n${lightVars}\n}\n.dark {\n${darkVars}\n}`;
}
