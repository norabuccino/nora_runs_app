-- Deleting plans: owners delete their own, admins also site plans (can_edit_plan).
-- Who follows a plan lives in user_plans, which RLS hides from everyone but its owner,
-- so the usage count and the delete itself run as SECURITY DEFINER, gated on can_edit_plan.

-- How a plan is used, for the delete warning: other people following it, whether the
-- caller follows it, and personal copies made from it (copies survive a delete).
CREATE OR REPLACE FUNCTION public.plan_usage(pid UUID)
RETURNS TABLE (followers INT, following_self BOOLEAN, copies INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(DISTINCT up.user_id)::int FROM user_plans up WHERE up.plan_id = pid AND up.user_id <> auth.uid()),
    EXISTS (SELECT 1 FROM user_plans up WHERE up.plan_id = pid AND up.user_id = auth.uid()),
    (SELECT count(*)::int FROM training_plans tp WHERE tp.source_plan_id = pid)
  WHERE public.can_edit_plan(pid);
$$;
GRANT EXECUTE ON FUNCTION public.plan_usage(UUID) TO authenticated;

-- Deletes a plan, first removing everyone's assignments to it (user_plans has no cascade).
-- That also removes their completion logs; their workouts/sessions go with plan_workouts.
-- Only admins may remove other people's assignments.
CREATE OR REPLACE FUNCTION public.delete_plan(pid UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_edit_plan(pid) THEN
    RAISE EXCEPTION 'You can''t delete this plan.';
  END IF;
  IF NOT public.is_admin() AND EXISTS (SELECT 1 FROM user_plans WHERE plan_id = pid AND user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Other people are following this plan.';
  END IF;
  DELETE FROM user_plans WHERE plan_id = pid;
  DELETE FROM training_plans WHERE id = pid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_plan(UUID) TO authenticated;
