-- Expand allowed plan types to include 5k_10k and base_building
ALTER TABLE training_plans
  DROP CONSTRAINT IF EXISTS training_plans_type_check;
ALTER TABLE training_plans
  ADD CONSTRAINT training_plans_type_check
  CHECK (type IN ('marathon', 'half_marathon', 'strength', 'custom', '5k_10k', 'base_building'));
