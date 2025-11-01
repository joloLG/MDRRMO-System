-- Migration: Extend user role support for ER teams
BEGIN;

-- Allow ER team as a valid user_type
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_user_type_check;

ALTER TABLE public.users
ADD CONSTRAINT users_user_type_check
CHECK (user_type IN ('superadmin', 'admin', 'hospital', 'er_team', 'user'));

-- Allow pending_er_team as a valid status for onboarding
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE public.users
ADD CONSTRAINT users_status_check
CHECK (status IN ('active', 'pending_admin', 'pending_hospital', 'pending_er_team', 'rejected'));

-- Allow ER team requests in approval workflow
ALTER TABLE public.admin_approval_requests
DROP CONSTRAINT IF EXISTS admin_approval_requests_requested_role_check;

ALTER TABLE public.admin_approval_requests
ADD CONSTRAINT admin_approval_requests_requested_role_check
CHECK (requested_role IN ('admin', 'hospital', 'er_team'));

-- Refresh public registration policy to account for ER teams
DROP POLICY IF EXISTS "Allow public user registration" ON public.users;

CREATE POLICY "Allow public user registration"
ON public.users
FOR INSERT
TO anon, authenticated
WITH CHECK (
  CASE
    WHEN coalesce(user_type, 'user') = 'user' THEN status IN ('active', 'pending_hospital')
    WHEN user_type IN ('admin', 'superadmin') THEN status IN ('pending_admin', 'active')
    WHEN user_type = 'er_team' THEN status IN ('pending_er_team', 'active')
    ELSE false
  END
  AND NOT EXISTS (
    SELECT 1 FROM public.users existing
    WHERE existing.email = email
  )
);

COMMIT;
