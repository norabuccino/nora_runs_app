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
import type { PlanWorkout, RunningPace, ScheduledWorkoutWithSteps, WorkoutLog } from "@/types/database";
import { parseDateLocal } from "@/lib/paceUtils";
import { adaptScheduledWorkout, type ScheduledWeekDay } from "@/lib/scheduledWorkout";
import { WorkoutCard } from "./WorkoutCard";

// Like WeekGrid's "reorder" mode, but keyed by calendar date instead of a
// plan's week_number/day_of_week — for planning ad-hoc scheduled_workouts
// (no active plan) a week ahead, including dragging between days.

type DateMap = Record<string, ScheduledWorkoutWithSteps[]>;

function toDateMap(days: ScheduledWeekDay<ScheduledWorkoutWithSteps>[]): DateMap {
  const map: DateMap = {};
  days.forEach(({ date, workouts }) => {
    map[date] = [...workouts].sort((a, b) => a.sort_order - b.sort_order);
  });
  return map;
}

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

function DayHeader({ date, isToday }: { date: string; isToday: boolean }) {
  const labelColor = isToday ? "text-[var(--accent)]" : "text-[var(--muted)]";
  const weekday = parseDateLocal(date).toLocaleDateString("en-US", { weekday: "short" });
  const shortDate = parseDateLocal(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <>
      <div className="flex lg:hidden items-center gap-2">
        <span className={`text-xs font-semibold ${labelColor}`}>{weekday}</span>
        <span className="text-[10px] text-[var(--muted)] opacity-70">{shortDate}</span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <div className="hidden lg:block text-center">
        <p className={`text-xs font-medium ${labelColor}`}>{weekday}</p>
        <p className="text-[10px] text-[var(--muted)] opacity-70">{shortDate}</p>
      </div>
    </>
  );
}

function SortableCard({
  workout,
  paces,
  onComplete,
  onUnComplete,
  onDelete,
  onDetail,
}: {
  workout: ScheduledWorkoutWithSteps;
  paces: RunningPace[];
  onComplete: (id: string) => void;
  onUnComplete: (id: string) => void;
  onDelete: (workout: ScheduledWorkoutWithSteps) => void;
  onDetail: (workout: PlanWorkout, date: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: workout.id,
  });
  const adapted = adaptScheduledWorkout(workout);
  const syntheticLog = workout.completed_at ? ({ completed_at: workout.completed_at } as WorkoutLog) : null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-40" : ""}
    >
      <div className="flex items-center h-4">
        <div
          {...attributes}
          {...listeners}
          className="flex-1 flex justify-center items-center cursor-grab active:cursor-grabbing text-[var(--muted)] hover:text-[var(--foreground)] transition-colors select-none"
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
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(workout); }}
          title="Remove"
          className="w-5 h-5 flex items-center justify-center text-sm leading-none text-[var(--muted)] hover:text-red-500 transition-colors"
        >
          ×
        </button>
      </div>
      <WorkoutCard
        workout={adapted}
        log={syntheticLog}
        paces={paces}
        mode="dashboard"
        onComplete={() => onComplete(workout.id)}
        onUnComplete={() => onUnComplete(workout.id)}
        onDetail={() => onDetail(adapted, workout.scheduled_date)}
      />
    </div>
  );
}

interface ScheduledWeekGridProps {
  days: ScheduledWeekDay<ScheduledWorkoutWithSteps>[];
  paces: RunningPace[];
  todayISO: string;
  onComplete: (id: string) => void;
  onUnComplete: (id: string) => void;
  onDelete: (workout: ScheduledWorkoutWithSteps) => void;
  onDetail: (workout: PlanWorkout, date: string) => void;
  onAddWorkout: (date: string) => void;
  onReorder: (updates: { id: string; scheduled_date: string; sort_order: number }[]) => void;
}

