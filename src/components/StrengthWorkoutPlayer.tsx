"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWakeLock } from "@/hooks/useWakeLock";
import type { PlanWorkout, WorkoutStep, WorkoutSession, WorkoutSessionExerciseWithSets } from "@/types/database";
import {
  buildSessionBeats,
  formatStepDuration,
  isRestStep,
  stepTimedSeconds,
  suggestedWeightForSet,
  type SessionBeat,
} from "@/lib/workoutSteps";
import {
  getOrCreateWorkoutSession,
  logSet,
  completeWorkoutSession,
  getLastPerformances,
  type ExerciseHistoryEntry,
} from "@/app/actions/strengthSessions";
import { formatLoad, deriveCurrentLoad, formatActualSets } from "@/lib/strengthProgression";

const RESUME_MAX_AGE_MS = 12 * 60 * 60 * 1000; // don't resume an untracked session older than this

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

/** The set/round number a beat's performance is logged under for its exercise. */
function beatSetNumber(beat: SessionBeat): number {
  return beat.isSuperset ? beat.roundNumber! : beat.setNumber!;
}

const SIDE_LABELS = { left: "Left side", right: "Right side" } as const;

/** Whether a set log belongs to this beat's set/round and side. */
function logMatchesBeat(log: { set_number: number; side: string | null }, beat: SessionBeat): boolean {
  return log.set_number === beatSetNumber(beat) && log.side === beat.side;
}

/**
 * DB-driven resume position: the first beat whose exercise is tracked but
 * doesn't yet have a logged set for its slot (and side). Falls back to the start if
 * nothing in the workout is trackable, or the end if everything already is.
 */
function findResumeIndex(
  beats: SessionBeat[],
  sessionExerciseByStepId: Map<string, WorkoutSessionExerciseWithSets>
): number {
  let hadLoggable = false;
  for (let i = 0; i < beats.length; i++) {
    const se = sessionExerciseByStepId.get(beats[i].step.id);
    if (!se) continue;
    hadLoggable = true;
    const logged = se.workout_set_logs.some((l) => logMatchesBeat(l, beats[i]) && l.completed);
    if (!logged) return i;
  }
  return hadLoggable ? Math.max(0, beats.length - 1) : 0;
}

// One AudioContext for the whole player. Browsers (notably iOS Safari) keep a
// context created outside a user gesture suspended, so it's created/resumed
// from button clicks (see `primeAudio`) rather than when the timer fires.
let audioCtx: AudioContext | null = null;

function primeAudio(): AudioContext | null {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null; // Web Audio unavailable — silent fallback
  }
}

/** A short two-note chime (~0.6s). */
function playChime() {
  const ctx = primeAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [
    { freq: 880, offset: 0 },
    { freq: 1318.5, offset: 0.14 },
  ].forEach(({ freq, offset }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0 + offset);
    osc.stop(t0 + offset + 0.5);
  });
}

/** A single short blip for the 3-2-1 countdown at the end of a continuous timer. */
function playTick() {
  const ctx = primeAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 660;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.15);
}

const COUNTDOWN_SECONDS = 3;

interface ExerciseTimerProps {
  seconds: number;
  soundEnabled: boolean;
  /** Start counting as soon as the timer mounts (continuous mode, after the previous timer). */
  autoStart?: boolean;
  /** Continuous mode: 3-2-1 countdown ticks, and hand off to `onComplete` instead of waiting on the user. */
  continuous?: boolean;
  onComplete?: () => void;
}

