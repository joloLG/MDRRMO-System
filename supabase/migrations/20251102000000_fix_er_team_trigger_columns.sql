-- Fix trigger to use unquoted column identifiers to match table schema
BEGIN;

DROP TRIGGER IF EXISTS trg_log_er_team_assignment ON public.emergency_reports;
DROP FUNCTION IF EXISTS public.log_er_team_assignment_notification();

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
      'reporter_first_name', NEW.firstname,
      'reporter_last_name', NEW.lastname,
      'incident_type', NEW.emergency_type,
      'reported_at', NEW.created_at,
      'responded_at', NEW.responded_at,
      'location_address', NEW.location_address
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_er_team_assignment
  AFTER INSERT OR UPDATE OF er_team_id
  ON public.emergency_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.log_er_team_assignment_notification();

COMMIT;
