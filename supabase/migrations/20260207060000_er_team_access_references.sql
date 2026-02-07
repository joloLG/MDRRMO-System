-- Enable RLS on barangays and hospitals tables if not already enabled
ALTER TABLE barangays ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "ER team can read barangays" ON barangays;
DROP POLICY IF EXISTS "ER team can read hospitals" ON hospitals;
DROP POLICY IF EXISTS "Admin can read barangays" ON barangays;
DROP POLICY IF EXISTS "Admin can read hospitals" ON hospitals;
DROP POLICY IF EXISTS "Public users can read barangays" ON barangays;
DROP POLICY IF EXISTS "Public users can read hospitals" ON hospitals;

-- Create policy for ER team to read barangays
CREATE POLICY "ER team can read barangays"
ON barangays
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.user_type = 'er_team'
  )
);

-- Create policy for ER team to read hospitals
CREATE POLICY "ER team can read hospitals"
ON hospitals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.user_type = 'er_team'
  )
);

-- Create policy for Admin to read barangays
CREATE POLICY "Admin can read barangays"
ON barangays
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.user_type = 'admin'
  )
);

-- Create policy for Admin to read hospitals
CREATE POLICY "Admin can read hospitals"
ON hospitals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.user_type = 'admin'
  )
);

-- Create policy for public users to read barangays (for incident reporting)
CREATE POLICY "Public users can read barangays"
ON barangays
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.user_type = 'public_user'
  )
);

-- Create policy for public users to read hospitals (for incident reporting)
CREATE POLICY "Public users can read hospitals"
ON hospitals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.user_type = 'public_user'
  )
);

-- Comment on policies
COMMENT ON POLICY "ER team can read barangays" ON barangays IS 'Allows ER team members to read all barangays for incident location selection';
COMMENT ON POLICY "ER team can read hospitals" ON hospitals IS 'Allows ER team members to read all hospitals for receiving hospital selection';
COMMENT ON POLICY "Admin can read barangays" ON barangays IS 'Allows admin users to read all barangays';
COMMENT ON POLICY "Admin can read hospitals" ON hospitals IS 'Allows admin users to read all hospitals';
COMMENT ON POLICY "Public users can read barangays" ON barangays IS 'Allows public users to read all barangays for incident reporting';
COMMENT ON POLICY "Public users can read hospitals" ON hospitals IS 'Allows public users to read all hospitals for incident reporting';
