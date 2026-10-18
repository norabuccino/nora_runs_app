"use client";

import { useMemo, useState } from "react";
import type { WorkoutStepFormRow } from "@/components/WorkoutForm";
import { describeRunStep, parseRunText, toRunFormSteps, type RunBlock } from "@/lib/runTextImport";
import type { DistanceUnit } from "@/lib/unitUtils";

const PLACEHOLDERS = {
  run: "Warm up 2 miles, then run 2 sets of 8x200m at 3K pace with 200m recovery after each 200. Jog 800m easy between the two sets. Finish with 2 mile cooldown.",
  swim: "200 free warm up. 4x100 back on 1:45 with 15s rest. 100 easy cool down.",
};

interface RunTextImportModalProps {
  sport: "run" | "swim";
  paceNames: string[];
  startGroupId: number;
  defaultUnit: DistanceUnit;
  onImport: (steps: WorkoutStepFormRow[]) => void;
  onCancel: () => void;
}

/** Paste a run or swim written in plain text; preview the steps it becomes, then add them to the form. */
export function RunTextImportModal({ sport, paceNames, startGroupId, defaultUnit, onImport, onCancel }: RunTextImportModalProps) {
  const [text, setText] = useState("");
  const [showTips, setShowTips] = useState(false);
  const parsed = useMemo(() => parseRunText(text, { sport, paceNames }), [text, sport, paceNames]);
  const steps = useMemo(() => toRunFormSteps(parsed.blocks, { startGroupId, defaultUnit }), [parsed, startGroupId, defaultUnit]);

  const stepTone = (type: string) =>
    type === "recovery"
      ? "text-emerald-600 dark:text-emerald-400"
      : type === "warmup" || type === "cooldown"
      ? "text-[var(--muted)]"
      : "font-medium";

  function renderBlock(block: RunBlock, i: number) {
    if (block.kind === "step") {
      return (
        <li key={i} className={`rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm ${stepTone(block.step.stepType)}`}>
          {describeRunStep(block.step, sport)}
        </li>
      );
    }
    return (
      <li key={i} className="rounded-lg border border-dashed border-[var(--border)] p-2 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">Repeat {block.count}×</p>
        <ul className="space-y-1">
          {block.steps.map((s, j) => (
            <li key={j} className={`rounded-md bg-[var(--card)] px-3 py-1.5 text-sm ${stepTone(s.stepType)}`}>
              {describeRunStep(s, sport)}
            </li>
          ))}
        </ul>
      </li>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-xl bg-[var(--background)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl overflow-y-auto max-h-[90dvh] sm:max-h-[90vh]">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Paste {sport === "swim" ? "swim" : "run"} steps</h2>
            <button onClick={onCancel} className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none">
              ×
            </button>
          </div>

          <div className="space-y-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDERS[sport]}
              rows={5}
              autoFocus
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y"
            />
            <button type="button" onClick={() => setShowTips((v) => !v)} className="text-xs text-[var(--accent)] hover:underline">
              {showTips ? "Hide format tips" : "Format tips"}
            </button>
            {showTips && (
              <ul className="text-xs text-[var(--muted)] list-disc pl-4 space-y-0.5">
                <li>Write it like you&apos;d say it — sentences, commas or &ldquo;then&rdquo; separate the steps.</li>
                <li>
                  Amounts: <code>2 miles</code>, <code>800m</code>, <code>5 km</code>, <code>20 min</code>, <code>90 sec</code>
                  {sport === "swim" && (
                    <>
                      , bare numbers are yards (<code>200 free</code>)
                    </>
                  )}
                  .
                </li>
                <li>
                  Repeats: <code>8x200m</code>, <code>4 x 5 min</code>, <code>with 200m recovery</code>. <code>2 sets of …</code>{" "}
                  repeats the block, and <code>… between sets</code> adds a step between them.
                </li>
                {sport === "run" ? (
                  <li>
                    Paces: <code>at 3K pace</code>, <code>@ threshold</code>, <code>easy</code>, <code>MP</code>, <code>@ 6:45</code> — matched
                    to your paces. Warm-ups and cool-downs default to Easy, recoveries to Recovery.
                  </li>
                ) : (
                  <li>
                    Strokes: <code>free</code>, <code>back</code>, <code>breast</code>, <code>fly</code>; send-off <code>on 1:45</code>; rest{" "}
                    <code>15s rest</code>.
                  </li>
                )}
                <li>
                  <code>warm up</code> / <code>cool down</code> / <code>jog</code> / <code>rest</code> set the step type. Other words (e.g.
                  strides) become notes.
                </li>
              </ul>
            )}
          </div>

          {parsed.blocks.length > 0 && <ol className="space-y-1.5">{parsed.blocks.map(renderBlock)}</ol>}

          {parsed.unknownPaces.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Not one of your paces (kept in the step notes): {parsed.unknownPaces.map((p) => `“${p}”`).join(", ")}. Add it on Paces to
              match it next time.
            </p>
          )}
          {parsed.unparsed.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Skipped (no distance, time or repeat found): {parsed.unparsed.map((u) => `“${u}”`).join(", ")}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onImport(steps)}
              disabled={steps.length === 0}
              className="flex-1 rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {steps.length === 0 ? "Add steps" : `Add ${steps.length} ${steps.length === 1 ? "step" : "steps"}`}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
