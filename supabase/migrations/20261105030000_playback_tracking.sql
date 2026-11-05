-- Phase 2: server-side qualified playback.
-- A session is opened only when the server issues a signed video link.
-- Heartbeats are timestamped by the SERVER. A scheduled job turns them into
-- qualified minutes with the same rules as packages/domain/src/playback.ts.
-- Raw heartbeats are deleted after 90 days; only the aggregated minutes stay.
-- Profiles are referenced by ID only — no names or ages are stored here.

create table public.playback_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  creator_id uuid not null references public.creators(id),
  device_id text not null default 'unknown' check (char_length(device_id) <= 64),
  duration_sec int not null check (duration_sec > 0),
  accessibility_mode boolean not null default false,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz,
  evaluated_at timestamptz,
  distinct_watched_sec int,
  coverage numeric,
  qualifies boolean,
  credited_sec int,
  flags text[] not null default '{}'
);
create index playback_sessions_household_idx on public.playback_sessions(household_id, started_at);
create index playback_sessions_pending_idx on public.playback_sessions(last_heartbeat_at) where evaluated_at is null;

create table public.playback_heartbeats (
  session_id uuid not null references public.playback_sessions(id) on delete cascade,
  seq int not null check (seq >= 0),
  received_at timestamptz not null default now(),
  position_sec numeric not null check (position_sec >= 0),
  playing boolean not null,
  visible boolean not null,
  buffering boolean not null,
  playback_rate numeric not null default 1,
  primary key (session_id, seq)
);

create table public.qualified_views (
  session_id uuid primary key references public.playback_sessions(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  creator_id uuid not null references public.creators(id),
  day date not null,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  credited_sec int not null check (credited_sec > 0),
  policy_version text not null,
  computed_at timestamptz not null default now()
);
create index qualified_views_month_idx on public.qualified_views(month, creator_id);

create table public.playback_anomalies (
  id bigint generated always as identity primary key,
  session_id uuid references public.playback_sessions(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.playback_sessions enable row level security;
alter table public.playback_heartbeats enable row level security;
alter table public.qualified_views enable row level security;
alter table public.playback_anomalies enable row level security;

-- Staff (admin/finance) can review sessions and anomalies; families and creators cannot.
create policy sessions_staff_read on public.playback_sessions for select to authenticated
  using (private.has_staff_role('{admin,finance}'));
create policy anomalies_staff_read on public.playback_anomalies for select to authenticated
  using (private.has_staff_role('{admin,finance}'));
create policy qviews_staff_read on public.qualified_views for select to authenticated
  using (private.has_staff_role('{admin,finance}'));
-- Heartbeats: server only (no policies).

-- Creators see only aggregated minutes for their own workouts — never who watched.
create or replace function public.my_creator_minutes()
returns table (month text, workout_id uuid, households bigint, minutes numeric)
language sql stable security definer set search_path = '' as $$
  select q.month, q.workout_id, count(distinct q.household_id), round(sum(q.credited_sec) / 60.0, 1)
  from public.qualified_views q
  where private.is_creator_user(q.creator_id)
  group by q.month, q.workout_id
  order by q.month desc;
$$;
revoke execute on function public.my_creator_minutes() from public, anon;
grant execute on function public.my_creator_minutes() to authenticated;

-- Retention: raw heartbeats older than 90 days are deleted daily.
create or replace function private.purge_old_heartbeats()
returns int language sql security definer set search_path = '' as $$
  with d as (delete from public.playback_heartbeats where received_at < now() - interval '90 days' returning 1)
  select count(*)::int from d;
$$;
revoke execute on function private.purge_old_heartbeats() from public, anon, authenticated;
