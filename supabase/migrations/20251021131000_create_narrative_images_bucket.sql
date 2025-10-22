-- Migration: Ensure storage bucket for narrative report images
-- Date: 2025-10-21

INSERT INTO storage.buckets (id, name, public)
VALUES ('narrative-images', 'narrative-images', true)
ON CONFLICT (id) DO NOTHING;

-- NOTE: Storage policies on storage.objects must be created by the bucket owner via Supabase dashboard or SQL.
-- Suggested policies:
-- 1. Admins manage narrative images
-- CREATE POLICY "Admins manage narrative images" ON storage.objects
--   FOR ALL
--   USING (
--     bucket_id = 'narrative-images'
--     AND (public.is_admin() OR public.is_superadmin())
--   )
--   WITH CHECK (
--     bucket_id = 'narrative-images'
--     AND (public.is_admin() OR public.is_superadmin())
--   );
--
-- 2. Authenticated read published images (optional)
-- CREATE POLICY "Authenticated read narrative images" ON storage.objects
--   FOR SELECT
--   USING (
--     bucket_id = 'narrative-images'
--     AND auth.role() = 'authenticated'
--   );

-- Remember to update Content Security Policy (see next.config.js) to allow loading images from
-- https://*.supabase.co when using this bucket.
