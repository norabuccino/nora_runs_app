ALTER TABLE training_plans
  ADD COLUMN IF NOT EXISTS source_plan_id UUID REFERENCES training_plans(id) ON DELETE SET NULL;
