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
import { DAY_NAMES } from "@/lib/paceUtils";
import { WorkoutCard } from "./WorkoutCard";

// ── Types ─────────────────────────────────────────────────────────────────────

type DayMap = Record<number, PlanWorkout[]>;

function toDayMap(weekWorkouts: PlanWorkout[]): DayMap {
  const map: DayMap = {};
  for (let i = 0; i < 7; i++) map[i] = [];
  weekWorkouts.forEach((w) => {
    if (!map[w.day_of_week]) map[w.day_of_week] = [];
    map[w.day_of_week].push(w);
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
  onEdit,
  onDelete,
  onCopy,
}: {
  workout: PlanWorkout;
  log: WorkoutLog | null;
  paces: RunningPace[];
  onEdit?: (w: PlanWorkout) => void;
  onDelete?: (w: PlanWorkout) => void;
  onCopy?: (w: PlanWorkout) => void;
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
        title="Drag to move"
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
      <WorkoutCard workout={workout} log={log} paces={paces} mode="edit" onEdit={onEdit} onDelete={onDelete} onCopy={onCopy} />
    </div>
  );
}

// ── WeekGrid ───────────────────────────────────────────────────────────────────

interface WeekGridProps {
  weekNumber: number;
  workouts: PlanWorkout[];
  logs?: WorkoutLog[];
  paces?: RunningPace[];
  mode?: "view" | "dashboard" | "edit";
  onComplete?: (workout: PlanWorkout) => void;
  onUnComplete?: (workout: PlanWorkout) => void;
  onEdit?: (workout: PlanWorkout) => void;
  onDelete?: (workout: PlanWorkout) => void;
  onAddWorkout?: (weekNumber: number, dayOfWeek: number) => void;
  onDayLogicChange?: (weekNumber: number, dayOfWeek: number, logic: "and" | "or") => void;
  onReorder?: (updates: { id: string; week_number: number; day_of_week: number; sort_order: number }[]) => void;
  onCopy?: (workout: PlanWorkout) => void;
}

export function WeekGrid({
  weekNumber,
  workouts,
  logs = [],
  paces = [],
  mode = "view",
  onComplete,
  onUnComplete,
  onEdit,
  onDelete,
  onAddWorkout,
  onDayLogicChange,
  onReorder,
  onCopy,
}: WeekGridProps) {
  const [items, setItems] = useState<DayMap>(() =>
    toDayMap(workouts.filter((w) => w.week_number === weekNumber))
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId) {
      setItems(toDayMap(workouts.filter((w) => w.week_number === weekNumber)));
    }
  }, [workouts, weekNumber, activeId]);

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
      for (let i = 0; i < 7; i++) next[i] = [...(prev[i] ?? [])];

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
    for (let i = 0; i < 7; i++) finalItems[i] = [...(items[i] ?? [])];

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
    for (let day = 0; day < 7; day++) {
      finalItems[day] = finalItems[day].map((w, i) => ({ ...w, day_of_week: day, sort_order: i }));
    }

    setItems(finalItems);

    // Compute which workouts actually changed position
    const original = workouts.filter((w) => w.week_number === weekNumber);
    const updates: { id: string; week_number: number; day_of_week: number; sort_order: number }[] = [];
    for (let day = 0; day < 7; day++) {
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

  const byDay = Array.from({ length: 7 }, (_, i) => items[i] ?? []);

  const header = (
    <h3 className="text-sm font-semibold text-[var(--muted)]">Week {weekNumber}</h3>
  );

  // View / dashboard mode — no DnD
  if (mode !== "edit") {
    return (
      <div className="space-y-2">
        {header}
        <div className="grid grid-cols-7 gap-2 overflow-x-auto">
          {byDay.map((dayWorkouts, dayIndex) => {
            const dayLogic: "and" | "or" = dayWorkouts[0]?.day_logic ?? "and";
            return (
              <div key={dayIndex} className="min-w-[120px] space-y-2">
                <p className="text-xs font-medium text-center text-[var(--muted)]">{DAY_NAMES[dayIndex]}</p>
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
        <div className="grid grid-cols-7 gap-2 overflow-x-auto">
          {byDay.map((dayWorkouts, dayIndex) => {
            const dayLogic: "and" | "or" = dayWorkouts[0]?.day_logic ?? "and";
            const containerId = `day-${dayIndex}`;
            return (
              <div key={dayIndex} className="min-w-[120px] space-y-2">
                <p className="text-xs font-medium text-center text-[var(--muted)]">{DAY_NAMES[dayIndex]}</p>
                <SortableContext items={dayWorkouts.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                  <DroppableDay id={containerId}>
                    {dayWorkouts.length === 0 ? (
                      <button
                        onClick={() => onAddWorkout?.(weekNumber, dayIndex)}
                        className="w-full h-14 rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors"
                      >
                        + Add
                      </button>
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
                      <button
                        onClick={() => onAddWorkout?.(weekNumber, dayIndex)}
                        className="w-full py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                      >
                        + Add
                      </button>
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
