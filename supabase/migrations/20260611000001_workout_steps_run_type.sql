-- Add run_type to plan_workouts
ALTER TABLE plan_workouts ADD COLUMN IF NOT EXISTS run_type text;

-- Create workout_steps table
CREATE TABLE IF NOT EXISTS workout_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_workout_id uuid NOT NULL REFERENCES plan_workouts(id) ON DELETE CASCADE,
  step_order int NOT NULL DEFAULT 0,
  step_type text NOT NULL DEFAULT 'main',
  label text,
  pace_type text,
  duration_minutes numeric,
  distance_miles numeric,
  notes text
);

ALTER TABLE workout_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their workout steps" ON workout_steps;
CREATE POLICY "Users can manage their workout steps" ON workout_steps
  FOR ALL USING (
    plan_workout_id IN (
      SELECT pw.id FROM plan_workouts pw
      JOIN training_plans tp ON tp.id = pw.plan_id
      WHERE tp.user_id = auth.uid()
    )
  );
