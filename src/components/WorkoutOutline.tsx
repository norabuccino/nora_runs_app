"use client";

import { useEffect, useRef } from "react";
import { formatStepDuration, isRestStep, type OutlineItem, type OutlineSection } from "@/lib/workoutSteps";

function itemDetail(item: OutlineItem, inSuperset: boolean): string {
  const { step } = item;
  const amount = step.reps ? `${step.reps} reps` : formatStepDuration(step.duration_minutes, step.duration_unit);
  const sets = !inSuperset && step.sets && step.sets > 1 ? `${step.sets} × ` : "";
  return [amount ? `${sets}${amount}` : null, step.both_sides ? "each side" : null].filter(Boolean).join(" · ");
}

interface WorkoutOutlineProps {
  outline: OutlineSection[];
  /** Jump the session to a beat (the step's next unfinished beat). */
  onJump: (beatIndex: number) => void;
}

/** Overview of the whole workout for the session player: done steps crossed out, current one highlighted. */
export function WorkoutOutline({ outline, onJump }: WorkoutOutlineProps) {
  const currentRef = useRef<HTMLButtonElement>(null);
  const currentKey = outline.flatMap((s) => s.items).findIndex((i) => i.status === "current");

  // Keep the current step in view as the session moves along.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentKey]);

  return (
    <ol className="space-y-3">
      {outline.map((section, si) => (
        <li key={si} className={section.title || section.isSuperset ? "rounded-lg border border-[var(--border)] p-1.5" : ""}>
          {(section.title || section.isSuperset) && (
            <p className="px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
              {section.title ?? "Superset"}
              {section.rounds != null && (
                <span className="ml-1 font-normal normal-case tracking-normal text-[var(--muted)]">
                  · {section.rounds} {section.rounds === 1 ? "round" : "rounds"}
                </span>
              )}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item, ii) => {
              const done = item.status === "done";
              const current = item.status === "current";
              const rest = isRestStep(item.step);
              const detail = itemDetail(item, section.isSuperset);
              // Beats before the current one are done, so completedBeats is a prefix: jump to the next unfinished beat.
              const target = item.beatIndices[item.completedBeats] ?? item.beatIndices[0];
              const showProgress = item.beatIndices.length > 1 && item.completedBeats > 0 && !done;
              return (
                <li key={ii}>
                  <button
                    ref={current ? currentRef : undefined}
                    type="button"
                    onClick={() => target != null && onJump(target)}
                    aria-current={current ? "step" : undefined}
                    className={`w-full flex items-start gap-2 rounded-md px-1.5 py-1 text-left transition-colors ${
                      current ? "bg-[var(--accent)]/15" : "hover:bg-[var(--card)]"
                    } ${done ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`mt-0.5 w-4 shrink-0 text-center text-xs ${
                        current ? "text-[var(--accent)]" : "text-[var(--muted)]"
                      }`}
                      aria-hidden
                    >
                      {done ? "✓" : current ? "▶" : "•"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm leading-snug ${done ? "line-through" : ""} ${
                          current ? "font-semibold" : ""
                        } ${rest ? "text-emerald-600 dark:text-emerald-400" : ""}`}
                      >
                        {item.step.label || "Exercise"}
                      </span>
                      {detail && <span className="block text-xs text-[var(--muted)]">{detail}</span>}
                    </span>
                    {showProgress && (
                      <span className="mt-0.5 shrink-0 text-[11px] text-[var(--muted)]">
                        {item.completedBeats}/{item.beatIndices.length}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
