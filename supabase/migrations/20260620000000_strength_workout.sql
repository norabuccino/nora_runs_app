ALTER TABLE plan_workouts ADD COLUMN IF NOT EXISTS strength_type text;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strength_type text;
ALTER TABLE workout_steps ADD COLUMN IF NOT EXISTS reps integer;
ALTER TABLE workout_steps ADD COLUMN IF NOT EXISTS weight_suggestion text;
