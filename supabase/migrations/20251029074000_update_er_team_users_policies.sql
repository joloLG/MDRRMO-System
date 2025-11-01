-- Migration: Allow super admins to manage ER team assignments
BEGIN;

-- Ensure we start from a clean slate of policies
DROP POLICY IF EXISTS "Users can view their ER team mapping" ON public.er_team_users;
DROP POLICY IF EXISTS "Users cannot insert ER team mapping" ON public.er_team_users;
DROP POLICY IF EXISTS "Super admins manage ER team assignments" ON public.er_team_users;
DROP POLICY IF EXISTS "Admins manage ER team assignments" ON public.er_team_users;

-- Users can read their own mapping (for ER dashboard usage)
CREATE POLICY "Users can view their ER team mapping"
ON public.er_team_users
FOR SELECT
USING (auth.uid() = user_id);

-- Super admins can fully manage mappings
CREATE POLICY "Super admins manage ER team assignments"
ON public.er_team_users
FOR ALL
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());

COMMIT;
