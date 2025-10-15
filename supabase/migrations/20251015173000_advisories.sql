-- Advisories table for admin-posted advisories with expiration
CREATE TABLE IF NOT EXISTS public.advisories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset TEXT,
  title TEXT,
  body TEXT,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.advisories ENABLE ROW LEVEL SECURITY;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.handle_advisories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_advisories_updated ON public.advisories;
CREATE TRIGGER on_advisories_updated
  BEFORE UPDATE ON public.advisories
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_advisories_updated_at();

-- Policies
-- Authenticated users may select only active advisories (not expired)
DROP POLICY IF EXISTS "advisories_select_active_auth" ON public.advisories;
CREATE POLICY "advisories_select_active_auth" ON public.advisories
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (expires_at IS NULL OR expires_at > NOW())
  );

-- Admins can read all advisories
DROP POLICY IF EXISTS "advisories_select_admins_all" ON public.advisories;
CREATE POLICY "advisories_select_admins_all" ON public.advisories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type IN ('admin','superadmin')
    )
  );

-- Admins can insert
DROP POLICY IF EXISTS "advisories_insert_admins" ON public.advisories;
CREATE POLICY "advisories_insert_admins" ON public.advisories
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type IN ('admin','superadmin')
    )
  );

-- Admins can update
DROP POLICY IF EXISTS "advisories_update_admins" ON public.advisories;
CREATE POLICY "advisories_update_admins" ON public.advisories
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type IN ('admin','superadmin')
    )
  );

-- Admins can delete
DROP POLICY IF EXISTS "advisories_delete_admins" ON public.advisories;
CREATE POLICY "advisories_delete_admins" ON public.advisories
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type IN ('admin','superadmin')
    )
  );

-- Helpful indices
CREATE INDEX IF NOT EXISTS advisories_expires_at_idx ON public.advisories(expires_at DESC);
CREATE INDEX IF NOT EXISTS advisories_created_at_idx ON public.advisories(created_at DESC);
