-- Migration: Add divisions field to narrative_reports table
-- Date: 2025-10-24

ALTER TABLE public.narrative_reports
ADD COLUMN IF NOT EXISTS divisions TEXT[] DEFAULT '{}';

-- Update search document (keeping original without divisions since array_to_string is not IMMUTABLE)
DROP INDEX IF EXISTS idx_narrative_reports_search;
CREATE INDEX idx_narrative_reports_search ON public.narrative_reports USING GIN (
  to_tsvector('english',
    coalesce(title, '') || ' ' || coalesce(narrative_text, '')
  )
);
