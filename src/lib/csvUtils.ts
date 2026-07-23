// Quote a CSV field and escape embedded quotes. Returns "" for null/undefined/empty.
export function csvEscape(s: string | null | undefined): string {
  return s ? `"${s.replace(/"/g, '""')}"` : "";
}
