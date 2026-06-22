"use client";

import { useState, useTransition } from "react";
import { saveBadgeColors, saveBadgeLayout } from "@/app/actions/badgeColors";
import { BADGE_DEFAULTS, DEFAULT_BADGE_LAYOUT } from "@/lib/badgeColorUtils";
import type { BadgeColorEntry, BadgeColorMap, BadgeLayoutConfig } from "@/lib/badgeColorUtils";

const NEUTRAL_COLOR: BadgeColorEntry = {
  lightBg: "#f3f4f6", lightText: "#374151",
  darkBg: "#374151", darkText: "#f3f4f6",
};

const COLUMNS = [
  {
    title: "Workout",
    keyPrefix: "workout-",
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
    keyPrefix: "plan-",
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
    keyPrefix: "run-",
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
    keyPrefix: "exercise-",
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
    keyPrefix: "strength-",
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

type Column = (typeof COLUMNS)[0];

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function effectiveColor(key: string, overrides: BadgeColorMap): BadgeColorEntry {
  return overrides[key] ?? BADGE_DEFAULTS[key] ?? NEUTRAL_COLOR;
}

interface EditingState {
  key: string;
  label: string;
  colors: BadgeColorEntry;
  isCustom: boolean;
}

export function BadgeColorEditor({
  initialOverrides,
  initialLayout,
}: {
  initialOverrides: BadgeColorMap;
  initialLayout: BadgeLayoutConfig;
}) {
  const [overrides, setOverrides] = useState<BadgeColorMap>(initialOverrides);
  const [layout, setLayout] = useState<BadgeLayoutConfig>(initialLayout ?? DEFAULT_BADGE_LAYOUT);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [addingColumn, setAddingColumn] = useState<string | null>(null);
  const [addLabel, setAddLabel] = useState("");
  const [addError, setAddError] = useState("");
  const [colorSaving, startColorSave] = useTransition();
  const [layoutSaving, startLayoutSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  function getVisibleBadges(col: Column) {
    const defaults = col.badges
      .filter((b) => !layout.hidden.includes(b.key))
      .map((b) => ({ ...b, isCustom: false }));
    const customs = layout.custom
      .filter((c) => c.column === col.title)
      .map((c) => ({ key: c.key, label: c.label, isCustom: true }));
    return [...defaults, ...customs];
  }

  function hiddenCount(col: Column) {
    return col.badges.filter((b) => layout.hidden.includes(b.key)).length;
  }

  function openEditor(key: string, label: string, isCustom: boolean) {
    setEditing({ key, label, colors: effectiveColor(key, overrides), isCustom });
    setSaveError(null);
    setSaveSuccess(false);
  }

  function handleColorChange(field: keyof BadgeColorEntry, value: string) {
    if (!editing) return;
    setEditing((e) => e ? { ...e, colors: { ...e.colors, [field]: value } } : e);
  }

  function handleReset() {
    if (!editing) return;
    setEditing((e) => e ? { ...e, colors: BADGE_DEFAULTS[e.key] ?? NEUTRAL_COLOR } : e);
  }

  function handleColorSave() {
    if (!editing) return;
    const next = { ...overrides, [editing.key]: editing.colors };
    setSaveError(null);
    setSaveSuccess(false);
    startColorSave(async () => {
      try {
        await saveBadgeColors(next);
        setOverrides(next);
        setSaveSuccess(true);
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

  function removeBadge(key: string, isCustom: boolean) {
    let nextLayout: BadgeLayoutConfig;
    let nextOverrides = overrides;

    if (isCustom) {
      nextLayout = { ...layout, custom: layout.custom.filter((c) => c.key !== key) };
      const { [key]: _removed, ...rest } = overrides;
      nextOverrides = rest;
      setOverrides(nextOverrides);
    } else {
      nextLayout = { ...layout, hidden: [...layout.hidden, key] };
    }
    setLayout(nextLayout);
    startLayoutSave(async () => {
      await saveBadgeLayout(nextLayout);
      if (isCustom) await saveBadgeColors(nextOverrides);
    });
  }

  function restoreHidden(col: Column) {
    const colKeys = new Set(col.badges.map((b) => b.key));
    const nextLayout = { ...layout, hidden: layout.hidden.filter((k) => !colKeys.has(k)) };
    setLayout(nextLayout);
    startLayoutSave(async () => {
      await saveBadgeLayout(nextLayout);
    });
  }

  function startAdding(colTitle: string) {
    setAddingColumn(colTitle);
    setAddLabel("");
    setAddError("");
  }

  function cancelAdding() {
    setAddingColumn(null);
    setAddLabel("");
    setAddError("");
  }

  function addBadge(col: Column) {
    const trimmed = addLabel.trim();
    if (!trimmed) return;
    const key = col.keyPrefix + slugify(trimmed);
    const exists =
      col.badges.some((b) => b.key === key) ||
      layout.custom.some((c) => c.key === key);
    if (exists) {
      setAddError("A badge with that name already exists");
      return;
    }
    const nextLayout = {
      ...layout,
      custom: [...layout.custom, { column: col.title, key, label: trimmed }],
    };
    setLayout(nextLayout);
    setAddingColumn(null);
    setAddLabel("");
    setAddError("");
    startLayoutSave(async () => {
      await saveBadgeLayout(nextLayout);
    });
  }

  const isCustomized = (key: string) => !!overrides[key];

  return (
    <>
      {saveSuccess && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Saved — changes will apply on next page load for all users.
        </p>
      )}

      <div className="grid grid-cols-5 gap-4 min-w-0">
        {COLUMNS.map((col) => {
          const visible = getVisibleBadges(col);
          const hidden = hiddenCount(col);
          const isAdding = addingColumn === col.title;
          const addKey = col.keyPrefix + slugify(addLabel);
          const keyExists =
            addLabel.trim() !== "" &&
            (col.badges.some((b) => b.key === addKey) ||
              layout.custom.some((c) => c.key === addKey));

          return (
            <div key={col.title} className="space-y-2 min-w-0">
              <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                {col.title}
              </h2>

              <div className="space-y-1.5">
                {visible.map(({ key, label, isCustom }) => {
                  const c = effectiveColor(key, overrides);
                  return (
                    <div key={key} className="flex items-center gap-1 group">
                      <button
                        onClick={() => openEditor(key, label, isCustom)}
                        title={isCustomized(key) ? "Custom color — click to edit" : "Click to customize"}
                        className="flex-1 text-left min-w-0"
                      >
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-opacity hover:opacity-80 max-w-full"
                          style={{ backgroundColor: c.lightBg, color: c.lightText }}
                        >
                          <span className="truncate">{label}</span>
                          {isCustomized(key) && (
                            <span className="text-[10px] opacity-60 flex-shrink-0">✦</span>
                          )}
                        </span>
                      </button>
                      <button
                        onClick={() => removeBadge(key, isCustom)}
                        title={isCustom ? "Delete badge" : "Hide badge"}
                        disabled={layoutSaving}
                        className="flex-shrink-0 w-4 text-center text-[var(--muted)] hover:text-red-500 text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-wait"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>

              {hidden > 0 && (
                <button
                  onClick={() => restoreHidden(col)}
                  disabled={layoutSaving}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
                >
                  Show {hidden} hidden
                </button>
              )}

              {isAdding ? (
                <div className="space-y-1.5 pt-1">
                  <input
                    type="text"
                    value={addLabel}
                    onChange={(e) => { setAddLabel(e.target.value); setAddError(""); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addBadge(col);
                      if (e.key === "Escape") cancelAdding();
                    }}
                    placeholder="Badge label"
                    autoFocus
                    className="w-full px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]"
                  />
                  {addLabel.trim() && (
                    <p className={`text-[10px] font-mono truncate ${keyExists ? "text-red-500" : "text-[var(--muted)]"}`}>
                      {keyExists ? "Already exists" : `key: ${addKey}`}
                    </p>
                  )}
                  {addError && <p className="text-[10px] text-red-500">{addError}</p>}
                  <div className="flex gap-1">
                    <button
                      onClick={() => addBadge(col)}
                      disabled={!addLabel.trim() || keyExists || layoutSaving}
                      className="flex-1 px-2 py-1 text-xs rounded bg-[var(--foreground)] text-[var(--background)] font-medium disabled:opacity-40 transition-opacity"
                    >
                      Add
                    </button>
                    <button
                      onClick={cancelAdding}
                      className="flex-1 px-2 py-1 text-xs rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => startAdding(col.title)}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  + Add badge
                </button>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-xl">
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{editing.label}</h2>
                <button
                  onClick={handleCancel}
                  className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
                >
                  ×
                </button>
              </div>

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
                {BADGE_DEFAULTS[editing.key] && (
                  <button
                    onClick={handleReset}
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Reset to default
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleColorSave}
                  disabled={colorSaving}
                  className="px-4 py-1.5 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {colorSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
