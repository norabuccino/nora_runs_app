-- Site content vs personal content, and plan-only library workouts.
--
-- "Site content" is whatever the site account (profiles.is_site_account —
-- admin@local.dev) owns. Everyone sees site exercises/workouts/plans; anything
-- another account creates (admins included) is personal to that account.
-- Admins can edit site content. Library workouts marked plan_only are only
-- used inside plans: regular users don't see them, admins do.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_site_account BOOLEAN NOT NULL DEFAULT false;
UPDATE public.profiles SET is_site_account = true
WHERE id IN (SELECT id FROM auth.users WHERE email = 'admin@local.dev');

ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS plan_only BOOLEAN NOT NULL DEFAULT false;

-- ── Helpers (SECURITY DEFINER so policies can read profiles/plans regardless of their RLS) ──

CREATE OR REPLACE FUNCTION public.is_site_user(uid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = uid AND is_site_account);
$$;

-- Lets the client tell site content from other users' public exercises.
CREATE OR REPLACE FUNCTION public.site_user_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM profiles WHERE is_site_account;
$$;
GRANT EXECUTE ON FUNCTION public.site_user_ids() TO authenticated;

-- Own plans (including personal copies) and site plans.
CREATE OR REPLACE FUNCTION public.can_view_plan(pid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM training_plans tp
    WHERE tp.id = pid
      AND (tp.user_id = auth.uid() OR (tp.source_plan_id IS NULL AND is_site_user(tp.user_id)))
  );
$$;

