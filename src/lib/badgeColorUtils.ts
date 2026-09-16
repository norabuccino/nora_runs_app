export type BadgeColorEntry = {
  lightBg: string;
  lightText: string;
  darkBg: string;
  darkText: string;
};

export type BadgeColorMap = Record<string, BadgeColorEntry>;

// Mirrors the values in globals.css — used to pre-populate the color picker
export const BADGE_DEFAULTS: BadgeColorMap = {
  "workout-run":         { lightBg: "#fadbf2", lightText: "#7b1461", darkBg: "#5c0f49", darkText: "#f5b8df" },
  "workout-strength":    { lightBg: "#ebdbfa", lightText: "#47147b", darkBg: "#35105c", darkText: "#d8b8f5" },
  "workout-rest":        { lightBg: "#f1f5f9", lightText: "#475569", darkBg: "#1e293b", darkText: "#cbd5e1" },
  "workout-cross-train": { lightBg: "#dbfae3", lightText: "#147b2e", darkBg: "#0f5c23", darkText: "#b8f5c8" },
  "workout-bike":        { lightBg: "#fadbdb", lightText: "#7b1414", darkBg: "#5c0f0f", darkText: "#f5b8b8" },
  "workout-swim":        { lightBg: "#dbfafa", lightText: "#147b7b", darkBg: "#0f5c5c", darkText: "#b8f5f5" },
  "plan-marathon":       { lightBg: "#fadbed", lightText: "#7b144e", darkBg: "#5c0f3b", darkText: "#f5b8da" },
  "plan-half-marathon":  { lightBg: "#f0dbfa", lightText: "#5b147b", darkBg: "#440f5c", darkText: "#e1b8f5" },
  "plan-5k-10k":         { lightBg: "#dbfae9", lightText: "#147b41", darkBg: "#0f5c31", darkText: "#b8f5d0" },
  "plan-base-building":  { lightBg: "#f3f4f6", lightText: "#4b5563", darkBg: "#1f2937", darkText: "#d1d5db" },
  "plan-strength":       { lightBg: "#e5fadb", lightText: "#347b14", darkBg: "#275c0f", darkText: "#caf5b8" },
  "plan-custom":         { lightBg: "#fae1db", lightText: "#7b2714", darkBg: "#5c1d0f", darkText: "#f5c5b8" },
  "run-easy-run":        { lightBg: "#dffadb", lightText: "#217b14", darkBg: "#195c0f", darkText: "#c0f5b8" },
  "run-interval-run":    { lightBg: "#fae7db", lightText: "#7b3b14", darkBg: "#5c2c0f", darkText: "#f5d0b8" },
  "run-threshold-run":   { lightBg: "#faf8db", lightText: "#6b5f0d", darkBg: "#50470a", darkText: "#f5f0b8" },
  "run-recovery-run":    { lightBg: "#ebfadb", lightText: "#477b14", darkBg: "#355c0f", darkText: "#d8f5b8" },
  "run-boost-run":       { lightBg: "#dbf4fa", lightText: "#14687b", darkBg: "#0f4e5c", darkText: "#b8e9f5" },
  "run-race":            { lightBg: "#f6dbfa", lightText: "#6e147b", darkBg: "#530f5c", darkText: "#ecb8f5" },
  "run-long-run":        { lightBg: "#dfdbfa", lightText: "#21147b", darkBg: "#190f5c", darkText: "#c0b8f5" },
  "run-mp-hmp-run":      { lightBg: "#f6fadb", lightText: "#59680d", darkBg: "#434e0a", darkText: "#eaf5b8" },
  "exercise-warm-up":    { lightBg: "#f5f5f4", lightText: "#57534e", darkBg: "#292524", darkText: "#d6d3d1" },
  "exercise-stretch":    { lightBg: "#dbfadd", lightText: "#147b1a", darkBg: "#0f5c14", darkText: "#b8f5bc" },
  "exercise-lift":       { lightBg: "#fadbe7", lightText: "#7b143b", darkBg: "#5c0f2c", darkText: "#f5b8d0" },
  "exercise-plyos":      { lightBg: "#fadbf8", lightText: "#7b1474", darkBg: "#5c0f57", darkText: "#f5b8f0" },
  "exercise-core":       { lightBg: "#faeddb", lightText: "#7b4e14", darkBg: "#5c3b0f", darkText: "#f5dcb8" },
  "exercise-mobility":   { lightBg: "#dbfaf4", lightText: "#147b68", darkBg: "#0f5c4e", darkText: "#b8f5e9" },
  "strength-upper-body": { lightBg: "#faf2db", lightText: "#7b6114", darkBg: "#5c490f", darkText: "#f5e5b8" },
  "strength-lower-body": { lightBg: "#dbfaee", lightText: "#147b54", darkBg: "#0f5c3f", darkText: "#b8f5dc" },
  "strength-full-body":  { lightBg: "#e5dbfa", lightText: "#34147b", darkBg: "#270f5c", darkText: "#cab8f5" },
  "strength-core":       { lightBg: "#dbe9fa", lightText: "#14417b", darkBg: "#0f315c", darkText: "#b8d0f5" },
  "strength-plyometrics": { lightBg: "#fadbe1", lightText: "#7b1427", darkBg: "#5c0f1d", darkText: "#f5b8c5" },
  "strength-mobility":    { lightBg: "#e2e8f0", lightText: "#334155", darkBg: "#1e293b", darkText: "#cbd5e1" },
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
