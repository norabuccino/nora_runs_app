CREATE TABLE IF NOT EXISTS plan_week_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  purpose text NOT NULL DEFAULT '',
  UNIQUE(plan_id, week_number)
);

ALTER TABLE plan_week_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own plan week notes" ON plan_week_notes;
CREATE POLICY "Users manage their own plan week notes" ON plan_week_notes
  FOR ALL USING (
    plan_id IN (SELECT id FROM training_plans WHERE user_id = auth.uid())
  );
