ALTER TABLE plan_workouts ADD COLUMN IF NOT EXISTS library_workout_id uuid REFERENCES workouts(id) ON DELETE CASCADE;
