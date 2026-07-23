-- Deleting a plan_workout should also remove any completion log tied to it —
-- mirrors the existing ON DELETE CASCADE on workout_logs.user_plan_id.
-- Without this, deleting a workout that had already been marked complete
-- fails with a foreign key violation.
ALTER TABLE workout_logs DROP CONSTRAINT IF EXISTS workout_logs_plan_workout_id_fkey;
ALTER TABLE workout_logs
  ADD CONSTRAINT workout_logs_plan_workout_id_fkey
  FOREIGN KEY (plan_workout_id) REFERENCES plan_workouts(id) ON DELETE CASCADE;
