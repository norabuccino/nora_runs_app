-- Bike workouts: indoor vs outdoor.
ALTER TABLE plan_workouts ADD COLUMN IF NOT EXISTS bike_location TEXT;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS bike_location TEXT;
ALTER TABLE scheduled_workouts ADD COLUMN IF NOT EXISTS bike_location TEXT;

ALTER TABLE plan_workouts DROP CONSTRAINT IF EXISTS plan_workouts_bike_location_check;
ALTER TABLE plan_workouts ADD CONSTRAINT plan_workouts_bike_location_check
  CHECK (bike_location IS NULL OR bike_location IN ('indoor', 'outdoor'));

ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_bike_location_check;
ALTER TABLE workouts ADD CONSTRAINT workouts_bike_location_check
  CHECK (bike_location IS NULL OR bike_location IN ('indoor', 'outdoor'));

ALTER TABLE scheduled_workouts DROP CONSTRAINT IF EXISTS scheduled_workouts_bike_location_check;
ALTER TABLE scheduled_workouts ADD CONSTRAINT scheduled_workouts_bike_location_check
  CHECK (bike_location IS NULL OR bike_location IN ('indoor', 'outdoor'));

-- Swim interval steps: stroke style.
ALTER TABLE workout_steps ADD COLUMN IF NOT EXISTS stroke_style TEXT;

ALTER TABLE workout_steps DROP CONSTRAINT IF EXISTS workout_steps_stroke_style_check;
ALTER TABLE workout_steps ADD CONSTRAINT workout_steps_stroke_style_check
  CHECK (stroke_style IS NULL OR stroke_style IN ('freestyle', 'backstroke', 'breaststroke', 'butterfly'));
