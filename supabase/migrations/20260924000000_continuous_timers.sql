-- Strength workouts whose timed exercises/rests should run back-to-back:
-- when one timer ends the player auto-advances and starts the next.
ALTER TABLE plan_workouts ADD COLUMN IF NOT EXISTS continuous_timers BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS continuous_timers BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE scheduled_workouts ADD COLUMN IF NOT EXISTS continuous_timers BOOLEAN NOT NULL DEFAULT false;
