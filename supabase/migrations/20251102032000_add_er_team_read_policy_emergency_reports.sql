-- Add policy for ER teams to read assigned emergency reports
-- This allows ER team members to view incidents assigned to their team

CREATE POLICY "ER team can read assigned emergency reports" ON public.emergency_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.er_team_users etu
      WHERE etu.user_id = auth.uid()
      AND etu.er_team_id = er_team_id
    )
  );
