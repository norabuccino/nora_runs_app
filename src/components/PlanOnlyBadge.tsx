/** Marks a library workout that's only used inside plans (hidden from regular users). Shown to admins. */
export function PlanOnlyBadge() {
  return (
    <span
      title="Plan only — hidden from regular users' workout library"
      className="shrink-0 rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]"
    >
      Plan only
    </span>
  );
}
