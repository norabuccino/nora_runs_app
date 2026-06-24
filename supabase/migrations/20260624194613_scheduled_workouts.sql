-- New table for ad-hoc workouts scheduled to a specific calendar date (no plan required)
CREATE TABLE IF NOT EXISTS scheduled_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('run','strength','rest','cross_train','bike','swim','yoga','elliptical')),
  run_type TEXT,
  strength_type TEXT,
  title TEXT NOT NULL,
  description TEXT,
  distance_miles NUMERIC,
  distance_unit TEXT NOT NULL DEFAULT 'mi',
  pace_type TEXT,
  duration_minutes INT,
  notes TEXT,
  library_workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scheduled_workouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own scheduled workouts" ON scheduled_workouts;
CREATE POLICY "Users manage their own scheduled workouts"
  ON scheduled_workouts FOR ALL USING (user_id = auth.uid());

-- Extend workout_steps to allow scheduled_workout_id as a third parent type
ALTER TABLE workout_steps
  ADD COLUMN IF NOT EXISTS scheduled_workout_id UUID REFERENCES scheduled_workouts(id) ON DELETE CASCADE;

-- Update CHECK constraint to allow exactly one of three parents
ALTER TABLE workout_steps DROP CONSTRAINT IF EXISTS workout_steps_exactly_one_parent;
ALTER TABLE workout_steps ADD CONSTRAINT workout_steps_exactly_one_parent CHECK (
  (plan_workout_id IS NOT NULL AND workout_id IS NULL AND scheduled_workout_id IS NULL) OR
  (plan_workout_id IS NULL AND workout_id IS NOT NULL AND scheduled_workout_id IS NULL) OR
  (plan_workout_id IS NULL AND workout_id IS NULL AND scheduled_workout_id IS NOT NULL)
);

-- Update workout_steps RLS to also allow access via scheduled_workout_id
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
    ) OR (
      scheduled_workout_id IS NOT NULL AND scheduled_workout_id IN (
        SELECT sw.id FROM scheduled_workouts sw WHERE sw.user_id = auth.uid()
      )
    )
  );
