-- Both-sides exercises (e.g. 3 x 10 each side) are logged as one set log per
-- side, so a set is identified by (session_exercise_id, set_number, side).
-- `side` is null for ordinary exercises; NULLS NOT DISTINCT keeps those unique
-- per set_number exactly as before.
ALTER TABLE workout_set_logs
  ADD COLUMN IF NOT EXISTS side text CHECK (side IN ('left', 'right'));

ALTER TABLE workout_set_logs
  DROP CONSTRAINT IF EXISTS workout_set_logs_session_exercise_id_set_number_key;

ALTER TABLE workout_set_logs
  DROP CONSTRAINT IF EXISTS workout_set_logs_session_exercise_id_set_number_side_key;

ALTER TABLE workout_set_logs
  ADD CONSTRAINT workout_set_logs_session_exercise_id_set_number_side_key
  UNIQUE NULLS NOT DISTINCT (session_exercise_id, set_number, side);
