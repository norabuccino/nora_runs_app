"use client";

// Shared compact filter UI used by the Exercises, Workouts and Plans pages:
// a "Filters" toggle button with an active-count badge, a swipeable row of
// primary (type) pills, a collapsible panel of dropdowns, and a result line
// with removable chips for the active filters.

import type { ReactNode } from "react";

export type ActiveFilter = { key: string; label: string; clear: () => void };

export function FiltersButton({
  open,
  onToggle,
  count,
  controls,
}: {
  open: boolean;
  onToggle: () => void;
  count: number;
  controls: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        open || count
          ? "border-[var(--foreground)] text-[var(--foreground)]"
          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
      </svg>
      Filters
      {count > 0 && (
        <span className="rounded-full bg-[var(--foreground)] text-[var(--background)] text-[10px] font-semibold leading-none px-1.5 py-0.5 tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

/** One horizontally-swipeable row on mobile (bleeds to the page edge), wrapping on larger screens. */
export function PillRow({ children, bleed = true }: { children: ReactNode; bleed?: boolean }) {
  return (
    <div
      className={`overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        bleed ? "-mx-3 px-3 sm:mx-0 sm:px-0" : ""
      }`}
    >
      <div className="flex gap-1.5 w-max sm:w-auto sm:flex-wrap">{children}</div>
    </div>
  );
}

export function Pill({
  active,
  activeClass = "bg-[var(--foreground)] text-[var(--background)]",
  onClick,
  children,
}: {
  active: boolean;
  activeClass?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? activeClass
          : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

export function FilterPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div
      id={id}
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
    >
      {children}
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1 min-w-0">
      <span className="text-[11px] font-medium text-[var(--muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      >
        {children}
      </select>
    </label>
  );
}

export function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 min-w-0 self-end pb-1.5 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--accent)] w-4 h-4"
      />
      {label}
    </label>
  );
}

/** "24 workouts  [Long Run ×] [Coach ×]  Clear all", with an optional leading control (e.g. a FiltersButton). */
export function ActiveFilterChips({
  count,
  noun,
  filters,
  leading,
  onClearAll,
}: {
  count: number;
  noun: [singular: string, plural: string];
  filters: ActiveFilter[];
  leading?: ReactNode;
  /** Needed when the filters share one state object, so the clears don't overwrite each other. */
  onClearAll?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {leading}
      <span className="text-[var(--muted)] tabular-nums mr-1">
        {count} {count === 1 ? noun[0] : noun[1]}
      </span>
      {filters.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={f.clear}
          aria-label={`Remove filter: ${f.label}`}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--card)] border border-[var(--border)] pl-2.5 pr-2 py-0.5 hover:border-[var(--foreground)] transition-colors"
        >
          {f.label}
          <span aria-hidden className="text-[var(--muted)]">×</span>
        </button>
      ))}
      {filters.length > 1 && (
        <button
          type="button"
          onClick={onClearAll ?? (() => filters.forEach((f) => f.clear()))}
          className="text-[var(--accent)] hover:underline ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

/** Drops falsy entries so callers can build the list with `cond && {...}`. */
export function activeFilterList(items: (ActiveFilter | false | null | undefined)[]): ActiveFilter[] {
  return items.filter((f): f is ActiveFilter => !!f);
}
