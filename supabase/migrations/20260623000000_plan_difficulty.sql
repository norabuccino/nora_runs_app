ALTER TABLE training_plans
  ADD COLUMN IF NOT EXISTS difficulty text CHECK (difficulty IN ('beginner', 'intermediate', 'advanced'));
