-- Migration: Create narrative_reports table for admin draft and published narratives
-- Date: 2025-10-21

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Optional status ENUM for narrative lifecycle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'narrative_report_status'
  ) THEN
    CREATE TYPE narrative_report_status AS ENUM ('draft', 'published', 'archived');
  END IF;
END $$;

-- 2. Narrative reports table
CREATE TABLE IF NOT EXISTS public.narrative_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_report_id INT REFERENCES public.internal_reports(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Narrative Report',
  narrative_text TEXT NOT NULL,
  image_url TEXT,
  status narrative_report_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  search_document tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(narrative_text, '')), 'B')
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_narrative_reports_status ON public.narrative_reports (status);
CREATE INDEX IF NOT EXISTS idx_narrative_reports_published_at ON public.narrative_reports (published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_narrative_reports_search ON public.narrative_reports USING GIN (search_document);

-- 3. Updated-at trigger reuse
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_narrative_reports_updated ON public.narrative_reports;
CREATE TRIGGER on_narrative_reports_updated
  BEFORE UPDATE ON public.narrative_reports
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- 4. Enable RLS and policies
ALTER TABLE public.narrative_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'narrative_reports'
      AND policyname = 'Admins manage narrative reports'
  ) THEN
    CREATE POLICY "Admins manage narrative reports"
    ON public.narrative_reports
    FOR ALL
    USING (public.is_admin() OR public.is_superadmin())
    WITH CHECK (public.is_admin() OR public.is_superadmin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'narrative_reports'
      AND policyname = 'Published narratives are readable'
  ) THEN
    CREATE POLICY "Published narratives are readable"
    ON public.narrative_reports
    FOR SELECT
    USING (status = 'published');
  END IF;
END $$;

-- 5. Grant read access for authenticated users
GRANT SELECT ON public.narrative_reports TO authenticated;
