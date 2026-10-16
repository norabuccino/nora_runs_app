"use client";

import { useId, useState } from "react";
import { addSources, removeSource } from "@/lib/exerciseSources";

interface SourcesInputProps {
  value: string[];
  onChange: (sources: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

// Chip-style multi-value input: type a source and press Enter (or comma) to add it.
export function SourcesInput({ value, onChange, suggestions = [], placeholder }: SourcesInputProps) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  function commit() {
    if (!draft.trim()) return;
    onChange(addSources(value, [draft]));
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 focus-within:ring-2 focus-within:ring-[var(--accent)]">
      {value.map((s) => (
        <span key={s} className="inline-flex items-center gap-1 rounded-full bg-[var(--card)] border border-[var(--border)] px-2 py-0.5 text-xs">
          {s}
          <button
            type="button"
            onClick={() => onChange(removeSource(value, s))}
            className="text-[var(--muted)] hover:text-[var(--foreground)] leading-none"
            aria-label={`Remove ${s}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        list={listId}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
          else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={commit}
        placeholder={value.length ? "Add another…" : placeholder}
        className="flex-1 min-w-[8rem] bg-transparent text-sm focus:outline-none"
      />
      <datalist id={listId}>
        {suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
