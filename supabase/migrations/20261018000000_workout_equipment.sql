-- Workout-level equipment adjustments. A strength workout's equipment list is
-- derived from its exercises' equipment; these record what the user added on
-- top of that and which derived items they removed, so the list keeps tracking
-- exercise changes while preserving manual edits.
ALTER TABLE plan_workouts ADD COLUMN IF NOT EXISTS equipment_added TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE plan_workouts ADD COLUMN IF NOT EXISTS equipment_removed TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS equipment_added TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS equipment_removed TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE scheduled_workouts ADD COLUMN IF NOT EXISTS equipment_added TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE scheduled_workouts ADD COLUMN IF NOT EXISTS equipment_removed TEXT[] NOT NULL DEFAULT '{}';
