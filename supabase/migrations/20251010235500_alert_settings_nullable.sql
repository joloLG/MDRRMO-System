ALTER TABLE public.alert_settings
  ALTER COLUMN active_file_path DROP NOT NULL,
  ALTER COLUMN admin_incident_sound_path DROP NOT NULL,
  ALTER COLUMN user_notification_sound_path DROP NOT NULL,
  ALTER COLUMN user_earthquake_sound_path DROP NOT NULL,
  ALTER COLUMN user_tsunami_sound_path DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL,
  ALTER COLUMN updated_at DROP NOT NULL;
