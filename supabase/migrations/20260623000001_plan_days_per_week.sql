ALTER TABLE training_plans
  ADD COLUMN IF NOT EXISTS days_per_week integer CHECK (days_per_week BETWEEN 2 AND 7);
