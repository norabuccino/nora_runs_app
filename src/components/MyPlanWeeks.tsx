"use client";

import { useState } from "react";
import type { PlanWorkout, RunningPace } from "@/types/database";
import { WeekGrid } from "@/components/WeekGrid";
import { PlanWorkoutDetailModal } from "@/components/PlanWorkoutDetailModal";

interface MyPlanWeeksProps {
  weeks: number[];
  planWorkouts: PlanWorkout[];
  paces: RunningPace[];
  weekNotesMap: Record<number, string>;
  startDate: string;
}

export function MyPlanWeeks({ weeks, planWorkouts, paces, weekNotesMap, startDate }: MyPlanWeeksProps) {
  const [detailWorkout, setDetailWorkout] = useState<PlanWorkout | null>(null);

  return (
    <>
      {weeks.map((weekNum) => (
        <WeekGrid
          key={weekNum}
          weekNumber={weekNum}
          workouts={planWorkouts}
          paces={paces}
          mode="view"
          purpose={weekNotesMap[weekNum]}
          startDate={startDate}
          onDetail={setDetailWorkout}
        />
      ))}
      {detailWorkout && (
        <PlanWorkoutDetailModal
          workout={detailWorkout}
          onClose={() => setDetailWorkout(null)}
        />
      )}
    </>
  );
}
