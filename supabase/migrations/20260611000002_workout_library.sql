-- Standalone workout library (not tied to any plan)
CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'run',
  run_type text,
  title text NOT NULL,
  description text,
  distance_miles numeric,
  pace_type text,
  duration_minutes int,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own workouts" ON workouts;
CREATE POLICY "Users manage their own workouts" ON workouts
  FOR ALL USING (user_id = auth.uid());

-- Allow workout_steps to belong to either a plan_workout or a library workout
ALTER TABLE workout_steps ALTER COLUMN plan_workout_id DROP NOT NULL;
ALTER TABLE workout_steps ADD COLUMN IF NOT EXISTS workout_id uuid REFERENCES workouts(id) ON DELETE CASCADE;

ALTER TABLE workout_steps DROP CONSTRAINT IF EXISTS workout_steps_exactly_one_parent;
ALTER TABLE workout_steps ADD CONSTRAINT workout_steps_exactly_one_parent CHECK (
  (plan_workout_id IS NOT NULL AND workout_id IS NULL) OR
  (plan_workout_id IS NULL AND workout_id IS NOT NULL)
);

-- Update RLS to cover both ownership paths
DROP POLICY IF EXISTS "Users can manage their workout steps" ON workout_steps;
CREATE POLICY "Users can manage their workout steps" ON workout_steps
  FOR ALL USING (
    (
      plan_workout_id IS NOT NULL AND plan_workout_id IN (
        SELECT pw.id FROM plan_workouts pw
        JOIN training_plans tp ON tp.id = pw.plan_id
        WHERE tp.user_id = auth.uid()
      )
    ) OR (
      workout_id IS NOT NULL AND workout_id IN (
        SELECT w.id FROM workouts w WHERE w.user_id = auth.uid()
      )
    )
  );
