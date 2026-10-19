-- Per-user preferences (one row per user). Separate from `profiles`, whose
-- updates are admin-only to protect `role`. First use: which band color the
-- user's own set of resistance bands has at each band level, as
-- { "<level 1-5>": "<color key>" } — brands color bands differently.
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  band_colors JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select own user_settings" ON public.user_settings;
CREATE POLICY "select own user_settings" ON public.user_settings
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert own user_settings" ON public.user_settings;
CREATE POLICY "insert own user_settings" ON public.user_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update own user_settings" ON public.user_settings;
CREATE POLICY "update own user_settings" ON public.user_settings
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete own user_settings" ON public.user_settings;
CREATE POLICY "delete own user_settings" ON public.user_settings
  FOR DELETE USING (user_id = auth.uid());
