-- Migration: Add hospital accounts support and associated RLS policies
-- Note: Ensure pgcrypto extension is available for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Hospitals lookup table
CREATE TABLE IF NOT EXISTS public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Seed predefined hospitals if they do not already exist
INSERT INTO public.hospitals (name)
SELECT hospital_name
FROM (VALUES
  ('Bulan Medicare Hospital / Pawa Hospital'),
  ('SMMG - Bulan'),
  ('Sorsogon Provincial Hospital'),
  ('SMMG-HSC (SorDoc)'),
  ('Irosin District Hospital'),
  ('Irosin General Hospital / IMAC')
) AS seeds(hospital_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.hospitals h WHERE h.name = seeds.hospital_name
);

-- 2. Link internal reports to hospitals via foreign key
ALTER TABLE public.internal_reports
  ADD COLUMN IF NOT EXISTS receiving_hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_internal_reports_receiving_hospital_id
  ON public.internal_reports (receiving_hospital_id);

-- 3. Backfill receiving_hospital_id from existing textual data
UPDATE public.internal_reports ir
SET receiving_hospital_id = h.id
FROM public.hospitals h
WHERE ir.receiving_hospital_name IS NOT NULL
  AND receiving_hospital_id IS NULL
  AND (
    lower(trim(ir.receiving_hospital_name)) = lower(trim(h.name))
    OR lower(trim(ir.receiving_hospital_name)) IN (
      'bulan medicare hospital',
      'pawa hospital',
      'smmg bulan',
      'sorsogon provincial hospital',
      'smmg-hsc',
      'smmg hsc',
      'sordoc',
      'irosin district hospital',
      'irosin general hospital',
      'imac'
    )
    AND lower(trim(h.name)) LIKE lower(trim(ir.receiving_hospital_name)) || '%'
  );

-- 4. Hospital user mapping
CREATE TABLE IF NOT EXISTS public.hospital_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_hospital_users_hospital_id
  ON public.hospital_users (hospital_id);

-- 5. Helper function to resolve current hospital id for RLS
CREATE OR REPLACE FUNCTION public.current_hospital_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT hu.hospital_id
  FROM public.hospital_users hu
  WHERE hu.user_id = auth.uid()
  LIMIT 1;
$$;

-- 6. Enable RLS on new tables (if not already enabled)
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_reports ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for hospitals table
-- Allow hospital users to read their own hospital record
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hospitals'
      AND policyname = 'Hospital users can read their hospital'
  ) THEN
    CREATE POLICY "Hospital users can read their hospital"
    ON public.hospitals
    FOR SELECT
    USING (id = public.current_hospital_id());
  END IF;
END $$;

-- Allow admins and superadmins to manage hospitals (reuse existing helper if available)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hospitals'
      AND policyname = 'Admins manage hospitals'
  ) THEN
    CREATE POLICY "Admins manage hospitals"
    ON public.hospitals
    FOR ALL
    USING (public.is_admin() OR public.is_superadmin())
    WITH CHECK (public.is_admin() OR public.is_superadmin());
  END IF;
END $$;

-- 8. RLS policies for hospital_users mapping
-- Allow admins/superadmins full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hospital_users'
      AND policyname = 'Admins manage hospital users'
  ) THEN
    CREATE POLICY "Admins manage hospital users"
    ON public.hospital_users
    FOR ALL
    USING (public.is_admin() OR public.is_superadmin())
    WITH CHECK (public.is_admin() OR public.is_superadmin());
  END IF;
END $$;

-- Allow hospital users to read their own mapping
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hospital_users'
      AND policyname = 'Hospital users read own mapping'
  ) THEN
    CREATE POLICY "Hospital users read own mapping"
    ON public.hospital_users
    FOR SELECT
    USING (user_id = auth.uid());
  END IF;
END $$;

-- 9. RLS policy to allow hospital users to read their patient transfers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'internal_reports'
      AND policyname = 'Hospital users read their transferred patients'
  ) THEN
    CREATE POLICY "Hospital users read their transferred patients"
    ON public.internal_reports
    FOR SELECT
    USING (
      receiving_hospital_id IS NOT NULL
      AND receiving_hospital_id = public.current_hospital_id()
    );
  END IF;
END $$;

-- Note: Existing admin/superadmin policies on internal_reports should continue to apply.
-- Ensure grants for authenticated users cover the new tables as needed.
GRANT SELECT ON public.hospitals TO authenticated;
GRANT SELECT ON public.hospital_users TO authenticated;
