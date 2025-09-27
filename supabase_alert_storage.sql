-- Supabase Storage and RLS for Alert Sounds
-- Run these statements in the Supabase SQL editor

-- 1) Create a private storage bucket for alert sounds (mp3/wav only via RLS)
DO $$
BEGIN
  PERFORM 1 FROM storage.buckets WHERE id = 'alert_sounds';
  IF NOT FOUND THEN
    PERFORM storage.create_bucket('alert_sounds', FALSE);
  END IF;
END$$;

-- 2) RLS note
-- storage.objects already has RLS enabled by default on Supabase-managed projects.
-- Skipping ALTER TABLE here because it requires table ownership.

-- 3) Policies for alert_sounds bucket
--    We reuse the existing is_admin() helper from supabase_rls_policies.sql

-- Allow admins to list/read objects in the alert_sounds bucket
CREATE POLICY "alert_sounds_admin_read"
ON storage.objects
FOR SELECT
USING (
  public.is_admin() AND bucket_id = 'alert_sounds'
);

-- Allow admins to upload (INSERT) objects with .mp3 or .wav extensions only
CREATE POLICY "alert_sounds_admin_upload_mp3_wav"
ON storage.objects
FOR INSERT
WITH CHECK (
  public.is_admin() AND bucket_id = 'alert_sounds' AND name ~* '\\.(mp3|wav)$'
);

-- Allow admins to update objects in the bucket
CREATE POLICY "alert_sounds_admin_update"
ON storage.objects
FOR UPDATE
USING (
  public.is_admin() AND bucket_id = 'alert_sounds'
)
WITH CHECK (
  public.is_admin() AND bucket_id = 'alert_sounds'
);

-- Allow admins to delete objects in the bucket
CREATE POLICY "alert_sounds_admin_delete"
ON storage.objects
FOR DELETE
USING (
  public.is_admin() AND bucket_id = 'alert_sounds'
);

-- Allow admins to read bucket metadata (optional but recommended)
CREATE POLICY "alert_sounds_bucket_admin_read"
ON storage.buckets
FOR SELECT
USING (public.is_admin());


-- 4) Create a singleton table to hold the currently active alert sound
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid

CREATE TABLE IF NOT EXISTS public.alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_file_path TEXT NOT NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only allow a single row in alert_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'single_row_alert_settings'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX single_row_alert_settings ON public.alert_settings ((true));';
  END IF;
END$$;

ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;

-- Admins full access to alert_settings
DROP POLICY IF EXISTS "alert_settings_admin_all" ON public.alert_settings;
CREATE POLICY "alert_settings_admin_all"
ON public.alert_settings
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());
