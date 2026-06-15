-- ── Profiles table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ── is_admin() helper ──────────────────────────────────────────────────────────
-- SECURITY DEFINER so it bypasses profiles RLS, preventing infinite recursion
-- when policies call it.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── Profiles RLS ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "select profiles" ON profiles;
CREATE POLICY "select profiles" ON profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "insert profiles" ON profiles;
CREATE POLICY "insert profiles" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "update profiles" ON profiles;
CREATE POLICY "update profiles" ON profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Auto-create profile on signup ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Seed profiles for existing users ──────────────────────────────────────────

INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'user'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@local.dev';

-- ── Update training_plans RLS ──────────────────────────────────────────────────
-- Base plans (source_plan_id IS NULL) are readable by everyone, writable by admins.
-- Personal copies (source_plan_id IS NOT NULL) are only readable/writable by their owner.

DROP POLICY IF EXISTS "own plans" ON training_plans;

DROP POLICY IF EXISTS "select plans" ON training_plans;
CREATE POLICY "select plans" ON training_plans FOR SELECT
  USING (source_plan_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "insert plans" ON training_plans;
CREATE POLICY "insert plans" ON training_plans FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND (
      (public.is_admin() AND source_plan_id IS NULL) OR
      source_plan_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "update plans" ON training_plans;
CREATE POLICY "update plans" ON training_plans FOR UPDATE
  USING (
    (public.is_admin() AND source_plan_id IS NULL) OR
    (user_id = auth.uid() AND source_plan_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "delete plans" ON training_plans;
CREATE POLICY "delete plans" ON training_plans FOR DELETE
  USING (
    (public.is_admin() AND source_plan_id IS NULL) OR
    (user_id = auth.uid() AND source_plan_id IS NOT NULL)
  );

-- ── Update plan_workouts RLS ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "own workouts" ON plan_workouts;

DROP POLICY IF EXISTS "select plan workouts" ON plan_workouts;
CREATE POLICY "select plan workouts" ON plan_workouts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM training_plans tp
    WHERE tp.id = plan_workouts.plan_id
    AND (tp.source_plan_id IS NULL OR tp.user_id = auth.uid())
  ));

DROP POLICY IF EXISTS "insert plan workouts" ON plan_workouts;
CREATE POLICY "insert plan workouts" ON plan_workouts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM training_plans tp
    WHERE tp.id = plan_workouts.plan_id
    AND (
      (public.is_admin() AND tp.source_plan_id IS NULL) OR
      (tp.user_id = auth.uid() AND tp.source_plan_id IS NOT NULL)
    )
  ));

DROP POLICY IF EXISTS "update plan workouts" ON plan_workouts;
CREATE POLICY "update plan workouts" ON plan_workouts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM training_plans tp
    WHERE tp.id = plan_workouts.plan_id
    AND (
      (public.is_admin() AND tp.source_plan_id IS NULL) OR
      (tp.user_id = auth.uid() AND tp.source_plan_id IS NOT NULL)
    )
  ));

DROP POLICY IF EXISTS "delete plan workouts" ON plan_workouts;
CREATE POLICY "delete plan workouts" ON plan_workouts FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM training_plans tp
    WHERE tp.id = plan_workouts.plan_id
    AND (
      (public.is_admin() AND tp.source_plan_id IS NULL) OR
      (tp.user_id = auth.uid() AND tp.source_plan_id IS NOT NULL)
    )
  ));

-- ── Update workout_steps RLS ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can manage their workout steps" ON workout_steps;

DROP POLICY IF EXISTS "select workout steps" ON workout_steps;
CREATE POLICY "select workout steps" ON workout_steps FOR SELECT
  USING (
    (plan_workout_id IS NOT NULL AND plan_workout_id IN (
      SELECT pw.id FROM plan_workouts pw
      JOIN training_plans tp ON tp.id = pw.plan_id
      WHERE tp.source_plan_id IS NULL OR tp.user_id = auth.uid()
    )) OR
    (workout_id IS NOT NULL AND workout_id IN (
      SELECT w.id FROM workouts w WHERE w.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "insert workout steps" ON workout_steps;
CREATE POLICY "insert workout steps" ON workout_steps FOR INSERT
  WITH CHECK (
    (plan_workout_id IS NOT NULL AND plan_workout_id IN (
      SELECT pw.id FROM plan_workouts pw
      JOIN training_plans tp ON tp.id = pw.plan_id
      WHERE (public.is_admin() AND tp.source_plan_id IS NULL)
         OR (tp.user_id = auth.uid() AND tp.source_plan_id IS NOT NULL)
    )) OR
    (workout_id IS NOT NULL AND workout_id IN (
      SELECT w.id FROM workouts w WHERE w.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "update workout steps" ON workout_steps;
CREATE POLICY "update workout steps" ON workout_steps FOR UPDATE
  USING (
    (plan_workout_id IS NOT NULL AND plan_workout_id IN (
      SELECT pw.id FROM plan_workouts pw
      JOIN training_plans tp ON tp.id = pw.plan_id
      WHERE (public.is_admin() AND tp.source_plan_id IS NULL)
         OR (tp.user_id = auth.uid() AND tp.source_plan_id IS NOT NULL)
    )) OR
    (workout_id IS NOT NULL AND workout_id IN (
      SELECT w.id FROM workouts w WHERE w.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "delete workout steps" ON workout_steps;
CREATE POLICY "delete workout steps" ON workout_steps FOR DELETE
  USING (
    (plan_workout_id IS NOT NULL AND plan_workout_id IN (
      SELECT pw.id FROM plan_workouts pw
      JOIN training_plans tp ON tp.id = pw.plan_id
      WHERE (public.is_admin() AND tp.source_plan_id IS NULL)
         OR (tp.user_id = auth.uid() AND tp.source_plan_id IS NOT NULL)
    )) OR
    (workout_id IS NOT NULL AND workout_id IN (
      SELECT w.id FROM workouts w WHERE w.user_id = auth.uid()
    ))
  );
