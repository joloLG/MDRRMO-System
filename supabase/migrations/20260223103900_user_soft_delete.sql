-- Migration: Add soft delete support for user accounts
-- This allows deleting accounts without affecting submitted data

-- Add deleted_at timestamp column
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Drop existing status constraint and recreate with 'deleted' option
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE public.users
ADD CONSTRAINT users_status_check 
CHECK (status IN ('active', 'pending_admin', 'pending_hospital', 'rejected', 'deleted'));

-- Create index for efficient filtering of deleted users
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at) 
WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- Function to soft delete a user (instead of hard delete)
CREATE OR REPLACE FUNCTION public.soft_delete_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Only superadmins can delete users
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only superadmins can delete users';
  END IF;

  -- Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Soft delete: mark as deleted instead of removing
  UPDATE public.users
  SET 
    status = 'deleted',
    deleted_at = timezone('utc', now()),
    -- Clear sensitive data but keep name for reference
    email = NULL,
    "mobileNumber" = NULL,
    username = NULL,
    birthday = NULL
  WHERE id = target_user_id
    AND status != 'deleted'; -- Prevent re-deleting

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found or already deleted';
  END IF;
END;
$$;

-- Function to check if a user is deleted (for login checks)
CREATE OR REPLACE FUNCTION public.is_user_deleted(check_user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = check_user_id
      AND u.status = 'deleted'
      AND u.deleted_at IS NOT NULL
  );
$$;

-- Update helper functions to exclude deleted users
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
      AND u.deleted_at IS NULL
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
      AND u.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_hospital_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.status = 'active'
      AND u.user_type = 'hospital'
      AND u.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_er_team()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.status = 'active'
      AND u.user_type = 'er_team'
      AND u.deleted_at IS NULL
  );
$$;

-- Update RLS policies to exclude deleted users

-- Drop and recreate users_select_all_authenticated to exclude deleted
DROP POLICY IF EXISTS users_select_all_authenticated ON public.users;
CREATE POLICY users_select_all_authenticated ON public.users
  FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    AND deleted_at IS NULL
    AND status != 'deleted'
  );

-- Drop and recreate users_select_admin to exclude deleted
DROP POLICY IF EXISTS users_select_admin ON public.users;
CREATE POLICY users_select_admin ON public.users
  FOR SELECT 
  USING (
    public.is_admin() 
    AND deleted_at IS NULL
    AND status != 'deleted'
  );

-- Drop and recreate users_select_own - allow users to see their own profile even if deleted
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Add policy to prevent deleted users from updating their profile
DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (
    auth.uid() = id 
    AND status != 'deleted'
    AND deleted_at IS NULL
  )
  WITH CHECK (
    auth.uid() = id 
    AND status != 'deleted'
    AND deleted_at IS NULL
  );

-- Grant execute on new function
GRANT EXECUTE ON FUNCTION public.soft_delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_deleted(UUID) TO authenticated, anon;

-- Add comment explaining soft delete behavior
COMMENT ON FUNCTION public.soft_delete_user(UUID) IS 
'Soft deletes a user account by marking it as deleted and clearing sensitive data. 
Submitted reports remain intact with the user_id reference preserved.
Only superadmins can delete users. Self-deletion is not allowed.';
