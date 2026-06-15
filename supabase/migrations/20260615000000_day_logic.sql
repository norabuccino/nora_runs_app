ALTER TABLE plan_workouts
  ADD COLUMN IF NOT EXISTS day_logic TEXT NOT NULL DEFAULT 'and'
    CHECK (day_logic IN ('and', 'or'));
