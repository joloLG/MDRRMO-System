-- Safe migration for standalone_er_reports table
-- Uses IF NOT EXISTS to skip objects that already exist

-- Create table
CREATE TABLE IF NOT EXISTS standalone_er_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  er_team_id INTEGER NOT NULL REFERENCES er_teams(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_title TEXT NOT NULL,
  report_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Patient data (supports multiple patients)
  patient_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Incident data
  incident_type TEXT,
  incident_location TEXT,
  incident_payload JSONB DEFAULT '{}'::jsonb,
  
  -- Injury data
  injury_payload JSONB DEFAULT '{}'::jsonb,
  
  -- Additional notes
  notes TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('draft', 'pending_review', 'in_review', 'approved', 'rejected', 'archived')),
  
  -- Link to internal report if admin creates one from this
  internal_report_id INTEGER REFERENCES internal_reports(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Admin review notes
  review_notes TEXT
);

-- Create indexes (skip if they exist)
CREATE INDEX IF NOT EXISTS idx_standalone_er_reports_er_team ON standalone_er_reports(er_team_id);
CREATE INDEX IF NOT EXISTS idx_standalone_er_reports_submitted_by ON standalone_er_reports(submitted_by);
CREATE INDEX IF NOT EXISTS idx_standalone_er_reports_status ON standalone_er_reports(status);
CREATE INDEX IF NOT EXISTS idx_standalone_er_reports_created_at ON standalone_er_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_standalone_er_reports_report_date ON standalone_er_reports(report_date DESC);

-- Enable RLS
ALTER TABLE standalone_er_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "ER team members can view own team reports" ON standalone_er_reports;
DROP POLICY IF EXISTS "ER team members can create reports" ON standalone_er_reports;
DROP POLICY IF EXISTS "ER team members can update own drafts" ON standalone_er_reports;
DROP POLICY IF EXISTS "Admin can view all standalone reports" ON standalone_er_reports;
DROP POLICY IF EXISTS "Admin can update standalone reports" ON standalone_er_reports;

-- Policy: ER Team members can view reports from their own team
CREATE POLICY "ER team members can view own team reports"
ON standalone_er_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM er_team_users
    WHERE er_team_users.user_id = auth.uid()
    AND er_team_users.er_team_id = standalone_er_reports.er_team_id
  )
);

-- Policy: ER Team members can create reports for their team
CREATE POLICY "ER team members can create reports"
ON standalone_er_reports
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM er_team_users
    WHERE er_team_users.user_id = auth.uid()
    AND er_team_users.er_team_id = standalone_er_reports.er_team_id
  )
  AND submitted_by = auth.uid()
);

-- Policy: ER Team members can update their own drafts
CREATE POLICY "ER team members can update own drafts"
ON standalone_er_reports
FOR UPDATE
TO authenticated
USING (
  submitted_by = auth.uid()
  AND status IN ('draft', 'rejected')
)
WITH CHECK (
  submitted_by = auth.uid()
  AND status IN ('draft', 'pending_review', 'rejected')
);

-- Policy: Admin can view all standalone reports
CREATE POLICY "Admin can view all standalone reports"
ON standalone_er_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.user_type IN ('admin', 'superadmin')
  )
);

-- Policy: Admin can update any standalone report (review, approve, reject)
CREATE POLICY "Admin can update standalone reports"
ON standalone_er_reports
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.user_type IN ('admin', 'superadmin')
  )
);

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_standalone_er_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS standalone_er_reports_updated_at ON standalone_er_reports;
CREATE TRIGGER standalone_er_reports_updated_at
BEFORE UPDATE ON standalone_er_reports
FOR EACH ROW
EXECUTE FUNCTION update_standalone_er_reports_updated_at();

-- Add comments for documentation
COMMENT ON TABLE standalone_er_reports IS 'Standalone PCR reports submitted by ER Teams, independent of emergency_reports from public users';
COMMENT ON COLUMN standalone_er_reports.patient_payload IS 'Array of patient data matching ErTeamPatientPayload structure';
COMMENT ON COLUMN standalone_er_reports.incident_payload IS 'Full incident details including MOI/POI/TOI, NOI, signs/symptoms matching PCR form structure';
COMMENT ON COLUMN standalone_er_reports.injury_payload IS 'Injury map data for body diagrams';
COMMENT ON COLUMN standalone_er_reports.status IS 'Report status: draft, pending_review, in_review, approved, rejected, archived';

-- Verify table was created successfully
SELECT 'Migration completed successfully. Table standalone_er_reports is ready.' as status;
