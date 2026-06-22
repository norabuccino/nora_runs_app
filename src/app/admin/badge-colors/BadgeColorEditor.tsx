"use client";

import { useState, useTransition } from "react";
import { saveBadgeColors } from "@/app/actions/badgeColors";
import { BADGE_DEFAULTS } from "@/lib/badgeColorUtils";
import type { BadgeColorEntry, BadgeColorMap } from "@/lib/badgeColorUtils";

const COLUMNS = [
  {
    title: "Workout",
    badges: [
      { key: "workout-run", label: "Run" },
      { key: "workout-strength", label: "Strength" },
      { key: "workout-rest", label: "Rest" },
      { key: "workout-cross-train", label: "Cross-Train" },
      { key: "workout-bike", label: "Bike" },
      { key: "workout-swim", label: "Swim" },
      { key: "workout-yoga", label: "Yoga" },
      { key: "workout-elliptical", label: "Elliptical" },
    ],
  },
  {
    title: "Plan",
    badges: [
      { key: "plan-marathon", label: "Marathon" },
      { key: "plan-half-marathon", label: "Half Marathon" },
      { key: "plan-5k-10k", label: "5K / 10K" },
      { key: "plan-base-building", label: "Base Building" },
      { key: "plan-strength", label: "Strength" },
      { key: "plan-custom", label: "Custom" },
    ],
  },
  {
    title: "Run Type",
    badges: [
      { key: "run-easy-run", label: "Easy Run" },
      { key: "run-interval-run", label: "Interval Run" },
      { key: "run-threshold-run", label: "Threshold Run" },
      { key: "run-recovery-run", label: "Recovery Run" },
      { key: "run-race", label: "Race" },
      { key: "run-long-run", label: "Long Run" },
      { key: "run-mp-hmp-run", label: "MP/HMP Run" },
    ],
  },
  {
    title: "Exercise",
    badges: [
      { key: "exercise-warm-up", label: "Warm Up" },
      { key: "exercise-stretch", label: "Stretch" },
      { key: "exercise-lift", label: "Lift" },
      { key: "exercise-plyos", label: "Plyos" },
      { key: "exercise-core", label: "Core" },
      { key: "exercise-mobility", label: "Mobility" },
    ],
  },
  {
    title: "Strength",
    badges: [
      { key: "strength-upper-body", label: "Upper Body" },
      { key: "strength-lower-body", label: "Lower Body" },
      { key: "strength-full-body", label: "Full Body" },
      { key: "strength-core", label: "Core" },
      { key: "strength-plyometrics", label: "Plyometrics" },
      { key: "strength-mobility", label: "Mobility" },
    ],
  },
];

function effectiveColor(key: string, overrides: BadgeColorMap): BadgeColorEntry {
  return overrides[key] ?? BADGE_DEFAULTS[key];
}

interface EditingState {
  key: string;
  label: string;
  colors: BadgeColorEntry;
}

export function BadgeColorEditor({ initialOverrides }: { initialOverrides: BadgeColorMap }) {
  const [overrides, setOverrides] = useState<BadgeColorMap>(initialOverrides);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  function openEditor(key: string, label: string) {
    setEditing({ key, label, colors: effectiveColor(key, overrides) });
    setSaveError(null);
    setSaveSuccess(false);
  }

  function handleColorChange(field: keyof BadgeColorEntry, value: string) {
    if (!editing) return;
    setEditing((e) => e ? { ...e, colors: { ...e.colors, [field]: value } } : e);
  }

  function handleReset() {
    if (!editing) return;
    setEditing((e) => e ? { ...e, colors: BADGE_DEFAULTS[e.key] } : e);
  }

  function handleSave() {
    if (!editing) return;
    const next = { ...overrides, [editing.key]: editing.colors };
    setSaveError(null);
    setSaveSuccess(false);
    startSave(async () => {
      try {
        await saveBadgeColors(next);
        setOverrides(next);
        setSaveSuccess(true);
        // Apply override immediately via CSS custom property on document root
        const root = document.documentElement;
        root.style.setProperty(`--badge-${editing.key}-bg`, editing.colors.lightBg);
        root.style.setProperty(`--badge-${editing.key}-text`, editing.colors.lightText);
        setEditing(null);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  function handleCancel() {
    setEditing(null);
    setSaveError(null);
  }

  const isCustomized = (key: string) => !!overrides[key];

  return (
    <>
      {saveSuccess && (
        <p className="text-sm text-green-600 dark:text-green-400">Saved — changes will apply on next page load for all users.</p>
      )}

      <div className="grid grid-cols-5 gap-4 min-w-0">
        {COLUMNS.map((col) => (
          <div key={col.title} className="space-y-2 min-w-0">
            <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">{col.title}</h2>
            <div className="space-y-1.5">
              {col.badges.map(({ key, label }) => {
                const c = effectiveColor(key, overrides);
                return (
                  <button
                    key={key}
                    onClick={() => openEditor(key, label)}
                    title={isCustomized(key) ? "Custom color — click to edit" : "Click to customize"}
                    className="w-full text-left"
                  >
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-opacity hover:opacity-80"
                      style={{ backgroundColor: c.lightBg, color: c.lightText }}
                    >
                      {label}
                      {isCustomized(key) && (
                        <span className="text-[10px] opacity-60">✦</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Color editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-xl">
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{editing.label}</h2>
                <button onClick={handleCancel} className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none">×</button>
              </div>

              {/* Light mode */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--muted)]">Light mode</p>
                <div className="flex items-center gap-3">
                  <div className="space-y-1 flex-1">
                    <label className="text-xs text-[var(--muted)]">Background</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editing.colors.lightBg}
                        onChange={(e) => handleColorChange("lightBg", e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-[var(--border)]"
                      />
                      <code className="text-xs text-[var(--muted)]">{editing.colors.lightBg}</code>
                    </div>
                  </div>
                  <div className="space-y-1 flex-1">
                    <label className="text-xs text-[var(--muted)]">Text</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editing.colors.lightText}
                        onChange={(e) => handleColorChange("lightText", e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-[var(--border)]"
                      />
                      <code className="text-xs text-[var(--muted)]">{editing.colors.lightText}</code>
                    </div>
                  </div>
                </div>
                <div className="pt-1">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: editing.colors.lightBg, color: editing.colors.lightText }}
                  >
                    {editing.label}
                  </span>
                </div>
              </div>

              {/* Dark mode */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--muted)]">Dark mode</p>
                <div className="flex items-center gap-3">
                  <div className="space-y-1 flex-1">
                    <label className="text-xs text-[var(--muted)]">Background</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editing.colors.darkBg}
                        onChange={(e) => handleColorChange("darkBg", e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-[var(--border)]"
                      />
                      <code className="text-xs text-[var(--muted)]">{editing.colors.darkBg}</code>
                    </div>
                  </div>
                  <div className="space-y-1 flex-1">
                    <label className="text-xs text-[var(--muted)]">Text</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editing.colors.darkText}
                        onChange={(e) => handleColorChange("darkText", e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-[var(--border)]"
                      />
                      <code className="text-xs text-[var(--muted)]">{editing.colors.darkText}</code>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg p-2" style={{ backgroundColor: "#111827" }}>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: editing.colors.darkBg, color: editing.colors.darkText }}
                  >
                    {editing.label}
                  </span>
                </div>
              </div>

              {saveError && <p className="text-xs text-red-500">{saveError}</p>}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleReset}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Reset to default
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
