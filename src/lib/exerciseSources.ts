// Exercises carry a list of sources (coach, book, YouTube…). These helpers keep
// that list trimmed and de-duplicated (case-insensitively) everywhere it's edited.

// CSV import/export separates multiple sources with semicolons.
export const SOURCES_CSV_SEPARATOR = "; ";

export function normalizeSources(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

// Parses "Coach; YouTube" (CSV) — or a JSON array / single string — into a list.
export function parseSources(input: unknown): string[] {
  if (Array.isArray(input)) return normalizeSources(input.map((v) => (typeof v === "string" ? v : null)));
  if (typeof input !== "string") return [];
  return normalizeSources(input.split(/[;|]/));
}

export function formatSources(sources: string[] | null | undefined): string {
  return (sources ?? []).join(SOURCES_CSV_SEPARATOR);
}

export function addSources(existing: string[], added: string[]): string[] {
  return normalizeSources([...existing, ...added]);
}

export function removeSource(existing: string[], source: string): string[] {
  return existing.filter((s) => s.toLowerCase() !== source.toLowerCase());
}

export function hasSource(sources: string[] | null | undefined, source: string): boolean {
  return (sources ?? []).some((s) => s.toLowerCase() === source.toLowerCase());
}

// Every distinct source across a set of exercises, sorted for filter pills.
export function collectSources(items: { sources: string[] | null }[]): string[] {
  return normalizeSources(items.flatMap((i) => i.sources ?? [])).sort((a, b) => a.localeCompare(b));
}
