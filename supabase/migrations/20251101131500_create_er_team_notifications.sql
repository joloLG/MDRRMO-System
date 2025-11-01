BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'er_team_notification_type') THEN
    CREATE TYPE public.er_team_notification_type AS ENUM ('assignment', 'status_change');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.er_team_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_report_id uuid NOT NULL REFERENCES public.emergency_reports(id) ON DELETE CASCADE,
  er_team_id integer NOT NULL REFERENCES public.er_teams(id) ON DELETE CASCADE,
  er_team_report_id uuid REFERENCES public.er_team_reports(id) ON DELETE SET NULL,
  event_type public.er_team_notification_type NOT NULL,
  old_status text,
  new_status text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS er_team_notifications_team_created_idx
  ON public.er_team_notifications (er_team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS er_team_notifications_event_idx
  ON public.er_team_notifications (event_type);

CREATE OR REPLACE FUNCTION public.is_er_team_member(team_id integer)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.er_team_users
    WHERE er_team_users.user_id = auth.uid()
      AND er_team_users.er_team_id = team_id
  );
$$;

ALTER TABLE public.er_team_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage ER team notifications" ON public.er_team_notifications;
CREATE POLICY "Service role can manage ER team notifications"
  ON public.er_team_notifications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "ER team members can view notifications" ON public.er_team_notifications;
CREATE POLICY "ER team members can view notifications"
  ON public.er_team_notifications
  FOR SELECT
  USING (auth.role() = 'service_role' OR public.is_er_team_member(er_team_id));

CREATE OR REPLACE FUNCTION public.log_er_team_assignment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_team integer;
  actor uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    previous_team := NULL;
  ELSE
    previous_team := OLD.er_team_id;
  END IF;

  IF NEW.er_team_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.er_team_id IS NOT DISTINCT FROM previous_team THEN
    RETURN NEW;
  END IF;

  actor := auth.uid();

  INSERT INTO public.er_team_notifications (
    emergency_report_id,
    er_team_id,
    event_type,
    created_by,
    payload
  ) VALUES (
    NEW.id,
    NEW.er_team_id,
    'assignment',
    actor,
    jsonb_build_object(
      'previous_er_team_id', previous_team,
      'reporter_first_name', NEW."firstName",
      'reporter_last_name', NEW."lastName",
      'incident_type', NEW.emergency_type,
      'reported_at', NEW.created_at,
      'responded_at', NEW.responded_at,
      'location_address', NEW.location_address
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_er_team_assignment ON public.emergency_reports;
CREATE TRIGGER trg_log_er_team_assignment
  AFTER INSERT OR UPDATE OF er_team_id
  ON public.emergency_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.log_er_team_assignment_notification();

CREATE OR REPLACE FUNCTION public.log_er_team_report_status_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('in_review', 'approved') THEN
    RETURN NEW;
  END IF;

  actor := auth.uid();

  INSERT INTO public.er_team_notifications (
    emergency_report_id,
    er_team_report_id,
    er_team_id,
    event_type,
    old_status,
    new_status,
    created_by
  ) VALUES (
    NEW.emergency_report_id,
    NEW.id,
    NEW.er_team_id,
    'status_change',
    OLD.status,
    NEW.status,
    actor
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_er_team_report_status ON public.er_team_reports;
CREATE TRIGGER trg_log_er_team_report_status
  AFTER UPDATE OF status
  ON public.er_team_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.log_er_team_report_status_notification();

COMMIT;
