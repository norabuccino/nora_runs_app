-- Yoga and Elliptical were unused as standalone workout types. Consolidate
-- them under Cross-Train with a cross_train_type sub-field instead.

ALTER TABLE plan_workouts ADD COLUMN IF NOT EXISTS cross_train_type TEXT;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS cross_train_type TEXT;
ALTER TABLE scheduled_workouts ADD COLUMN IF NOT EXISTS cross_train_type TEXT;

-- Migrate any existing yoga/elliptical rows into cross_train before the
-- `type` CHECK constraint stops allowing those values.
UPDATE plan_workouts SET type = 'cross_train', cross_train_type = 'yoga' WHERE type = 'yoga';
UPDATE plan_workouts SET type = 'cross_train', cross_train_type = 'elliptical' WHERE type = 'elliptical';
UPDATE workouts SET type = 'cross_train', cross_train_type = 'yoga' WHERE type = 'yoga';
UPDATE workouts SET type = 'cross_train', cross_train_type = 'elliptical' WHERE type = 'elliptical';
UPDATE scheduled_workouts SET type = 'cross_train', cross_train_type = 'yoga' WHERE type = 'yoga';
UPDATE scheduled_workouts SET type = 'cross_train', cross_train_type = 'elliptical' WHERE type = 'elliptical';

ALTER TABLE plan_workouts DROP CONSTRAINT IF EXISTS plan_workouts_type_check;
ALTER TABLE plan_workouts ADD CONSTRAINT plan_workouts_type_check
  CHECK (type IN ('run', 'strength', 'rest', 'cross_train', 'bike', 'swim'));

ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_type_check;
ALTER TABLE workouts ADD CONSTRAINT workouts_type_check
  CHECK (type IN ('run', 'strength', 'rest', 'cross_train', 'bike', 'swim'));

ALTER TABLE scheduled_workouts DROP CONSTRAINT IF EXISTS scheduled_workouts_type_check;
ALTER TABLE scheduled_workouts ADD CONSTRAINT scheduled_workouts_type_check
  CHECK (type IN ('run', 'strength', 'rest', 'cross_train', 'bike', 'swim'));

ALTER TABLE plan_workouts DROP CONSTRAINT IF EXISTS plan_workouts_cross_train_type_check;
ALTER TABLE plan_workouts ADD CONSTRAINT plan_workouts_cross_train_type_check
  CHECK (cross_train_type IS NULL OR cross_train_type IN ('walk', 'elliptical', 'yoga', 'mobility', 'other'));

ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_cross_train_type_check;
ALTER TABLE workouts ADD CONSTRAINT workouts_cross_train_type_check
  CHECK (cross_train_type IS NULL OR cross_train_type IN ('walk', 'elliptical', 'yoga', 'mobility', 'other'));

ALTER TABLE scheduled_workouts DROP CONSTRAINT IF EXISTS scheduled_workouts_cross_train_type_check;
ALTER TABLE scheduled_workouts ADD CONSTRAINT scheduled_workouts_cross_train_type_check
  CHECK (cross_train_type IS NULL OR cross_train_type IN ('walk', 'elliptical', 'yoga', 'mobility', 'other'));
