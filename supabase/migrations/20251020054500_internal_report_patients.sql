-- Migration: Create patient records table linked to internal reports and hospitals
-- Date: 2025-10-20

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Patient records table per internal report entry
CREATE TABLE IF NOT EXISTS public.internal_report_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_report_id INT NOT NULL REFERENCES public.internal_reports(id) ON DELETE CASCADE,
  receiving_hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_contact_number TEXT,
  patient_birthday DATE,
  patient_age INT,
  patient_address TEXT,
  patient_sex TEXT,
  evacuation_priority TEXT,
  emergency_category TEXT,
  airway_interventions TEXT,
  breathing_support TEXT,
  circulation_status TEXT,
  body_parts_front TEXT,
  body_parts_back TEXT,
  injury_types TEXT,
  incident_location TEXT,
  moi_poi_toi TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_internal_report_patients_internal_report_id
  ON public.internal_report_patients (internal_report_id);

CREATE INDEX IF NOT EXISTS idx_internal_report_patients_receiving_hospital_id
  ON public.internal_report_patients (receiving_hospital_id);

-- 2. Updated-at trigger (shared helper)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_internal_report_patients_updated ON public.internal_report_patients;
CREATE TRIGGER on_internal_report_patients_updated
  BEFORE UPDATE ON public.internal_report_patients
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- 3. Optional backfill from existing single-patient columns (only when data exists)
INSERT INTO public.internal_report_patients (
  internal_report_id,
  receiving_hospital_id,
  patient_name,
  patient_contact_number,
  patient_birthday,
  patient_age,
  patient_address,
  patient_sex,
  evacuation_priority,
  emergency_category,
  airway_interventions,
  breathing_support,
  circulation_status,
  body_parts_front,
  body_parts_back,
  injury_types,
  incident_location,
  moi_poi_toi,
  created_at,
  updated_at
)
SELECT
  ir.id,
  ir.receiving_hospital_id,
  ir.patient_name,
  ir.patient_contact_number,
  ir.patient_birthday,
  ir.patient_age,
  ir.patient_address,
  ir.patient_sex,
  ir.evacuation_priority,
  ir.emergency_category,
  ir.airway_interventions,
  ir.breathing_support,
  ir.circulation_status,
  ir.body_parts_front,
  ir.body_parts_back,
  ir.injury_types,
  ir.incident_location,
  ir.moi_poi_toi,
  COALESCE(ir.created_at, timezone('utc', now())),
  timezone('utc', now())
FROM public.internal_reports ir
WHERE ir.patient_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.internal_report_patients irp
    WHERE irp.internal_report_id = ir.id
  );

-- 4. Enable RLS for patient table
ALTER TABLE public.internal_report_patients ENABLE ROW LEVEL SECURITY;

-- 5. Policies for admin access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'internal_report_patients'
      AND policyname = 'Admins manage internal report patients'
  ) THEN
    CREATE POLICY "Admins manage internal report patients"
    ON public.internal_report_patients
    FOR ALL
    USING (public.is_admin() OR public.is_superadmin())
    WITH CHECK (public.is_admin() OR public.is_superadmin());
  END IF;
END $$;

-- 6. Policy for hospital users to read their patients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'internal_report_patients'
      AND policyname = 'Hospital users read their patients'
  ) THEN
    CREATE POLICY "Hospital users read their patients"
    ON public.internal_report_patients
    FOR SELECT
    USING (
      receiving_hospital_id IS NOT NULL
      AND receiving_hospital_id = public.current_hospital_id()
    );
  END IF;
END $$;

-- 7. Policy to allow hospital users to insert/update their patient records (optional, restricted scope)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'internal_report_patients'
      AND policyname = 'Hospital users maintain their patients'
  ) THEN
    CREATE POLICY "Hospital users maintain their patients"
    ON public.internal_report_patients
    FOR INSERT
    WITH CHECK (
      receiving_hospital_id IS NOT NULL
      AND receiving_hospital_id = public.current_hospital_id()
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'internal_report_patients'
      AND policyname = 'Hospital users update their patients'
  ) THEN
    CREATE POLICY "Hospital users update their patients"
    ON public.internal_report_patients
    FOR UPDATE
    USING (
      receiving_hospital_id IS NOT NULL
      AND receiving_hospital_id = public.current_hospital_id()
    )
    WITH CHECK (
      receiving_hospital_id IS NOT NULL
      AND receiving_hospital_id = public.current_hospital_id()
    );
  END IF;
END $$;

-- 8. Permissions
GRANT SELECT, INSERT, UPDATE ON public.internal_report_patients TO authenticated;
