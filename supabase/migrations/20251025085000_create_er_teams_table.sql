-- Migration: Create ER Teams table for emergency response team selection
-- This creates the er_teams table referenced throughout the application

CREATE TABLE IF NOT EXISTS public.er_teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.er_teams ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users to read ER teams
CREATE POLICY "Authenticated users can read ER teams"
ON public.er_teams
FOR SELECT
TO authenticated
USING (true);

-- Insert default ER teams
INSERT INTO public.er_teams (name) VALUES
('Team Alpha'),
('Team Charlie'),
('Team Bravo')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions
GRANT SELECT ON public.er_teams TO anon;
