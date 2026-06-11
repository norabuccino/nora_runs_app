-- Training plan templates
CREATE TABLE IF NOT EXISTS training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('marathon', 'half_marathon', 'strength', 'custom')),
  description text,
  total_weeks int NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own plans" ON training_plans;
CREATE POLICY "own plans" ON training_plans
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Individual workouts inside a plan
CREATE TABLE IF NOT EXISTS plan_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES training_plans ON DELETE CASCADE NOT NULL,
  week_number int NOT NULL,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  type text NOT NULL CHECK (type IN ('run', 'strength', 'rest', 'cross_train')),
  title text NOT NULL,
  description text,
  distance_miles numeric,
  pace_type text CHECK (pace_type IN ('easy', 'tempo', 'threshold', 'race', 'interval')),
  duration_minutes int,
  notes text,
  sort_order int DEFAULT 0
);
ALTER TABLE plan_workouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own workouts" ON plan_workouts;
CREATE POLICY "own workouts" ON plan_workouts
  USING (EXISTS (SELECT 1 FROM training_plans WHERE id = plan_workouts.plan_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM training_plans WHERE id = plan_workouts.plan_id AND user_id = auth.uid()));

-- User's assigned plan instances
CREATE TABLE IF NOT EXISTS user_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  plan_id uuid REFERENCES training_plans NOT NULL,
  start_date date NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own user_plans" ON user_plans;
CREATE POLICY "own user_plans" ON user_plans
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Saved running paces
CREATE TABLE IF NOT EXISTS running_paces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  pace_seconds_per_mile int NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE running_paces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own paces" ON running_paces;
CREATE POLICY "own paces" ON running_paces
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Workout completion logs and per-instance overrides
CREATE TABLE IF NOT EXISTS workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  user_plan_id uuid REFERENCES user_plans ON DELETE CASCADE NOT NULL,
  plan_workout_id uuid REFERENCES plan_workouts NOT NULL,
  scheduled_date date NOT NULL,
  completed_at timestamptz,
  actual_distance_miles numeric,
  actual_duration_seconds int,
  strava_activity_id text,
  custom_title text,
  custom_description text,
  notes text,
  UNIQUE(user_plan_id, plan_workout_id)
);
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own logs" ON workout_logs;
CREATE POLICY "own logs" ON workout_logs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
