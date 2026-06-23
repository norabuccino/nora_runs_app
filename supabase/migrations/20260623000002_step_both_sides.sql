ALTER TABLE workout_steps
  ADD COLUMN IF NOT EXISTS both_sides boolean NOT NULL DEFAULT false;
