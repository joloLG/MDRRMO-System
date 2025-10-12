-- Create alert_settings table if not exists with multiple sound categories
CREATE TABLE IF NOT EXISTS public.alert_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Legacy fallback (kept for backward compatibility)
    active_file_path TEXT,
    -- New sound categories
    admin_incident_sound_path TEXT,
    user_notification_sound_path TEXT,
    user_earthquake_sound_path TEXT,
    user_tsunami_sound_path TEXT,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if table already existed previously
ALTER TABLE public.alert_settings ADD COLUMN IF NOT EXISTS active_file_path TEXT;
ALTER TABLE public.alert_settings ADD COLUMN IF NOT EXISTS admin_incident_sound_path TEXT;
ALTER TABLE public.alert_settings ADD COLUMN IF NOT EXISTS user_notification_sound_path TEXT;
ALTER TABLE public.alert_settings ADD COLUMN IF NOT EXISTS user_earthquake_sound_path TEXT;
ALTER TABLE public.alert_settings ADD COLUMN IF NOT EXISTS user_tsunami_sound_path TEXT;
ALTER TABLE public.alert_settings ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.alert_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies: allow all authenticated users to read (for client playback),
-- but only admins/superadmins can write
DROP POLICY IF EXISTS "alert_settings_read_all_auth" ON public.alert_settings;
CREATE POLICY "alert_settings_read_all_auth" ON public.alert_settings
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "alert_settings_write_admins" ON public.alert_settings;
CREATE POLICY "alert_settings_write_admins" ON public.alert_settings
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type IN ('admin','superadmin'))
    );

DROP POLICY IF EXISTS "alert_settings_update_admins" ON public.alert_settings;
CREATE POLICY "alert_settings_update_admins" ON public.alert_settings
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type IN ('admin','superadmin'))
    );

-- Ensure updated_at trigger function exists (shared)
CREATE OR REPLACE FUNCTION public.handle_updated_at() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_alert_settings_updated ON public.alert_settings;
CREATE TRIGGER on_alert_settings_updated
    BEFORE UPDATE ON public.alert_settings
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Broadcast alerts table for Earthquake/Tsunami
CREATE TABLE IF NOT EXISTS public.broadcast_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('earthquake','tsunami')),
    title TEXT,
    body TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.broadcast_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcast_alerts_read_all_auth" ON public.broadcast_alerts;
CREATE POLICY "broadcast_alerts_read_all_auth" ON public.broadcast_alerts
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "broadcast_alerts_insert_admins" ON public.broadcast_alerts;
CREATE POLICY "broadcast_alerts_insert_admins" ON public.broadcast_alerts
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type IN ('admin','superadmin'))
    );

-- Helpful index
CREATE INDEX IF NOT EXISTS broadcast_alerts_created_at_idx ON public.broadcast_alerts(created_at DESC);
