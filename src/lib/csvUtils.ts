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

// Split CSV text into record lines, keeping line breaks that sit inside a
// quoted field (e.g. a multi-line description) and dropping blank lines.
// Handles \r\n (Excel/Windows) as well as \n.
export function splitCSVRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '""'; i++; continue; }
      inQuotes = !inQuotes;
      current += char;
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      if (current.trim()) records.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) records.push(current);
  return records;
}
