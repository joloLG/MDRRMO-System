-- Create emergency_reports table if it doesn't exist
-- This table stores user-submitted emergency reports

CREATE TABLE IF NOT EXISTS public.emergency_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firstName text,
  middleName text,
  lastName text,
  mobileNumber text,
  latitude double precision,
  longitude double precision,
  location_address text,
  emergency_type text NOT NULL,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  reportedAt timestamptz,
  reporterMobile text,
  casualties integer,
  er_team_id integer REFERENCES public.er_teams(id),
  er_team_created_at timestamptz,
  responded_at timestamptz,
  resolved_at timestamptz,
  admin_response text
);

-- Add missing columns if they don't exist
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS firstName text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS middleName text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS lastName text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS mobileNumber text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS location_address text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS emergency_type text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS reportedAt timestamptz;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS reporterMobile text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS casualties integer;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS er_team_id integer REFERENCES public.er_teams(id);
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS er_team_created_at timestamptz;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS admin_response text;

-- Drop existing policies if they exist to allow column alterations
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'emergency_reports' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.emergency_reports';
  END LOOP;
END $$;

-- Drop trigger that depends on er_team_id
DROP TRIGGER IF EXISTS trg_log_er_team_assignment ON public.emergency_reports;
DROP FUNCTION IF EXISTS public.log_er_team_assignment_notification();

-- Fix column types if the table already exists with wrong types
ALTER TABLE public.emergency_reports ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.emergency_reports ALTER COLUMN latitude TYPE double precision USING latitude::double precision;
ALTER TABLE public.emergency_reports ALTER COLUMN longitude TYPE double precision USING longitude::double precision;
ALTER TABLE public.emergency_reports ALTER COLUMN casualties TYPE integer USING casualties::integer;
ALTER TABLE public.emergency_reports ALTER COLUMN er_team_id DROP DEFAULT;
ALTER TABLE public.emergency_reports ALTER COLUMN er_team_id TYPE integer USING CASE WHEN er_team_id = '' THEN NULL ELSE er_team_id::integer END;
ALTER TABLE public.emergency_reports ALTER COLUMN created_at TYPE timestamptz USING created_at::timestamptz;
ALTER TABLE public.emergency_reports ALTER COLUMN "reportedAt" TYPE timestamptz USING "reportedAt"::timestamptz;
ALTER TABLE public.emergency_reports ALTER COLUMN er_team_created_at TYPE timestamptz USING er_team_created_at::timestamptz;
ALTER TABLE public.emergency_reports ALTER COLUMN responded_at TYPE timestamptz USING responded_at::timestamptz;
ALTER TABLE public.emergency_reports ALTER COLUMN resolved_at TYPE timestamptz USING resolved_at::timestamptz;

-- Recreate the trigger after column alterations
CREATE OR REPLACE FUNCTION public.log_er_team_assignment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_team integer;
  actor uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    previous_team := NULL;
  ELSE
    previous_team := OLD.er_team_id;
  END IF;

  IF NEW.er_team_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.er_team_id IS NOT DISTINCT FROM previous_team THEN
    RETURN NEW;
  END IF;

  actor := auth.uid();

  INSERT INTO public.er_team_notifications (
    emergency_report_id,
    er_team_id,
    event_type,
    created_by,
    payload
  ) VALUES (
    NEW.id,
    NEW.er_team_id,
    'assignment',
    actor,
    jsonb_build_object(
      'previous_er_team_id', previous_team,
      'reporter_first_name', NEW.firstname,
      'reporter_last_name', NEW.lastname,
      'incident_type', NEW.emergency_type,
      'reported_at', NEW.created_at,
      'responded_at', NEW.responded_at,
      'location_address', NEW.location_address
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_er_team_assignment
  AFTER INSERT OR UPDATE OF er_team_id
  ON public.emergency_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.log_er_team_assignment_notification();

-- Enable RLS
ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;

-- Policies for emergency_reports
-- Allow authenticated users to insert their own reports
CREATE POLICY "Users can insert their own emergency reports" ON public.emergency_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow admins to read all reports
CREATE POLICY "Admins can read all emergency reports" ON public.emergency_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND user_type IN ('admin', 'superadmin')
    )
  );

-- Allow users to read their own reports
CREATE POLICY "Users can read their own emergency reports" ON public.emergency_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Allow admins to update reports
CREATE POLICY "Admins can update emergency reports" ON public.emergency_reports
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND user_type IN ('admin', 'superadmin')
    )
  );

-- Allow ER team members to update assigned reports
CREATE POLICY "ER team can update assigned reports" ON public.emergency_reports
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.er_team_users etu
      WHERE etu.user_id = auth.uid()
      AND etu.er_team_id = er_team_id
    )
  );

-- Indexes for performance
DROP INDEX IF EXISTS emergency_reports_user_id_idx;
DROP INDEX IF EXISTS emergency_reports_status_idx;
DROP INDEX IF EXISTS emergency_reports_emergency_type_idx;
DROP INDEX IF EXISTS emergency_reports_er_team_id_idx;
DROP INDEX IF EXISTS emergency_reports_created_at_idx;

CREATE INDEX emergency_reports_user_id_idx ON public.emergency_reports (user_id);
CREATE INDEX emergency_reports_status_idx ON public.emergency_reports (status);
CREATE INDEX emergency_reports_emergency_type_idx ON public.emergency_reports (emergency_type);
CREATE INDEX emergency_reports_er_team_id_idx ON public.emergency_reports (er_team_id);
CREATE INDEX emergency_reports_created_at_idx ON public.emergency_reports (created_at DESC);
