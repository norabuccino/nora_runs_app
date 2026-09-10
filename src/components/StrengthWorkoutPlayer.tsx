"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlanWorkout, WorkoutStep } from "@/types/database";
import { buildSessionBeats, formatStepDuration, stepTimedSeconds } from "@/lib/workoutSteps";

const RESUME_MAX_AGE_MS = 12 * 60 * 60 * 1000; // don't resume a session older than this

function storageKey(workoutId: string) {
  return `strength-session:${workoutId}`;
}

function loadSavedBeatIndex(workoutId: string, beatCount: number): number {
  try {
    const raw = localStorage.getItem(storageKey(workoutId));
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { beatIndex: number; savedAt: number };
    if (Date.now() - parsed.savedAt > RESUME_MAX_AGE_MS) return 0;
    if (!Number.isInteger(parsed.beatIndex) || parsed.beatIndex < 0 || parsed.beatIndex >= beatCount) return 0;
    return parsed.beatIndex;
  } catch {
    return 0;
  }
}

function saveBeatIndex(workoutId: string, beatIndex: number) {
  try {
    localStorage.setItem(storageKey(workoutId), JSON.stringify({ beatIndex, savedAt: Date.now() }));
  } catch {
    // localStorage unavailable (private browsing, etc.) — session just won't resume
  }
}

function clearSavedSession(workoutId: string) {
  try {
    localStorage.removeItem(storageKey(workoutId));
  } catch {
    // ignore
  }
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => ctx.close();
  } catch {
    // Web Audio unavailable — silent fallback
  }
}

function ExerciseTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const [alerted, setAlerted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function start() {
    if (running) return;
    setRunning(true);
    setAlerted(false);
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setRunning(false);
          setAlerted(true);
          navigator.vibrate?.(200);
          playBeep();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  function pause() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
  }

  function reset() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setAlerted(false);
    setRemaining(seconds);
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const label = remaining === 0 ? "Reset" : remaining === seconds ? "Start timer" : "Resume";

  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={`text-4xl font-mono font-bold tabular-nums ${alerted ? "text-[var(--accent)] animate-pulse" : ""}`}
      >
        {mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`}
      </span>
      <div className="flex gap-2">
        {running ? (
          <button
            onClick={pause}
            className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--card)] transition-colors"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={remaining === 0 ? reset : start}
            className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--card)] transition-colors"
          >
            {label}
          </button>
        )}
      </div>
    </div>
  );
}

function Overlay({ children, onExit }: { children: React.ReactNode; onExit?: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-[var(--background)] flex flex-col p-4">
      {onExit && (
        <button
          onClick={onExit}
          className="self-end text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none mb-4"
        >
          ×
        </button>
      )}
      <div className="flex-1 flex items-center justify-center">{children}</div>
    </div>
  );
}

interface StrengthWorkoutPlayerProps {
  workout: PlanWorkout;
  steps: WorkoutStep[];
  onExit: () => void;
  onFinish: () => void;
}

export function StrengthWorkoutPlayer({ workout, steps, onExit, onFinish }: StrengthWorkoutPlayerProps) {
  const beats = useMemo(() => buildSessionBeats(steps), [steps]);
  const [beatIndex, setBeatIndex] = useState(() => loadSavedBeatIndex(workout.id, beats.length));
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!finished) saveBeatIndex(workout.id, beatIndex);
  }, [workout.id, beatIndex, finished]);

  if (beats.length === 0) {
    return (
      <Overlay onExit={onExit}>
        <p className="text-sm text-[var(--muted)]">This workout has no exercises to run through.</p>
      </Overlay>
    );
  }

  if (finished) {
    return (
      <Overlay>
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-2xl font-semibold">💪 Workout complete!</p>
          <button
            onClick={onFinish}
            className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </Overlay>
    );
  }

  const beat = beats[beatIndex];
  const isLast = beatIndex === beats.length - 1;

  function advance() {
    if (isLast) {
      clearSavedSession(workout.id);
      setFinished(true);
    } else {
      setBeatIndex((i) => i + 1);
    }
  }

  function goBack() {
    setBeatIndex((i) => Math.max(0, i - 1));
  }

  function handleExit() {
    if (!confirm("End this workout session? Your progress will be lost.")) return;
    clearSavedSession(workout.id);
    onExit();
  }

  const timedSeconds = stepTimedSeconds(beat.step);
  const repsLabel = beat.step.reps
    ? `${beat.step.reps} reps${beat.step.both_sides ? " (each side)" : ""}`
    : null;
  const durationLabel = !repsLabel ? formatStepDuration(beat.step.duration_minutes, beat.step.duration_unit) : null;
  const progressLabel = beat.isSuperset
    ? `Round ${beat.roundNumber} of ${beat.totalRounds}`
    : beat.totalSets && beat.totalSets > 1
    ? `Set ${beat.setNumber} of ${beat.totalSets}`
    : null;

  return (
    <div className="fixed inset-0 z-[60] bg-[var(--background)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)]">
        <div className="min-w-0">
          <p className="text-xs text-[var(--muted)] truncate">{workout.title}</p>
          <div className="mt-1 h-1.5 w-40 max-w-[40vw] rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all"
              style={{ width: `${(beatIndex / beats.length) * 100}%` }}
            />
          </div>
        </div>
        <button
          onClick={handleExit}
          className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none shrink-0"
        >
          ×
        </button>
      </div>

      {/* Tap-anywhere exercise area */}
      <div
        onClick={advance}
        className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 text-center cursor-pointer select-none"
      >
        {beat.groupName && (
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            {beat.groupName}
          </span>
        )}
        {progressLabel && <span className="text-sm text-[var(--muted)]">{progressLabel}</span>}
        <h2 className="text-3xl font-bold leading-tight">{beat.step.label || "Exercise"}</h2>
        <div className="flex flex-wrap items-center justify-center gap-3 text-base text-[var(--muted)]">
          {repsLabel && <span>{repsLabel}</span>}
          {durationLabel && <span>{durationLabel}</span>}
          {beat.step.weight_suggestion && <span>{beat.step.weight_suggestion}</span>}
        </div>
        {beat.step.notes && <p className="text-sm text-[var(--muted)] max-w-sm">{beat.step.notes}</p>}
        {beat.step.video_url && (
          <a
            href={beat.step.video_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            Watch video →
          </a>
        )}
        {timedSeconds != null && (
          <div onClick={(e) => e.stopPropagation()}>
            <ExerciseTimer seconds={timedSeconds} key={beatIndex} />
          </div>
        )}
        <span className="mt-4 text-sm font-medium text-[var(--accent)]">Tap anywhere to mark done →</span>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
        <button
          onClick={goBack}
          disabled={beatIndex === 0}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
        >
          ‹ Back
        </button>
        <span className="text-xs text-[var(--muted)]">
          {beatIndex + 1} / {beats.length}
        </span>
        <button
          onClick={advance}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {isLast ? "Finish" : "Done ✓"}
        </button>
      </div>
    </div>
  );
}