export function ScheduledWeekGrid({
  days,
  paces,
  todayISO,
  onComplete,
  onUnComplete,
  onDelete,
  onDetail,
  onAddWorkout,
  onReorder,
}: ScheduledWeekGridProps) {
  const dates = days.map((d) => d.date);
  const [items, setItems] = useState<DateMap>(() => toDateMap(days));
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId) setItems(toDateMap(days));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const allItems = Object.values(items).flat();
  const activeWorkout = activeId ? allItems.find((w) => w.id === activeId) ?? null : null;

  function findDate(map: DateMap, id: string): string | null {
    for (const [date, ws] of Object.entries(map)) {
      if (ws.some((w) => w.id === id)) return date;
    }
    return null;
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    setItems((prev) => {
      const activeDate = findDate(prev, activeId);
      if (activeDate === null) return prev;

      let overDate = findDate(prev, overId);
      if (overDate === null && dates.includes(overId)) overDate = overId;
      if (overDate === null || activeDate === overDate) return prev;

      const next: DateMap = {};
      dates.forEach((d) => { next[d] = [...(prev[d] ?? [])]; });

      const movingItem = next[activeDate].find((w) => w.id === activeId)!;
      next[activeDate] = next[activeDate].filter((w) => w.id !== activeId);

      const overIdx = next[overDate].findIndex((w) => w.id === overId);
      const insertAt = overIdx >= 0 ? overIdx : next[overDate].length;
      next[overDate] = [
        ...next[overDate].slice(0, insertAt),
        { ...movingItem, scheduled_date: overDate },
        ...next[overDate].slice(insertAt),
      ];

      return next;
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);

    if (!over) {
      setItems(toDateMap(days));
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const finalItems: DateMap = {};
    dates.forEach((d) => { finalItems[d] = [...(items[d] ?? [])]; });

    const activeDate = findDate(finalItems, activeId);
    if (activeDate === null) return;

    const overDate = findDate(finalItems, overId);

    if (overDate !== null && activeDate === overDate) {
      const dayItems = finalItems[activeDate];
      const from = dayItems.findIndex((w) => w.id === activeId);
      const to = dayItems.findIndex((w) => w.id === overId);
      if (from !== -1 && to !== -1 && from !== to) {
        finalItems[activeDate] = arrayMove(dayItems, from, to);
      }
    }

    dates.forEach((d) => {
      finalItems[d] = finalItems[d].map((w, i) => ({ ...w, scheduled_date: d, sort_order: i }));
    });
    setItems(finalItems);

    const original = days.flatMap((d) => d.workouts);
    const updates: { id: string; scheduled_date: string; sort_order: number }[] = [];
    dates.forEach((d) => {
      finalItems[d].forEach((w, i) => {
        const o = original.find((x) => x.id === w.id);
        if (!o || o.scheduled_date !== d || o.sort_order !== i) {
          updates.push({ id: w.id, scheduled_date: d, sort_order: i });
        }
      });
    });

    if (updates.length > 0) onReorder(updates);
  }

  return (
    <DndContext
      id="scheduled-week-reorder"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-y-3 lg:gap-2 lg:overflow-x-auto">
        {dates.map((date) => {
          const dayWorkouts = items[date] ?? [];
          return (
            <div key={date} className="min-w-0 lg:min-w-[120px] space-y-2">
              <DayHeader date={date} isToday={date === todayISO} />
              <SortableContext items={dayWorkouts.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                <DroppableDay id={date}>
                  {dayWorkouts.length === 0 ? (
                    <button
                      onClick={() => onAddWorkout(date)}
                      className="w-full h-8 lg:h-14 rounded-lg border border-dashed border-[var(--border)] flex items-center justify-center text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
                    >
                      +
                    </button>
                  ) : (
                    dayWorkouts.map((workout) => (
                      <SortableCard
                        key={workout.id}
                        workout={workout}
                        paces={paces}
                        onComplete={onComplete}
                        onUnComplete={onUnComplete}
                        onDelete={onDelete}
                        onDetail={onDetail}
                      />
                    ))
                  )}
                  {dayWorkouts.length > 0 && (
                    <div className="pt-0.5 text-center">
                      <button
                        onClick={() => onAddWorkout(date)}
                        className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                      >
                        + Add
                      </button>
                    </div>
                  )}
                </DroppableDay>
              </SortableContext>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeWorkout ? (
          <div className="rotate-1 shadow-xl opacity-90" style={{ minWidth: 120 }}>
            <WorkoutCard workout={adaptScheduledWorkout(activeWorkout)} mode="dashboard" />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
