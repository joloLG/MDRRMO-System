-- Migration: Expand internal_report_patients with detailed assessment fields
-- Date: 2025-10-27

ALTER TABLE public.internal_report_patients
  ADD COLUMN IF NOT EXISTS noi TEXT,
  ADD COLUMN IF NOT EXISTS signs_symptoms TEXT,
  ADD COLUMN IF NOT EXISTS gcs_eye SMALLINT,
  ADD COLUMN IF NOT EXISTS gcs_verbal SMALLINT,
  ADD COLUMN IF NOT EXISTS gcs_motor SMALLINT,
  ADD COLUMN IF NOT EXISTS gcs_total SMALLINT,
  ADD COLUMN IF NOT EXISTS gcs_other TEXT,
  ADD COLUMN IF NOT EXISTS loc_avpu TEXT,
  ADD COLUMN IF NOT EXISTS pulse_rate TEXT,
  ADD COLUMN IF NOT EXISTS blood_pressure TEXT,
  ADD COLUMN IF NOT EXISTS bpm TEXT,
  ADD COLUMN IF NOT EXISTS oxygen_saturation TEXT,
  ADD COLUMN IF NOT EXISTS pain_scale TEXT,
  ADD COLUMN IF NOT EXISTS temperature TEXT,
  ADD COLUMN IF NOT EXISTS respiratory_rate TEXT,
  ADD COLUMN IF NOT EXISTS blood_loss_level TEXT CHECK (blood_loss_level IN ('Major', 'Minor', 'None') OR blood_loss_level IS NULL),
  ADD COLUMN IF NOT EXISTS estimated_blood_loss NUMERIC;
