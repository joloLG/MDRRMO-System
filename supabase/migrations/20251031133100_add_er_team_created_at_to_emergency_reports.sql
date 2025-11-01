-- Add er_team_created_at column to track when an ER team assignment was created
alter table public.emergency_reports
  add column if not exists er_team_created_at timestamptz;

-- Backfill existing records using the responded_at timestamp when available
update public.emergency_reports
set er_team_created_at = coalesce(er_team_created_at, responded_at)
where er_team_created_at is null
  and responded_at is not null;
