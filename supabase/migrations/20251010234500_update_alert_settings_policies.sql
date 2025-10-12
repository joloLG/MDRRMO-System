-- Helper function to check if current auth uid is admin/superadmin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.user_type IN ('admin', 'superadmin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO public;

-- Refresh alert_settings policies
DROP POLICY IF EXISTS "alert_settings_admin_all" ON public.alert_settings;
DROP POLICY IF EXISTS "alert_settings_write_admins" ON public.alert_settings;
DROP POLICY IF EXISTS "alert_settings_update_admins" ON public.alert_settings;
DROP POLICY IF EXISTS "alert_settings_read_all_auth" ON public.alert_settings;

CREATE POLICY "alert_settings_select_authenticated" ON public.alert_settings
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "alert_settings_admin_all" ON public.alert_settings
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
