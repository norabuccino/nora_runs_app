// Quote a CSV field and escape embedded quotes. Returns "" for null/undefined/empty.
export function csvEscape(s: string | null | undefined): string {
  return s ? `"${s.replace(/"/g, '""')}"` : "";
}

// Split one CSV line into fields, honoring quoted fields (so commas and escaped
// "" quotes inside a quoted field don't get treated as delimiters).
export function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
