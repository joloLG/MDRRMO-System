-- Create alert_sounds table to manage active notification sounds
CREATE TABLE IF NOT EXISTS public.alert_sounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alert_sounds ENABLE ROW LEVEL SECURITY;

-- Policies for alert_sounds
CREATE POLICY "Admins manage alert_sounds" ON public.alert_sounds
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND user_type IN ('admin', 'superadmin')
    )
  );

-- Insert default sound
INSERT INTO public.alert_sounds (file_path, name, is_active)
VALUES ('alert.mp3', 'Default Alert Sound', true)
ON CONFLICT (file_path) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS alert_sounds_is_active_idx ON public.alert_sounds (is_active);
CREATE INDEX IF NOT EXISTS alert_sounds_file_path_idx ON public.alert_sounds (file_path);
