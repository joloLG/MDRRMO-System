-- Migration: Allow public role-selection screen to read ER teams
BEGIN;

DROP POLICY IF EXISTS "Authenticated users can read ER teams" ON public.er_teams;

CREATE POLICY "Public can read ER teams"
ON public.er_teams
FOR SELECT
TO authenticated, anon
USING (true);

COMMIT;