-- Own plans, and site plans for admins.
CREATE OR REPLACE FUNCTION public.can_edit_plan(pid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM training_plans tp
    WHERE tp.id = pid
      AND (tp.user_id = auth.uid() OR (is_admin() AND tp.source_plan_id IS NULL AND is_site_user(tp.user_id)))
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_edit_plan(UUID) TO authenticated;

-- Own workouts, and site workouts (plan-only ones for admins only).
CREATE OR REPLACE FUNCTION public.can_view_workout(wid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workouts w
    WHERE w.id = wid
      AND (w.user_id = auth.uid() OR (is_site_user(w.user_id) AND (NOT w.plan_only OR is_admin())))
  );
$$;

-- Own workouts, and site workouts for admins.
CREATE OR REPLACE FUNCTION public.can_edit_workout(wid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workouts w
    WHERE w.id = wid AND (w.user_id = auth.uid() OR (is_admin() AND is_site_user(w.user_id)))
  );
$$;

-- ── training_plans ──
DROP POLICY IF EXISTS "select plans" ON public.training_plans;
CREATE POLICY "select plans" ON public.training_plans
  FOR SELECT USING (user_id = auth.uid() OR (source_plan_id IS NULL AND public.is_site_user(user_id)));

DROP POLICY IF EXISTS "insert plans" ON public.training_plans;
CREATE POLICY "insert plans" ON public.training_plans
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update plans" ON public.training_plans;
CREATE POLICY "update plans" ON public.training_plans
  FOR UPDATE USING (public.can_edit_plan(id));

DROP POLICY IF EXISTS "delete plans" ON public.training_plans;
CREATE POLICY "delete plans" ON public.training_plans
  FOR DELETE USING (public.can_edit_plan(id));

-- ── plan_workouts ──
DROP POLICY IF EXISTS "select plan workouts" ON public.plan_workouts;
CREATE POLICY "select plan workouts" ON public.plan_workouts
  FOR SELECT USING (public.can_view_plan(plan_id));

DROP POLICY IF EXISTS "insert plan workouts" ON public.plan_workouts;
CREATE POLICY "insert plan workouts" ON public.plan_workouts
  FOR INSERT WITH CHECK (public.can_edit_plan(plan_id));

DROP POLICY IF EXISTS "update plan workouts" ON public.plan_workouts;
CREATE POLICY "update plan workouts" ON public.plan_workouts
  FOR UPDATE USING (public.can_edit_plan(plan_id));

DROP POLICY IF EXISTS "delete plan workouts" ON public.plan_workouts;
CREATE POLICY "delete plan workouts" ON public.plan_workouts
  FOR DELETE USING (public.can_edit_plan(plan_id));

-- ── plan_week_notes (was owner-only, so site plans' week purposes were hidden from users) ──
DROP POLICY IF EXISTS "Users manage their own plan week notes" ON public.plan_week_notes;
DROP POLICY IF EXISTS "select plan week notes" ON public.plan_week_notes;
CREATE POLICY "select plan week notes" ON public.plan_week_notes
  FOR SELECT USING (public.can_view_plan(plan_id));
DROP POLICY IF EXISTS "insert plan week notes" ON public.plan_week_notes;
CREATE POLICY "insert plan week notes" ON public.plan_week_notes
  FOR INSERT WITH CHECK (public.can_edit_plan(plan_id));
DROP POLICY IF EXISTS "update plan week notes" ON public.plan_week_notes;
CREATE POLICY "update plan week notes" ON public.plan_week_notes
  FOR UPDATE USING (public.can_edit_plan(plan_id));
DROP POLICY IF EXISTS "delete plan week notes" ON public.plan_week_notes;
CREATE POLICY "delete plan week notes" ON public.plan_week_notes
  FOR DELETE USING (public.can_edit_plan(plan_id));

-- ── workouts (library) ──
DROP POLICY IF EXISTS "Users manage their own workouts" ON public.workouts;
DROP POLICY IF EXISTS "select workouts" ON public.workouts;
CREATE POLICY "select workouts" ON public.workouts
  FOR SELECT USING (user_id = auth.uid() OR (public.is_site_user(user_id) AND (NOT plan_only OR public.is_admin())));
DROP POLICY IF EXISTS "insert workouts" ON public.workouts;
CREATE POLICY "insert workouts" ON public.workouts
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "update workouts" ON public.workouts;
CREATE POLICY "update workouts" ON public.workouts
  FOR UPDATE USING (public.can_edit_workout(id));
DROP POLICY IF EXISTS "delete workouts" ON public.workouts;
CREATE POLICY "delete workouts" ON public.workouts
  FOR DELETE USING (public.can_edit_workout(id));

-- ── workout_steps: follow whichever parent the step belongs to ──
DROP POLICY IF EXISTS "Users can manage their workout steps" ON public.workout_steps;

DROP POLICY IF EXISTS "select workout steps" ON public.workout_steps;
CREATE POLICY "select workout steps" ON public.workout_steps
  FOR SELECT USING (
    (plan_workout_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.plan_workouts pw WHERE pw.id = plan_workout_id AND public.can_view_plan(pw.plan_id)))
    OR (workout_id IS NOT NULL AND public.can_view_workout(workout_id))
    OR (scheduled_workout_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.scheduled_workouts sw WHERE sw.id = scheduled_workout_id AND sw.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "insert workout steps" ON public.workout_steps;
CREATE POLICY "insert workout steps" ON public.workout_steps
  FOR INSERT WITH CHECK (
    (plan_workout_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.plan_workouts pw WHERE pw.id = plan_workout_id AND public.can_edit_plan(pw.plan_id)))
    OR (workout_id IS NOT NULL AND public.can_edit_workout(workout_id))
    OR (scheduled_workout_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.scheduled_workouts sw WHERE sw.id = scheduled_workout_id AND sw.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "update workout steps" ON public.workout_steps;
CREATE POLICY "update workout steps" ON public.workout_steps
  FOR UPDATE USING (
    (plan_workout_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.plan_workouts pw WHERE pw.id = plan_workout_id AND public.can_edit_plan(pw.plan_id)))
    OR (workout_id IS NOT NULL AND public.can_edit_workout(workout_id))
    OR (scheduled_workout_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.scheduled_workouts sw WHERE sw.id = scheduled_workout_id AND sw.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "delete workout steps" ON public.workout_steps;
CREATE POLICY "delete workout steps" ON public.workout_steps
  FOR DELETE USING (
    (plan_workout_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.plan_workouts pw WHERE pw.id = plan_workout_id AND public.can_edit_plan(pw.plan_id)))
    OR (workout_id IS NOT NULL AND public.can_edit_workout(workout_id))
    OR (scheduled_workout_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.scheduled_workouts sw WHERE sw.id = scheduled_workout_id AND sw.user_id = auth.uid()))
  );

-- ── exercises: visibility unchanged; admins can also edit site exercises ──
DROP POLICY IF EXISTS "Users update own exercises" ON public.exercises;
CREATE POLICY "Users update own exercises" ON public.exercises
  FOR UPDATE USING (user_id = auth.uid() OR (public.is_admin() AND public.is_site_user(user_id)));

DROP POLICY IF EXISTS "Users delete own exercises" ON public.exercises;
CREATE POLICY "Users delete own exercises" ON public.exercises
  FOR DELETE USING (user_id = auth.uid() OR (public.is_admin() AND public.is_site_user(user_id)));
