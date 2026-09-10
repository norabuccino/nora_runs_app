-- Strength progression tracking: exercise loading metadata + completed
-- workout session / per-exercise / per-set performance tables.

-- 1. Exercise loading metadata (no authoritative weight stored on the exercise itself)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS loading_category text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS track_load boolean NOT NULL DEFAULT false;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS load_format text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS default_increment numeric;

-- 2. Workout sessions — one row per actual, dated performance of a workout
CREATE TABLE IF NOT EXISTS workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  plan_workout_id uuid REFERENCES plan_workouts(id) ON DELETE CASCADE,
  scheduled_workout_id uuid REFERENCES scheduled_workouts(id) ON DELETE CASCADE,
  title text NOT NULL,
  workout_type text NOT NULL,
  strength_type text,
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workout_sessions DROP CONSTRAINT IF EXISTS workout_sessions_exactly_one_parent;
ALTER TABLE workout_sessions ADD CONSTRAINT workout_sessions_exactly_one_parent CHECK (
  (plan_workout_id IS NOT NULL AND scheduled_workout_id IS NULL) OR
  (plan_workout_id IS NULL AND scheduled_workout_id IS NOT NULL)
);

ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own workout sessions" ON workout_sessions;
CREATE POLICY "Users manage their own workout sessions"
  ON workout_sessions FOR ALL USING (user_id = auth.uid());

-- 3. Session exercises — one row per exercise actually performed in a session,
--    snapshotting the prescription and superset structure at logging time.
CREATE TABLE IF NOT EXISTS workout_session_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES exercises(id) ON DELETE SET NULL,
  source_workout_step_id uuid REFERENCES workout_steps(id) ON DELETE SET NULL,
  step_order int NOT NULL DEFAULT 0,
  repeat_group_id int,
  repeat_count int NOT NULL DEFAULT 1,
  group_name text,
  planned_sets int,
  planned_reps int,
  planned_duration_minutes numeric,
  planned_duration_unit text NOT NULL DEFAULT 'min',
  load_format text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workout_session_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own session exercises" ON workout_session_exercises;
CREATE POLICY "Users manage their own session exercises" ON workout_session_exercises
  FOR ALL USING (
    session_id IN (SELECT ws.id FROM workout_sessions ws WHERE ws.user_id = auth.uid())
  );

-- 4. Set logs — one row per actual set performed
CREATE TABLE IF NOT EXISTS workout_set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_exercise_id uuid NOT NULL REFERENCES workout_session_exercises(id) ON DELETE CASCADE,
  set_number int NOT NULL,
  weight numeric,
  reps_completed int,
  duration_seconds numeric,
  rpe numeric,
  completed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_exercise_id, set_number)
);

ALTER TABLE workout_set_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own set logs" ON workout_set_logs;
CREATE POLICY "Users manage their own set logs" ON workout_set_logs
  FOR ALL USING (
    session_exercise_id IN (
      SELECT wse.id FROM workout_session_exercises wse
      JOIN workout_sessions ws ON ws.id = wse.session_id
      WHERE ws.user_id = auth.uid()
    )
  );
