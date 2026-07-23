-- app_settings previously had a single FOR ALL policy restricted to admins,
-- which blocked SELECT for everyone else. Badge colors (stored here) are read
-- on every page load via the root layout for all users, admin or not, so the
-- read needs to be open while writes stay admin-only.
DROP POLICY IF EXISTS "admins_can_manage_app_settings" ON app_settings;

DROP POLICY IF EXISTS "anyone_can_read_app_settings" ON app_settings;
CREATE POLICY "anyone_can_read_app_settings"
  ON app_settings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "admins_can_write_app_settings" ON app_settings;
CREATE POLICY "admins_can_write_app_settings"
  ON app_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "admins_can_update_app_settings" ON app_settings;
CREATE POLICY "admins_can_update_app_settings"
  ON app_settings
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "admins_can_delete_app_settings" ON app_settings;
CREATE POLICY "admins_can_delete_app_settings"
  ON app_settings
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
