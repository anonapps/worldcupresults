create extension if not exists pgcrypto;

create type public.match_stage as enum (
  'group',
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final'
);

create type public.match_status as enum (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

create type public.match_source_type as enum (
  'manual',
  'rule_generated',
  'sync'
);

create type public.simulation_mode as enum (
  'official',
  'what_if',
  'manual_override'
);

create type public.sync_run_status as enum (
  'running',
  'succeeded',
  'failed'
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  fifa_code text not null unique check (fifa_code ~ '^[A-Z]{3}$'),
  name_es text not null,
  flag_url text not null,
  confederation text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_rule_versions (
  id uuid primary key default gen_random_uuid(),
  version_name text not null unique,
  effective_from timestamptz not null,
  description text not null,
  rules_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  tournament_rule_version_id uuid not null references public.tournament_rule_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (tournament_rule_version_id, group_name)
);

create table if not exists public.group_team_assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  seed_order smallint not null check (seed_order > 0),
  unique (group_id, team_id),
  unique (group_id, seed_order)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_rule_version_id uuid not null references public.tournament_rule_versions(id) on delete restrict,
  stage public.match_stage not null,
  group_id uuid references public.groups(id) on delete set null,
  home_team_id uuid not null references public.teams(id) on delete restrict,
  away_team_id uuid not null references public.teams(id) on delete restrict,
  scheduled_at timestamptz not null,
  status public.match_status not null default 'scheduled',
  source_type public.match_source_type not null,
  source_reference text,
  winner_team_id uuid references public.teams(id) on delete restrict,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  check (winner_team_id is null or winner_team_id in (home_team_id, away_team_id)),
  check ((stage = 'group' and group_id is not null) or (stage <> 'group'))
);

create table if not exists public.standings (
  id uuid primary key default gen_random_uuid(),
  tournament_rule_version_id uuid not null references public.tournament_rule_versions(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  points integer not null default 0 check (points >= 0),
  wins integer not null default 0 check (wins >= 0),
  draws integer not null default 0 check (draws >= 0),
  losses integer not null default 0 check (losses >= 0),
  position smallint not null check (position > 0),
  is_provisional boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (tournament_rule_version_id, group_id, team_id)
);

create table if not exists public.simulation_snapshots (
  id uuid primary key default gen_random_uuid(),
  public_snapshot_id text not null unique,
  tournament_rule_version_id uuid not null references public.tournament_rule_versions(id) on delete restrict,
  mode public.simulation_mode not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  check (char_length(public_snapshot_id) >= 16)
);

create table if not exists public.tie_resolution_decisions (
  id uuid primary key default gen_random_uuid(),
  simulation_snapshot_id uuid not null references public.simulation_snapshots(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete restrict,
  higher_ranked_team_id uuid not null references public.teams(id) on delete restrict,
  lower_ranked_team_id uuid not null references public.teams(id) on delete restrict,
  decided_at timestamptz not null default now(),
  check (higher_ranked_team_id <> lower_ranked_team_id)
);

create table if not exists public.simulation_snapshot_matches (
  id uuid primary key default gen_random_uuid(),
  simulation_snapshot_id uuid not null references public.simulation_snapshots(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete restrict,
  selected_outcome text not null,
  selected_winner_team_id uuid references public.teams(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (simulation_snapshot_id, match_id)
);

create table if not exists public.sync_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null unique,
  trust_rank smallint not null check (trust_rank > 0),
  is_active boolean not null default true
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sync_sources(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status public.sync_run_status not null,
  details jsonb not null default '{}'::jsonb,
  check (completed_at is null or completed_at >= started_at)
);

create index if not exists idx_teams_confederation on public.teams (confederation);
create index if not exists idx_groups_rule_version on public.groups (tournament_rule_version_id);
create index if not exists idx_assignments_group on public.group_team_assignments (group_id);
create index if not exists idx_assignments_team on public.group_team_assignments (team_id);
create index if not exists idx_matches_rule_stage on public.matches (tournament_rule_version_id, stage);
create index if not exists idx_matches_group on public.matches (group_id);
create index if not exists idx_matches_scheduled_at on public.matches (scheduled_at);
create index if not exists idx_standings_lookup on public.standings (tournament_rule_version_id, group_id, position);
create index if not exists idx_snapshots_rule_created on public.simulation_snapshots (tournament_rule_version_id, created_at desc);
create index if not exists idx_snapshot_matches_snapshot on public.simulation_snapshot_matches (simulation_snapshot_id);
create index if not exists idx_tie_decisions_snapshot on public.tie_resolution_decisions (simulation_snapshot_id);
create index if not exists idx_sync_runs_source_started on public.sync_runs (source_id, started_at desc);

alter table public.teams enable row level security;
alter table public.tournament_rule_versions enable row level security;
alter table public.groups enable row level security;
alter table public.group_team_assignments enable row level security;
alter table public.matches enable row level security;
alter table public.standings enable row level security;
alter table public.simulation_snapshots enable row level security;
alter table public.simulation_snapshot_matches enable row level security;
alter table public.tie_resolution_decisions enable row level security;
alter table public.sync_sources enable row level security;
alter table public.sync_runs enable row level security;

create policy "Public read teams" on public.teams for select to anon using (true);
create policy "Public read tournament_rule_versions" on public.tournament_rule_versions for select to anon using (true);
create policy "Public read groups" on public.groups for select to anon using (true);
create policy "Public read group_team_assignments" on public.group_team_assignments for select to anon using (true);
create policy "Public read matches" on public.matches for select to anon using (true);
create policy "Public read standings" on public.standings for select to anon using (true);
create policy "Public read simulation_snapshots" on public.simulation_snapshots for select to anon using (true);
create policy "Public read simulation_snapshot_matches" on public.simulation_snapshot_matches for select to anon using (true);
create policy "Public read tie_resolution_decisions" on public.tie_resolution_decisions for select to anon using (true);

comment on table public.simulation_snapshots is 'Immutable snapshot rows. Treat as append-only from application layer.';
