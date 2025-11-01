-- Link ER team PCR drafts to the originating emergency report
BEGIN;

ALTER TABLE public.er_team_reports
  ADD COLUMN IF NOT EXISTS emergency_report_id uuid REFERENCES public.emergency_reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internal_report_id integer REFERENCES public.internal_reports(id) ON DELETE SET NULL;

-- Ensure one ER team PCR per emergency report
CREATE UNIQUE INDEX IF NOT EXISTS er_team_reports_emergency_report_unique
  ON public.er_team_reports (emergency_report_id)
  WHERE emergency_report_id IS NOT NULL;

-- Speed up lookups by emergency report
CREATE INDEX IF NOT EXISTS er_team_reports_emergency_report_idx
  ON public.er_team_reports (emergency_report_id);

-- Track linkage from internal reports back to the ER team PCR (optional, light-weight)
CREATE INDEX IF NOT EXISTS er_team_reports_internal_report_idx
  ON public.er_team_reports (internal_report_id);

COMMIT;
