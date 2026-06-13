-- Expand workout type options to include Bike, Swim, Yoga, and Elliptical

-- plan_workouts: drop the inline-named check and replace it
ALTER TABLE plan_workouts DROP CONSTRAINT IF EXISTS plan_workouts_type_check;
ALTER TABLE plan_workouts ADD CONSTRAINT plan_workouts_type_check
  CHECK (type IN ('run', 'strength', 'rest', 'cross_train', 'bike', 'swim', 'yoga', 'elliptical'));

-- workouts (library): add the same constraint (table had no explicit one before)
ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_type_check;
ALTER TABLE workouts ADD CONSTRAINT workouts_type_check
  CHECK (type IN ('run', 'strength', 'rest', 'cross_train', 'bike', 'swim', 'yoga', 'elliptical'));