function ExerciseTimer({ seconds, soundEnabled, autoStart = false, continuous = false, onComplete }: ExerciseTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(autoStart);
  const [alerted, setAlerted] = useState(false);
  const endAtRef = useRef(0); // 0 = not yet anchored (an auto-started timer anchors on its first effect run)
  const lastTickRef = useRef<number | null>(null);
  // The interval outlives renders, so read the latest callback through a ref.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  // Counts down against an absolute end time so a throttled/backgrounded tab
  // can't drift. The alert fires from the tick itself (once), not from render.
  useEffect(() => {
    if (!running) return;
    if (endAtRef.current === 0) endAtRef.current = Date.now() + seconds * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (continuous && soundEnabled && left > 0 && left <= COUNTDOWN_SECONDS && lastTickRef.current !== left) {
        lastTickRef.current = left;
        playTick();
      }
      if (left === 0) {
        clearInterval(id);
        setRunning(false);
        setAlerted(true);
        navigator.vibrate?.(continuous ? [120, 80, 120] : 200);
        if (soundEnabled) playChime();
        onCompleteRef.current?.();
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, soundEnabled, continuous, seconds]);

  function start() {
    primeAudio(); // inside the click gesture, so the chime is allowed to play later
    endAtRef.current = Date.now() + remaining * 1000;
    lastTickRef.current = null;
    setAlerted(false);
    setRunning(true);
  }

  function pause() {
    setRunning(false);
  }

  function reset() {
    setRunning(false);
    setAlerted(false);
    setRemaining(seconds);
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const label = remaining === 0 ? "Reset" : remaining === seconds ? "Start timer" : "Resume";
  const inCountdown = continuous && running && remaining > 0 && remaining <= COUNTDOWN_SECONDS;

  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={`${continuous ? "text-6xl" : "text-4xl"} font-mono font-bold tabular-nums ${
          alerted || inCountdown ? "text-[var(--accent)] animate-pulse" : ""
        }`}
      >
        {mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`}
      </span>
      {continuous && (
        <div className="h-1.5 w-48 rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-[width] duration-300 ease-linear"
            style={{ width: `${((seconds - remaining) / seconds) * 100}%` }}
          />
        </div>
      )}
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

export type SessionSource =
  | { planWorkoutId: string; sessionDate: string }
  | { scheduledWorkoutId: string; sessionDate: string };

interface StrengthWorkoutPlayerProps {
  workout: PlanWorkout;
  steps: WorkoutStep[];
  /**
   * When provided, the session is persisted: sets are logged as you go, "Last
   * time" performance is shown per exercise, and progress resumes from the
   * database rather than localStorage. Omit for read-only template browsing,
   * which falls back to the old ephemeral, localStorage-only walkthrough.
   */
  sessionSource?: SessionSource;
  onExit: () => void;
  onFinish: () => void;
}

export function StrengthWorkoutPlayer({ workout, steps, sessionSource, onExit, onFinish }: StrengthWorkoutPlayerProps) {
  const beats = useMemo(() => buildSessionBeats(steps), [steps]);
  const tracked = !!sessionSource;
  const continuous = !!workout.continuous_timers;

  const [loadingSession, setLoadingSession] = useState(tracked);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [sessionExercises, setSessionExercises] = useState<WorkoutSessionExerciseWithSets[]>([]);
  const [lastPerf, setLastPerf] = useState<Record<string, ExerciseHistoryEntry>>({});
  const [beatIndex, setBeatIndex] = useState(() => (tracked ? 0 : loadSavedBeatIndex(workout.id, beats.length)));
  const [finished, setFinished] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true); // chime on/off for this workout only
  // Continuous mode: the beat whose timer should start on its own when it's
  // reached (set on every forward move, cleared by Back), and a counter that
  // replays the full-screen "now on to…" flash after each timer-driven advance.
  const [autoStartBeat, setAutoStartBeat] = useState<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  // Keep the screen awake for the whole session, on mobile and desktop.
  useWakeLock(!finished);

  // Load or create the persisted session once, on mount.
  useEffect(() => {
    if (!sessionSource) return;
    let cancelled = false;
    (async () => {
      const result = await getOrCreateWorkoutSession(sessionSource);
      if (cancelled) return;
      setSession(result.session);
      setSessionExercises(result.exercises);
      const exerciseIds = Array.from(
        new Set(result.exercises.map((e) => e.exercise_id).filter((id): id is string => !!id))
      );
      const perf = exerciseIds.length > 0 ? await getLastPerformances(exerciseIds, result.session.id) : {};
      if (cancelled) return;
      setLastPerf(perf);
      const stepMap = new Map(result.exercises.filter((e) => e.source_workout_step_id).map((e) => [e.source_workout_step_id!, e]));
      setBeatIndex(findResumeIndex(beats, stepMap));
      setLoadingSession(false);
    })();
    return () => { cancelled = true; };
    // Run once on mount — steps/workout don't change during a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tracked && !finished) saveBeatIndex(workout.id, beatIndex);
  }, [workout.id, beatIndex, finished, tracked]);

  const sessionExerciseByStepId = useMemo(
    () => new Map(sessionExercises.filter((e) => e.source_workout_step_id).map((e) => [e.source_workout_step_id!, e])),
    [sessionExercises]
  );

  // Reset the input fields whenever the current beat changes, prefilled from
  // this session's own saved log (if resuming) or the last performance.
  useEffect(() => {
    if (loadingSession) return;
    const beat = beats[beatIndex];
    if (!beat) return;
    const se = sessionExerciseByStepId.get(beat.step.id);
    const setNum = beatSetNumber(beat);
    const existing = se?.workout_set_logs.find((l) => logMatchesBeat(l, beat));
    const last = se?.exercise_id ? lastPerf[se.exercise_id] : undefined;
    const lastSet =
      last?.sets.find((s) => logMatchesBeat(s, beat)) ??
      last?.sets.find((s) => s.set_number === setNum) ??
      last?.sets[last.sets.length - 1];
    setWeightInput(existing?.weight != null ? String(existing.weight) : lastSet?.weight != null ? String(lastSet.weight) : "");
    setRepsInput(
      existing?.reps_completed != null ? String(existing.reps_completed) : beat.step.reps != null ? String(beat.step.reps) : ""
    );
  }, [beatIndex, loadingSession, beats, sessionExerciseByStepId, lastPerf]);

  if (beats.length === 0) {
    return (
      <Overlay onExit={onExit}>
        <p className="text-sm text-[var(--muted)]">This workout has no exercises to run through.</p>
      </Overlay>
    );
  }

  if (loadingSession) {
    return (
      <Overlay>
        <p className="text-sm text-[var(--muted)]">Loading…</p>
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
  const sessionExercise = sessionExerciseByStepId.get(beat.step.id) ?? null;
  const isWeighted = sessionExercise != null && sessionExercise.load_format != null;
  const hasReps = beat.step.reps != null;
  const timedSeconds = stepTimedSeconds(beat.step);
  const isTimed = !hasReps && timedSeconds != null;
  const isLoggable = sessionExercise != null;

  const lastPerfForExercise = sessionExercise?.exercise_id ? lastPerf[sessionExercise.exercise_id] : undefined;
  const lastLoad = lastPerfForExercise ? deriveCurrentLoad(lastPerfForExercise.sets) : null;
  const lastLoadLabel = lastLoad != null ? formatLoad(lastLoad, lastPerfForExercise!.loadFormat) : null;
  const lastActual = lastPerfForExercise ? formatActualSets(lastPerfForExercise.sets) : null;

  function logCurrentBeat() {
    if (!sessionExercise) return;
    const setNum = beatSetNumber(beat);
    const parsedWeight = isWeighted && weightInput.trim() !== "" ? parseFloat(weightInput) : null;
    const parsedReps = hasReps && repsInput.trim() !== "" ? parseInt(repsInput, 10) : null;
    const durationSeconds = isTimed ? timedSeconds : null;
    void logSet(sessionExercise.id, setNum, beat.side, {
      weight: parsedWeight,
      reps_completed: parsedReps,
      duration_seconds: durationSeconds,
      completed: true,
    }).catch(() => {
      // best-effort — the session still advances even if the write fails
    });
  }

  function advance() {
    logCurrentBeat();
    if (isLast) {
      if (session) {
        void completeWorkoutSession(session.id).catch(() => {});
      }
      if (!tracked) clearSavedSession(workout.id);
      setFinished(true);
    } else {
      if (continuous) setAutoStartBeat(beatIndex + 1);
      setBeatIndex(beatIndex + 1);
    }
  }

  /** Continuous mode: the current timer ran out — move straight on, and announce it. */
  function handleTimerComplete() {
    if (!continuous) return;
    if (!isLast) setFlashKey((k) => k + 1);
    advance();
  }

  function goBack() {
    setAutoStartBeat(null);
    setBeatIndex((i) => Math.max(0, i - 1));
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next) playChime(); // preview, and unlocks audio inside this click
  }

  function handleExit() {
    if (!confirm("End this workout session? Your progress will be lost.")) return;
    if (!tracked) clearSavedSession(workout.id);
    onExit();
  }

  const suggestedWeight = suggestedWeightForSet(beat.step.weight_suggestion, beatSetNumber(beat));
  // A side beat already says which side it is, so its reps are just the per-side count.
  const repsLabel = beat.step.reps ? `${beat.step.reps} reps` : null;
  const durationLabel = !repsLabel ? formatStepDuration(beat.step.duration_minutes, beat.step.duration_unit) : null;
  const progressLabel = beat.isSuperset
    ? `Round ${beat.roundNumber} of ${beat.totalRounds}`
    : beat.totalSets && beat.totalSets > 1
    ? `Set ${beat.setNumber} of ${beat.totalSets}`
    : null;

  const nextBeat = !isLast ? beats[beatIndex + 1] : null;
  const nextIsSameExercise = nextBeat != null && nextBeat.step.id === beat.step.id;
  const nextIsOtherSide = nextIsSameExercise && nextBeat.side != null && beatSetNumber(nextBeat) === beatSetNumber(beat);
  const nextRepsLabel = nextBeat?.step.reps
    ? `${nextBeat.step.reps} reps${nextBeat.side ? ` · ${nextBeat.side} side` : ""}`
    : null;
  const nextDurationLabel = nextBeat && !nextRepsLabel
    ? formatStepDuration(nextBeat.step.duration_minutes, nextBeat.step.duration_unit)
    : null;
  const nextWeight = nextBeat ? suggestedWeightForSet(nextBeat.step.weight_suggestion, beatSetNumber(nextBeat)) : null;
  const nextDetail = [nextRepsLabel || nextDurationLabel, nextWeight].filter(Boolean).join(" · ");

  const isRest = isRestStep(beat.step);
  // In continuous mode a timed beat moves on by itself, so a stray tap on the
  // screen shouldn't skip it — the Next button still works.
  const tapToAdvance = !(continuous && isTimed);
  const flashLabel = isRest
    ? "Rest"
    : `${beat.step.label || "Exercise"}${beat.side ? ` — ${beat.side} side` : ""}`;

  return (
    <div className="fixed inset-0 z-[60] bg-[var(--background)] flex flex-col">
      {/* Continuous-mode transition flash: fills the screen with the new step's name for
          ~1.5s after a timer auto-advances, so the change reads from across the room. Keyed
          by flashKey so it replays on each advance; pointer-events-none so it never blocks. */}
      {continuous && flashKey > 0 && (
        <div
          key={flashKey}
          aria-live="assertive"
          className={`pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6 text-center text-white animate-[transition-flash_1.6s_ease-out_forwards] ${
            isRest ? "bg-emerald-600" : "bg-[var(--accent)]"
          }`}
        >
          <span className="text-sm font-semibold uppercase tracking-widest opacity-80">
            {isRest ? "Nice work — now" : "Go!"}
          </span>
          <span className="text-5xl font-bold leading-tight">{flashLabel}</span>
          {isTimed && durationLabel && <span className="text-lg font-medium opacity-90">{durationLabel}</span>}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)]">
        <div className="min-w-0">
          <p className="text-xs text-[var(--muted)] truncate">
            {workout.title}
            {continuous && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent)] font-semibold">
                Continuous
              </span>
            )}
          </p>
          <p key={beatIndex} className="text-sm font-semibold animate-[beat-enter_0.25s_ease-out]">
            Step {beatIndex + 1} of {beats.length}
          </p>
          <div className="mt-1 h-1.5 w-40 max-w-[40vw] rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${((beatIndex + 1) / beats.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={toggleSound}
            aria-label={soundEnabled ? "Mute timer chime" : "Unmute timer chime"}
            aria-pressed={soundEnabled}
            title={soundEnabled ? "Timer chime on" : "Timer chime off"}
            className="text-[var(--muted)] hover:text-[var(--foreground)] text-lg leading-none"
          >
            {soundEnabled ? "🔔" : "🔕"}
          </button>
          <button
            onClick={handleExit}
            className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* Exercise area — tap anywhere to advance. The weight/reps inputs and timer controls stop propagation,
          so editing them never advances. Keyed by beatIndex so the enter animation replays on every advance,
          making the step change unmistakable. */}
      <div
        key={beatIndex}
        onClick={tapToAdvance ? advance : undefined}
        className={`flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 text-center overflow-y-auto animate-[beat-enter_0.25s_ease-out] select-none ${
          tapToAdvance ? "cursor-pointer" : ""
        } ${isRest ? "bg-emerald-500/10" : ""}`}
      >
        {beat.groupName && (
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            {beat.groupName}
          </span>
        )}
        {progressLabel && <span className="text-sm text-[var(--muted)]">{progressLabel}</span>}
        <h2 className={`text-3xl font-bold leading-tight ${isRest ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
          {beat.step.label || "Exercise"}
        </h2>
        {beat.side && (
          <span className="px-3 py-1 rounded-full bg-[var(--accent)] text-white text-sm font-semibold uppercase tracking-wide">
            {SIDE_LABELS[beat.side]}
          </span>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3 text-base text-[var(--muted)]">
          {repsLabel && <span>{repsLabel}</span>}
          {durationLabel && <span>{durationLabel}</span>}
          {suggestedWeight && <span>{suggestedWeight}</span>}
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

        {isLoggable && (lastLoadLabel || lastActual) && (
          <p className="text-xs text-[var(--muted)] max-w-sm">
            Last time:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {lastLoadLabel}
              {lastLoadLabel && lastActual ? " — " : ""}
              {lastActual}
            </span>
            {" · "}
            {lastPerfForExercise!.sessionDate} · {lastPerfForExercise!.workoutTitle}
          </p>
        )}

        {(isWeighted || hasReps) && (
          <div className="flex gap-4 justify-center" onClick={(e) => e.stopPropagation()}>
            {isWeighted && (
              <label className="flex flex-col items-center gap-1">
                <span className="text-xs text-[var(--muted)]">Weight</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="w-24 text-center text-lg rounded-lg border border-[var(--border)] bg-[var(--background)] py-1.5"
                />
              </label>
            )}
            {hasReps && (
              <label className="flex flex-col items-center gap-1">
                <span className="text-xs text-[var(--muted)]">Reps</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={repsInput}
                  onChange={(e) => setRepsInput(e.target.value)}
                  className="w-20 text-center text-lg rounded-lg border border-[var(--border)] bg-[var(--background)] py-1.5"
                />
              </label>
            )}
          </div>
        )}

        {isTimed && (
          <div onClick={(e) => e.stopPropagation()}>
            <ExerciseTimer
              key={beatIndex}
              seconds={timedSeconds!}
              soundEnabled={soundEnabled}
              continuous={continuous}
              autoStart={continuous && autoStartBeat === beatIndex}
              onComplete={handleTimerComplete}
            />
          </div>
        )}

        {nextBeat ? (
          <div className="mt-2 px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] max-w-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Up next</span>
            <p className="text-sm font-medium">
              {nextIsOtherSide
                ? `${nextBeat.step.label || "Exercise"} — ${nextBeat.side} side`
                : nextIsSameExercise
                ? `${nextBeat.step.label || "Exercise"} — next set`
                : nextBeat.step.label || "Exercise"}
            </p>
            {nextDetail && <p className="text-xs text-[var(--muted)]">{nextDetail}</p>}
          </div>
        ) : (
          <p className="mt-2 text-xs text-[var(--muted)] italic">Last exercise — finish strong!</p>
        )}

        <span className="mt-4 text-sm font-medium text-[var(--accent)]">
          {!tapToAdvance
            ? isLast
              ? "Finishes when the timer ends"
              : "Moves on automatically when the timer ends"
            : isLast
            ? "Tap anywhere to finish →"
            : "Tap anywhere for next →"}
        </span>
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
          {isLast ? "Finish" : "Next →"}
        </button>
      </div>
    </div>
  );
}
