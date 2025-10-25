-- Migration: Hospital patient status tracking and history
-- Date: 2025-10-25

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Extend internal_report_patients with status tracking columns
ALTER TABLE public.internal_report_patients
  ADD COLUMN IF NOT EXISTS current_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS current_status_notes TEXT,
  ADD COLUMN IF NOT EXISTS current_transfer_hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now());

-- Ensure existing rows have a pending status
UPDATE public.internal_report_patients
SET current_status = COALESCE(NULLIF(current_status, ''), 'pending')
WHERE current_status IS NULL OR current_status = '';

-- Helper trigger to keep status_updated_at fresh
CREATE OR REPLACE FUNCTION public.set_patient_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status_updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_internal_report_patients_status_timestamp ON public.internal_report_patients;
CREATE TRIGGER trg_internal_report_patients_status_timestamp
  BEFORE UPDATE OF current_status, current_status_notes, current_transfer_hospital_id
  ON public.internal_report_patients
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_patient_status_timestamp();

-- 2. Create patient status history table
CREATE TABLE IF NOT EXISTS public.patient_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_report_patient_id UUID NOT NULL REFERENCES public.internal_report_patients(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT,
  transfer_hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_status_history_status_check CHECK (
    status IN (
      'pending',
      'critical',
      'healthy',
      'discharged',
      'dead',
      'still_in_hospital',
      'on_recovery',
      'transferred'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_patient_status_history_patient_id
  ON public.patient_status_history (internal_report_patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_status_history_hospital_id
  ON public.patient_status_history (hospital_id);

CREATE INDEX IF NOT EXISTS idx_patient_status_history_created_at
  ON public.patient_status_history (created_at DESC);

-- 3. Enable RLS and policies for patient_status_history
ALTER TABLE public.patient_status_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'patient_status_history'
      AND policyname = 'Admins manage patient status history'
  ) THEN
    CREATE POLICY "Admins manage patient status history"
    ON public.patient_status_history
    FOR ALL
    USING (public.is_admin() OR public.is_superadmin())
    WITH CHECK (public.is_admin() OR public.is_superadmin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'patient_status_history'
      AND policyname = 'Hospital users manage own patient status history'
  ) THEN
    CREATE POLICY "Hospital users manage own patient status history"
    ON public.patient_status_history
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM public.internal_report_patients p
        WHERE p.id = patient_status_history.internal_report_patient_id
          AND p.receiving_hospital_id = public.current_hospital_id()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.internal_report_patients p
        WHERE p.id = patient_status_history.internal_report_patient_id
          AND p.receiving_hospital_id = public.current_hospital_id()
      )
    );
  END IF;
END $$;

GRANT SELECT, INSERT ON public.patient_status_history TO authenticated;

-- 4. Helper default history entry for existing patients
INSERT INTO public.patient_status_history (internal_report_patient_id, hospital_id, status)
SELECT
  p.id,
  p.receiving_hospital_id,
  'pending'
FROM public.internal_report_patients p
WHERE p.receiving_hospital_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.patient_status_history h
    WHERE h.internal_report_patient_id = p.id
  );
