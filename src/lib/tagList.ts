// Shared helpers for a fixed, ordered list of multi-select tags stored as a
// text[] of keys on a row (exercise muscle groups, equipment).

export type TagList = {
  labels: Record<string, string>;
  keys: string[];
  /** Keeps only known keys, de-duplicated, in the list's canonical order. */
  sort: (tags: string[] | null | undefined) => string[];
  toggle: (tags: string[], tag: string) => string[];
  /** Bulk edit: adds then removes tags, keeping the result valid and ordered. */
  applyChange: (tags: string[] | null | undefined, change: { add?: string[]; remove?: string[] }) => string[];
  /** Parses import input ("A; B", or a JSON array) by key or label, case-insensitively. */
  parse: (input: unknown) => { tags: string[]; unknown: string[] };
  /** Labels joined with "; " (CSV export; round-trips through parse). */
  format: (tags: string[] | null | undefined) => string;
};

function normalizeToken(s: string): string {
  return s.trim().toLowerCase().replace(/&|\band\b/g, " ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function createTagList(labels: Record<string, string>, aliases: Record<string, string> = {}): TagList {
  const keys = Object.keys(labels);
  const order = new Map(keys.map((k, i) => [k, i]));
  const lookup = new Map<string, string>([
    ...keys.flatMap((k) => [[normalizeToken(k), k], [normalizeToken(labels[k]), k]] as [string, string][]),
    ...Object.entries(aliases).map(([alias, k]) => [normalizeToken(alias), k] as [string, string]),
  ]);

  const sort = (tags: string[] | null | undefined) =>
    Array.from(new Set((tags ?? []).filter((t) => order.has(t)))).sort((a, b) => order.get(a)! - order.get(b)!);

  return {
    labels,
    keys,
    sort,
    toggle: (tags, tag) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : sort([...tags, tag])),
    applyChange: (tags, change) => {
      const remove = new Set(change.remove ?? []);
      return sort([...(tags ?? []), ...(change.add ?? [])]).filter((t) => !remove.has(t));
    },
    parse: (input) => {
      const tokens = Array.isArray(input)
        ? input.filter((v): v is string => typeof v === "string")
        : typeof input === "string"
          ? input.split(/[;|]/)
          : [];
      const found: string[] = [];
      const unknown: string[] = [];
      for (const raw of tokens) {
        if (!raw.trim()) continue;
        const key = lookup.get(normalizeToken(raw));
        if (key) found.push(key);
        else unknown.push(raw.trim());
      }
      return { tags: sort(found), unknown };
    },
    format: (tags) => sort(tags).map((t) => labels[t]).join("; "),
  };
}
