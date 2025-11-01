-- Create ER team user assignment table
create table if not exists public.er_team_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  er_team_id integer not null references public.er_teams(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.er_team_users
  add constraint er_team_users_user_id_unique unique (user_id);

alter table public.er_team_users enable row level security;

drop policy if exists "Users can view their ER team mapping" on public.er_team_users;
create policy "Users can view their ER team mapping"
  on public.er_team_users
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users cannot insert ER team mapping" on public.er_team_users;
create policy "Users cannot insert ER team mapping"
  on public.er_team_users
  for insert
  with check (false);

-- The insert policy above prevents direct inserts from client apps.
-- Administrative flows use the service role (bypasses RLS) to manage assignments.

-- Create ER team reports table
create table if not exists public.er_team_reports (
  id uuid primary key default gen_random_uuid(),
  er_team_id integer not null references public.er_teams(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending_review' check (status in ('draft', 'pending_review', 'in_review', 'approved', 'rejected')),
  patient_payload jsonb not null,
  incident_payload jsonb,
  injury_payload jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz
);

create index if not exists er_team_reports_er_team_status_idx on public.er_team_reports (er_team_id, status);
create index if not exists er_team_reports_submitted_idx on public.er_team_reports (submitted_by);

create or replace function public.set_er_team_reports_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_er_team_reports_updated_at on public.er_team_reports;
create trigger trg_er_team_reports_updated_at
  before update on public.er_team_reports
  for each row
  execute function public.set_er_team_reports_updated_at();

alter table public.er_team_reports enable row level security;

drop policy if exists "ER team members can manage their drafts" on public.er_team_reports;
create policy "ER team members can manage their drafts"
  on public.er_team_reports
  for all
  using (
    auth.uid() = submitted_by
  )
  with check (
    auth.uid() = submitted_by
  );

drop policy if exists "Service role can manage ER team reports" on public.er_team_reports;
create policy "Service role can manage ER team reports"
  on public.er_team_reports
  for all
  using (
    auth.role() = 'service_role'
  )
  with check (
    auth.role() = 'service_role'
  );
