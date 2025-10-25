-- Migration: Add user approval system for admin and hospital account requests
-- Add approval status and requested role fields to users table

-- Add status field to track approval state
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
CHECK (status IN ('active', 'pending_admin', 'pending_hospital', 'rejected'));

-- Add requested_role field to track what role was requested during registration
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS requested_role TEXT;

-- Create admin approval requests table for tracking and audit
CREATE TABLE IF NOT EXISTS public.admin_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('admin', 'hospital')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Update foreign key constraints to reference public.users if table already exists
ALTER TABLE public.admin_approval_requests DROP CONSTRAINT IF EXISTS admin_approval_requests_user_id_fkey;
ALTER TABLE public.admin_approval_requests ADD CONSTRAINT admin_approval_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.admin_approval_requests DROP CONSTRAINT IF EXISTS admin_approval_requests_reviewed_by_fkey;
ALTER TABLE public.admin_approval_requests ADD CONSTRAINT admin_approval_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_approval_requests_user_id ON public.admin_approval_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_approval_requests_status ON public.admin_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_admin_approval_requests_requested_at ON public.admin_approval_requests(requested_at);

-- Enable RLS
ALTER TABLE public.admin_approval_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_approval_requests
DO $$
BEGIN
    -- Super admins can do everything
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_approval_requests' 
        AND policyname = 'Super admins manage approval requests'
    ) THEN
        CREATE POLICY "Super admins manage approval requests"
        ON public.admin_approval_requests
        FOR ALL
        USING (public.is_superadmin())
        WITH CHECK (public.is_superadmin());
    END IF;

    -- Users can read their own requests
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_approval_requests' 
        AND policyname = 'Users read own approval requests'
    ) THEN
        CREATE POLICY "Users read own approval requests"
        ON public.admin_approval_requests
        FOR SELECT
        USING (user_id = auth.uid());
    END IF;

    -- Users can create their own approval requests during registration
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_approval_requests' 
        AND policyname = 'Users submit own approval requests'
    ) THEN
        CREATE POLICY "Users submit own approval requests"
        ON public.admin_approval_requests
        FOR INSERT
        TO anon, authenticated
        WITH CHECK (
          (auth.uid() IS NOT NULL AND user_id = auth.uid())
          OR
          (auth.uid() IS NULL AND EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = user_id
              AND u.requested_role = requested_role
              AND u.status IN ('pending_admin', 'pending_hospital')
          ))
        );
    END IF;
END $$;

-- Update helper functions to consider approval status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.status = 'active'
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
      AND u.status = 'active'
      AND u.user_type = 'superadmin'
  );
$$;

-- Update user registration policy to handle pending approvals
DROP POLICY IF EXISTS "Allow public user registration" ON public.users;
CREATE POLICY "Allow public user registration"
ON public.users
FOR INSERT
TO anon, authenticated
WITH CHECK (
  CASE
    WHEN coalesce(user_type, 'user') = 'user' THEN status IN ('active', 'pending_hospital')
    WHEN user_type IN ('admin', 'superadmin') THEN status IN ('pending_admin', 'active')
    ELSE false
  END
  AND NOT EXISTS (
    SELECT 1 FROM public.users existing
    WHERE existing.email = email
  )
);

-- Add specific role fields for hospital and ER team selection
ALTER TABLE public.admin_approval_requests
ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES public.hospitals(id);

-- Add ER team reference to admin_approval_requests (references existing er_teams table)
ALTER TABLE public.admin_approval_requests
ADD COLUMN IF NOT EXISTS er_team_id INTEGER REFERENCES public.er_teams(id);
