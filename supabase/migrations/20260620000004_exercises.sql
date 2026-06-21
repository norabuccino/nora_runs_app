CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  video_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own exercises" ON exercises;
CREATE POLICY "Users manage their own exercises" ON exercises
  FOR ALL USING (user_id = auth.uid());

ALTER TABLE workout_steps ADD COLUMN IF NOT EXISTS exercise_id uuid REFERENCES exercises(id) ON DELETE SET NULL;
