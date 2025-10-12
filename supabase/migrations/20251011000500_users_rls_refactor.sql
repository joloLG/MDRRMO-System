-- Helper functions (security definer) so policies remain simple
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.user_type IN ('admin','superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.user_type = 'superadmin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO public;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO public;

-- Drop legacy policies that caused recursion or overlaps
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users;', pol.policyname);
  END LOOP;
END $$;

-- Base policies
CREATE POLICY users_select_all_authenticated ON public.users
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY users_select_admin ON public.users
  FOR SELECT USING (public.is_admin());

CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY users_insert_self_profile ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY users_update_admin ON public.users
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY users_delete_superadmin ON public.users
  FOR DELETE
  USING (public.is_superadmin());

CREATE POLICY users_insert_superadmin ON public.users
  FOR INSERT
  WITH CHECK (public.is_superadmin());
