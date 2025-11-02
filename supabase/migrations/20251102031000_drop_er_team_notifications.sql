-- Drop the er_team_notifications table as we'll use emergency_reports directly for ER team notifications

BEGIN;

-- Drop the triggers first
DROP TRIGGER IF EXISTS trg_log_er_team_assignment ON public.emergency_reports;
DROP TRIGGER IF EXISTS trg_log_er_team_report_status ON public.er_team_reports;

-- Drop the functions
DROP FUNCTION IF EXISTS public.log_er_team_assignment_notification();
DROP FUNCTION IF EXISTS public.log_er_team_report_status_notification();
DROP FUNCTION IF EXISTS public.is_er_team_member(integer);

-- Drop the table
DROP TABLE IF EXISTS public.er_team_notifications;

-- Drop the enum type if it exists
DROP TYPE IF EXISTS public.er_team_notification_type;

COMMIT;
