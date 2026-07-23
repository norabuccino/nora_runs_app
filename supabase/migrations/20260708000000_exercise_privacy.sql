ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- Allow users to see their own exercises (any visibility) and public exercises from others
DROP POLICY IF EXISTS "Users manage their own exercises" ON exercises;

DROP POLICY IF EXISTS "Users select exercises" ON exercises;
CREATE POLICY "Users select exercises" ON exercises
  FOR SELECT USING (user_id = auth.uid() OR is_private = false);

DROP POLICY IF EXISTS "Users insert own exercises" ON exercises;
CREATE POLICY "Users insert own exercises" ON exercises
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own exercises" ON exercises;
CREATE POLICY "Users update own exercises" ON exercises
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own exercises" ON exercises;
CREATE POLICY "Users delete own exercises" ON exercises
  FOR DELETE USING (user_id = auth.uid());
