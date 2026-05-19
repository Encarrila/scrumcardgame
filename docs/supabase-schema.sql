create table if not exists game_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null check (status in ('draft', 'active', 'paused', 'finished')),
  total_sprints integer not null default 2,
  catalog_version text not null default '2026-rrhh',
  teacher_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions(id) on delete cascade,
  name text not null,
  team_code text not null unique,
  state jsonb,
  state_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  display_name text not null,
  participant_token_hash text not null,
  turn_order integer not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists game_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  participant_id uuid references participants(id) on delete set null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
