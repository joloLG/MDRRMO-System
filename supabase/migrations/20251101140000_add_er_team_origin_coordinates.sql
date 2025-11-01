BEGIN;

ALTER TABLE public.er_team_notifications
  ADD COLUMN IF NOT EXISTS origin_latitude double precision,
  ADD COLUMN IF NOT EXISTS origin_longitude double precision;

ALTER TABLE public.er_teams
  ADD COLUMN IF NOT EXISTS base_latitude double precision,
  ADD COLUMN IF NOT EXISTS base_longitude double precision;

-- Restore original trigger implementations (without coordinate lookups) to avoid impacting report inserts
DROP TRIGGER IF EXISTS trg_log_er_team_assignment ON public.emergency_reports;
DROP TRIGGER IF EXISTS trg_log_er_team_report_status ON public.er_team_reports;
DROP FUNCTION IF EXISTS public.log_er_team_assignment_notification();
DROP FUNCTION IF EXISTS public.log_er_team_report_status_notification();

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

CREATE TRIGGER trg_log_er_team_assignment
  AFTER INSERT OR UPDATE OF er_team_id
  ON public.emergency_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.log_er_team_assignment_notification();

CREATE TRIGGER trg_log_er_team_report_status
  AFTER UPDATE OF status
  ON public.er_team_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.log_er_team_report_status_notification();

COMMIT;
