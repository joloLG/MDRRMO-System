-- Migration: add turnover in charge column to internal_report_patients
-- Date: 2025-10-21

ALTER TABLE public.internal_report_patients
  ADD COLUMN IF NOT EXISTS turnover_in_charge TEXT;
