-- Ensure private bucket for alert sounds exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('alert_sounds', 'alert_sounds', false)
ON CONFLICT (id) DO NOTHING;

-- NOTE: Storage policies on storage.objects must be created by the table owner.
-- Apply these once via the Supabase Dashboard (Storage > Policies) or SQL Editor:
--
-- Admins manage alert_sounds
-- CREATE POLICY "Admins manage alert_sounds" ON storage.objects
--   FOR ALL
--   USING (
--     bucket_id = 'alert_sounds'
--     AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type IN ('admin','superadmin'))
--   )
--   WITH CHECK (
--     bucket_id = 'alert_sounds'
--     AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type IN ('admin','superadmin'))
--   );
--
-- Authenticated read alert_sounds
-- CREATE POLICY "Authenticated read alert_sounds" ON storage.objects
--   FOR SELECT
--   USING (
--     bucket_id = 'alert_sounds' AND auth.role() = 'authenticated'
--   );
