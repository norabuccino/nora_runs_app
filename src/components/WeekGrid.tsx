"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PlanWorkout, WorkoutLog, RunningPace } from "@/types/database";
import { DAY_NAMES, scheduledDate } from "@/lib/paceUtils";
import { WorkoutCard } from "./WorkoutCard";

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DayMap = Record<number, PlanWorkout[]>;

const GRID_COLS: Record<number, string> = {
  2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4",
  5: "grid-cols-5", 6: "grid-cols-6", 7: "grid-cols-7",
};

function toDayMap(weekWorkouts: PlanWorkout[], count = 7): DayMap {
  const map: DayMap = {};
  for (let i = 0; i < count; i++) map[i] = [];
  weekWorkouts.forEach((w) => {
    if (w.day_of_week < count) {
      if (!map[w.day_of_week]) map[w.day_of_week] = [];
      map[w.day_of_week].push(w);
    }
  });
  Object.values(map).forEach((day) => day.sort((a, b) => a.sort_order - b.sort_order));
  return map;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DroppableDay({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[3.5rem] rounded-lg space-y-1.5 p-0.5 transition-colors ${
        isOver ? "bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/40" : ""
      }`}
    >
      {children}
    </div>
  );
}

function SortableCard({
  workout,
  log,
  paces,
  workoutMode = "edit",
  onEdit,
  onDelete,
  onCopy,
  onComplete,
  onUnComplete,
}: {
  workout: PlanWorkout;
  log: WorkoutLog | null;
  paces: RunningPace[];
  workoutMode?: "edit" | "dashboard";
  onEdit?: (w: PlanWorkout) => void;
  onDelete?: (w: PlanWorkout) => void;
  onCopy?: (w: PlanWorkout) => void;
  onComplete?: (w: PlanWorkout) => void;
  onUnComplete?: (w: PlanWorkout) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: workout.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-40" : ""}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex justify-center items-center h-4 cursor-grab active:cursor-grabbing text-[var(--muted)] hover:text-[var(--foreground)] transition-colors select-none"
        title="Drag to reschedule"
      >
        <svg width="14" height="8" viewBox="0 0 14 8" fill="currentColor" className="opacity-40 hover:opacity-80 transition-opacity">
          <circle cx="3" cy="2" r="1.5" />
          <circle cx="7" cy="2" r="1.5" />
          <circle cx="11" cy="2" r="1.5" />
          <circle cx="3" cy="6" r="1.5" />
          <circle cx="7" cy="6" r="1.5" />
          <circle cx="11" cy="6" r="1.5" />
        </svg>
      </div>
      <WorkoutCard
        workout={workout}
        log={log}
        paces={paces}
        mode={workoutMode}
        onEdit={onEdit}
        onDelete={onDelete}
        onCopy={onCopy}
        onComplete={onComplete}
        onUnComplete={onUnComplete}
      />
    </div>
  );
}

// ── WeekGrid ───────────────────────────────────────────────────────────────────

interface WeekGridProps {
  weekNumber: number;
  workouts: PlanWorkout[];
  logs?: WorkoutLog[];
  paces?: RunningPace[];
  mode?: "view" | "dashboard" | "edit" | "reorder";
  daysPerWeek?: number;
  purpose?: string;
  onComplete?: (workout: PlanWorkout) => void;
  onUnComplete?: (workout: PlanWorkout) => void;
  onEdit?: (workout: PlanWorkout) => void;
  onDelete?: (workout: PlanWorkout) => void;
  onAddWorkout?: (weekNumber: number, dayOfWeek: number, action: "library" | "form") => void;
  onDayLogicChange?: (weekNumber: number, dayOfWeek: number, logic: "and" | "or") => void;
  onReorder?: (updates: { id: string; week_number: number; day_of_week: number; sort_order: number }[]) => void;
  onCopy?: (workout: PlanWorkout) => void;
  onPurposeChange?: (purpose: string) => void;
  startDate?: string;
}

export function WeekGrid({
  weekNumber,
  workouts,
  logs = [],
  paces = [],
  mode = "view",
  daysPerWeek = 7,
  purpose,
  onComplete,
  onUnComplete,
  onEdit,
  onDelete,
  onAddWorkout,
  onDayLogicChange,
  onReorder,
  onCopy,
  onPurposeChange,
  startDate,
}: WeekGridProps) {
  const [items, setItems] = useState<DayMap>(() =>
    toDayMap(workouts.filter((w) => w.week_number === weekNumber), daysPerWeek)
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localPurpose, setLocalPurpose] = useState(purpose ?? "");

  useEffect(() => { setLocalPurpose(purpose ?? ""); }, [purpose]);

  useEffect(() => {
    if (!activeId) {
      setItems(toDayMap(workouts.filter((w) => w.week_number === weekNumber), daysPerWeek));
    }
  }, [workouts, weekNumber, activeId, daysPerWeek]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const allItems = Object.values(items).flat();
  const activeWorkout = activeId ? allItems.find((w) => w.id === activeId) ?? null : null;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    setItems((prev) => {
      // Find source day
      let activeDay: number | null = null;
      for (const [d, ws] of Object.entries(prev)) {
        if (ws.some((w) => w.id === activeId)) { activeDay = parseInt(d); break; }
      }
      if (activeDay === null) return prev;

      // Find target day — could be a workout ID or a "day-N" container ID
      let overDay: number | null = null;
      for (const [d, ws] of Object.entries(prev)) {
        if (ws.some((w) => w.id === overId)) { overDay = parseInt(d); break; }
      }
      if (overDay === null) {
        const m = overId.match(/^day-(\d+)$/);
        if (m) overDay = parseInt(m[1]);
      }
      if (overDay === null || activeDay === overDay) return prev;

      // Move item to target day
      const next: DayMap = {};
      for (let i = 0; i < daysPerWeek; i++) next[i] = [...(prev[i] ?? [])];

      const movingItem = next[activeDay].find((w) => w.id === activeId)!;
      next[activeDay] = next[activeDay].filter((w) => w.id !== activeId);

      const overIdx = next[overDay].findIndex((w) => w.id === overId);
      const insertAt = overIdx >= 0 ? overIdx : next[overDay].length;
      next[overDay] = [
        ...next[overDay].slice(0, insertAt),
        { ...movingItem, day_of_week: overDay },
        ...next[overDay].slice(insertAt),
      ];

      return next;
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);

    if (!over) {
      setItems(toDayMap(workouts.filter((w) => w.week_number === weekNumber)));
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Build final state
    const finalItems: DayMap = {};
    for (let i = 0; i < daysPerWeek; i++) finalItems[i] = [...(items[i] ?? [])];

    // Find active day in finalItems
    let activeDay: number | null = null;
    for (const [d, ws] of Object.entries(finalItems)) {
      if (ws.some((w) => w.id === activeId)) { activeDay = parseInt(d); break; }
    }
    if (activeDay === null) return;

    // Find over day in finalItems
    let overDay: number | null = null;
    for (const [d, ws] of Object.entries(finalItems)) {
      if (ws.some((w) => w.id === overId)) { overDay = parseInt(d); break; }
    }

    // Same-day reorder via arrayMove
    if (overDay !== null && activeDay === overDay) {
      const dayItems = finalItems[activeDay];
      const from = dayItems.findIndex((w) => w.id === activeId);
      const to = dayItems.findIndex((w) => w.id === overId);
      if (from !== -1 && to !== -1 && from !== to) {
        finalItems[activeDay] = arrayMove(dayItems, from, to);
      }
    }
    // Cross-day: already applied in dragOver

    // Normalize sort_orders
    for (let day = 0; day < daysPerWeek; day++) {
      finalItems[day] = finalItems[day].map((w, i) => ({ ...w, day_of_week: day, sort_order: i }));
    }

    setItems(finalItems);

    // Compute which workouts actually changed position
    const original = workouts.filter((w) => w.week_number === weekNumber);
    const updates: { id: string; week_number: number; day_of_week: number; sort_order: number }[] = [];
    for (let day = 0; day < daysPerWeek; day++) {
      finalItems[day].forEach((w, i) => {
        const o = original.find((x) => x.id === w.id);
        if (!o || o.day_of_week !== day || o.sort_order !== i) {
          updates.push({ id: w.id, week_number: weekNumber, day_of_week: day, sort_order: i });
        }
      });
    }

    if (updates.length > 0) onReorder?.(updates);
  }

  // ── AND/OR separator helper ──────────────────────────────────────────────────

  function andOrSep(dayLogic: "and" | "or", dayIndex: number, i: number, editable: boolean) {
    const key = `logic-${weekNumber}-${dayIndex}-${i}`;
    if (editable) {
      return (
        <button
          key={key}
          onClick={() => onDayLogicChange?.(weekNumber, dayIndex, dayLogic === "and" ? "or" : "and")}
          title={dayLogic === "and" ? "Both required — click to switch to OR" : "Pick one — click to switch to AND"}
          className="w-full flex items-center gap-1 py-0.5 group"
        >
          <div className="flex-1 h-px bg-[var(--border)] group-hover:bg-[var(--foreground)] transition-colors" />
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--muted)] group-hover:border-[var(--foreground)] group-hover:text-[var(--foreground)] transition-colors leading-none">
            {dayLogic === "and" ? "AND" : "OR"}
          </span>
          <div className="flex-1 h-px bg-[var(--border)] group-hover:bg-[var(--foreground)] transition-colors" />
        </button>
      );
    }
    return (
      <div key={key} className="flex items-center gap-1 py-0.5">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-[10px] font-semibold px-1 text-[var(--muted)] leading-none">
          {dayLogic === "and" ? "AND" : "OR"}
        </span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const byDay = Array.from({ length: daysPerWeek }, (_, i) => items[i] ?? []);
  const gridCols = GRID_COLS[daysPerWeek] ?? "grid-cols-7";

  const header = (
    <div className="flex items-baseline gap-3 min-w-0">
      <h3 className="text-sm font-semibold text-[var(--muted)] whitespace-nowrap">Week {weekNumber}</h3>
      {mode === "edit" ? (
        <input
          type="text"
          value={localPurpose}
          onChange={(e) => setLocalPurpose(e.target.value)}
          onBlur={() => onPurposeChange?.(localPurpose)}
          placeholder="Add a goal for this week…"
          maxLength={120}
          className="flex-1 min-w-0 text-sm bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--accent)] focus:outline-none py-0 text-[var(--foreground)] placeholder:text-[var(--muted)]"
        />
      ) : localPurpose ? (
        <p className="text-sm text-[var(--muted)] italic truncate">{localPurpose}</p>
      ) : null}
    </div>
  );

  // View / dashboard mode — no DnD
  if (mode === "view" || mode === "dashboard") {
    return (
      <div className="space-y-2">
        {header}
        <div className={`grid ${gridCols} gap-2 overflow-x-auto`}>
          {byDay.map((dayWorkouts, dayIndex) => {
            const dayLogic: "and" | "or" = dayWorkouts[0]?.day_logic ?? "or";
            return (
              <div key={dayIndex} className="min-w-[120px] space-y-2">
                <div className="text-center">
                  <p className="text-xs font-medium text-[var(--muted)]">{DAY_NAMES[dayIndex]}</p>
                  {startDate && (
                    <p className="text-[10px] text-[var(--muted)] opacity-70">
                      {formatShortDate(scheduledDate(startDate, weekNumber, dayIndex))}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  {dayWorkouts.length === 0 ? (
                    <div className="h-14 rounded-lg border border-dashed border-[var(--border)]" />
                  ) : (
                    dayWorkouts.flatMap((workout, i) => {
                      const log = logs.find((l) => l.plan_workout_id === workout.id) ?? null;
                      const card = (
                        <WorkoutCard key={workout.id} workout={workout} log={log} paces={paces} mode={mode} onComplete={onComplete} onUnComplete={onUnComplete} />
                      );
                      if (i === 0) return [card];
                      return [andOrSep(dayLogic, dayIndex, i, false), card];
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Reorder mode — DnD enabled, cards in dashboard style (complete button, no edit/delete)
  if (mode === "reorder") {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-2">
          {header}
          <div className={`grid ${gridCols} gap-2 overflow-x-auto`}>
            {byDay.map((dayWorkouts, dayIndex) => {
              const dayLogic: "and" | "or" = dayWorkouts[0]?.day_logic ?? "or";
              const containerId = `day-${dayIndex}`;
              return (
                <div key={dayIndex} className="min-w-[120px] space-y-2">
                  <div className="text-center">
                    <p className="text-xs font-medium text-[var(--muted)]">{DAY_NAMES[dayIndex]}</p>
                    {startDate && (
                      <p className="text-[10px] text-[var(--muted)] opacity-70">
                        {formatShortDate(scheduledDate(startDate, weekNumber, dayIndex))}
                      </p>
                    )}
                  </div>
                  <SortableContext items={dayWorkouts.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                    <DroppableDay id={containerId}>
                      {dayWorkouts.length === 0 ? (
                        <div className="h-14 rounded-lg border border-dashed border-[var(--border)]" />
                      ) : (
                        dayWorkouts.flatMap((workout, i) => {
                          const log = logs.find((l) => l.plan_workout_id === workout.id) ?? null;
                          const card = (
                            <SortableCard
                              key={workout.id}
                              workout={workout}
                              log={log}
                              paces={paces}
                              workoutMode="dashboard"
                              onComplete={onComplete}
                              onUnComplete={onUnComplete}
                            />
                          );
                          if (i === 0) return [card];
                          return [andOrSep(dayLogic, dayIndex, i, false), card];
                        })
                      )}
                    </DroppableDay>
                  </SortableContext>
                </div>
              );
            })}
          </div>
        </div>

        <DragOverlay>
          {activeWorkout ? (
            <div className="rotate-1 shadow-xl opacity-90" style={{ minWidth: 120 }}>
              <WorkoutCard workout={activeWorkout} mode="dashboard" />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }

  // Edit mode — with DnD
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-2">
        {header}
        <div className={`grid ${gridCols} gap-2 overflow-x-auto`}>
          {byDay.map((dayWorkouts, dayIndex) => {
            const dayLogic: "and" | "or" = dayWorkouts[0]?.day_logic ?? "or";
            const containerId = `day-${dayIndex}`;
            return (
              <div key={dayIndex} className="min-w-[120px] space-y-2">
                <div className="text-center">
                  <p className="text-xs font-medium text-[var(--muted)]">{DAY_NAMES[dayIndex]}</p>
                  {startDate && (
                    <p className="text-[10px] text-[var(--muted)] opacity-70">
                      {formatShortDate(scheduledDate(startDate, weekNumber, dayIndex))}
                    </p>
                  )}
                </div>
                <SortableContext items={dayWorkouts.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                  <DroppableDay id={containerId}>
                    {dayWorkouts.length === 0 ? (
                      <div className="w-full h-14 rounded-lg border border-dashed border-[var(--border)] flex overflow-hidden">
                        <button
                          onClick={() => onAddWorkout?.(weekNumber, dayIndex, "library")}
                          className="flex-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
                        >
                          Library
                        </button>
                        <div className="w-px bg-[var(--border)]" />
                        <button
                          onClick={() => onAddWorkout?.(weekNumber, dayIndex, "form")}
                          className="flex-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
                        >
                          New
                        </button>
                      </div>
                    ) : (
                      dayWorkouts.flatMap((workout, i) => {
                        const log = logs.find((l) => l.plan_workout_id === workout.id) ?? null;
                        const card = (
                          <SortableCard key={workout.id} workout={workout} log={log} paces={paces} onEdit={onEdit} onDelete={onDelete} onCopy={onCopy} />
                        );
                        if (i === 0) return [card];
                        return [andOrSep(dayLogic, dayIndex, i, true), card];
                      })
                    )}
                    {dayWorkouts.length > 0 && (
                      <div className="flex items-center justify-center gap-2 py-1">
                        <button
                          onClick={() => onAddWorkout?.(weekNumber, dayIndex, "library")}
                          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                        >
                          + Library
                        </button>
                        <span className="text-xs text-[var(--border)]">·</span>
                        <button
                          onClick={() => onAddWorkout?.(weekNumber, dayIndex, "form")}
                          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                        >
                          + New
                        </button>
                      </div>
                    )}
                  </DroppableDay>
                </SortableContext>
              </div>
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {activeWorkout ? (
          <div className="rotate-1 shadow-xl opacity-90" style={{ minWidth: 120 }}>
            <WorkoutCard workout={activeWorkout} mode="edit" />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
