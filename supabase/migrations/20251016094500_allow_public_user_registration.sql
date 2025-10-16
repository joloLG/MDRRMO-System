-- Allow public user registration and supporting permissions

-- Ensure required helper functions are present (no-op if they already exist)
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

-- Create or replace policy that lets anon/authenticated insert default user profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Allow public user registration'
  ) THEN
    EXECUTE 'DROP POLICY "Allow public user registration" ON public.users';
  END IF;
END $$;

CREATE POLICY "Allow public user registration"
ON public.users
FOR INSERT
TO anon, authenticated
WITH CHECK (
  coalesce(user_type, 'user') = 'user'
  AND NOT EXISTS (
    SELECT 1 FROM public.users existing
    WHERE existing.email = email
  )
);

-- Ensure anon role can access the sequence/table for inserts
GRANT SELECT, INSERT ON public.users TO anon;


drop trigger if exists on_auth_user_created on auth.users;
drop function if exists auth.handle_new_user cascade;