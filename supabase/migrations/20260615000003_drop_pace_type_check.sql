-- The pace_type CHECK constraint listed hardcoded values ('easy', 'tempo', etc.)
-- but the app now uses user-defined named paces from running_paces. Drop it.
ALTER TABLE plan_workouts DROP CONSTRAINT IF EXISTS plan_workouts_pace_type_check;
