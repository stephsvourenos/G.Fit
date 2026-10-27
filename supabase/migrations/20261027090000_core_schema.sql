-- =====================================================================
-- G.Fit core schema — households, profiles, catalogue, entitlements,
-- creators, ledger, audit. Row-Level Security is ON for every table.
--
-- Access model (enforced by the database, not just the app):
--   * Household owner (adult who signed up): their household, profiles,
--     activity and entitlement — nothing else.
--   * Staff (admin / content_editor / finance / support): only what their
--     role needs. Staff can NOT read child profiles or activity.
--   * Creators: their own creator record, contracts and ledger only.
--     Never any household, profile or viewer data.
--   * Server (service role): webhooks, royalty runs, payouts.
-- Money is stored as integer minor units (cents). Never floats.
-- =====================================================================

-- ---------- Types ----------------------------------------------------
create type public.age_band as enum ('under-6','6-8','9-12','13-15','16-17','adult');
create type public.intensity as enum ('gentle','moderate','energetic');
create type public.content_state as enum ('draft','uploaded','awaiting-review','approved','scheduled','published','archived');
create type public.staff_role as enum ('admin','content_editor','finance','support');
create type public.billing_provider as enum ('stripe','apple_iap','google_play','manual_grant','mock');
create type public.subscription_status as enum ('trialing','active','past_due','unpaid','canceled','incomplete','incomplete_expired','paused');
create type public.ledger_kind as enum ('royalty','referral','adjustment');
create type public.run_status as enum ('provisional','final');

-- ---------- Staff ----------------------------------------------------
create table public.staff_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.staff_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Helper: does the current user hold any of these staff roles?
create or replace function public.has_staff_role(roles public.staff_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff_members s
    where s.user_id = (select auth.uid()) and s.role = any(roles)
  );
$$;

-- ---------- Households & profiles -----------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  country text not null default 'AU' check (country ~ '^[A-Z]{2}$'),
  currency text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  max_profiles int not null default 6 check (max_profiles between 1 and 10),
  created_at timestamptz not null default now()
);

create or replace function public.my_household_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select h.id from public.households h where h.owner_user_id = (select auth.uid());
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 20),
  avatar_emoji text not null default '🦊' check (char_length(avatar_emoji) <= 8),
  avatar_colour text not null default '#FF5A36' check (avatar_colour ~ '^#[0-9A-Fa-f]{6}$'),
  age_band public.age_band not null,
  interests text[] not null default '{}',
  pin_protected boolean not null default false,
  max_intensity public.intensity,
  created_at timestamptz not null default now()
);
create index profiles_household_idx on public.profiles(household_id);
comment on table public.profiles is
  'Household member profiles. Children: nickname + age band + interests only. No DOB, email, photo or payment data by design.';

-- Adult profiles are always PIN protected; enforce the household profile cap.
create or replace function public.profiles_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cap int;
  n int;
begin
  if new.age_band = 'adult' then
    new.pin_protected := true;
  end if;
  if tg_op = 'INSERT' then
    select max_profiles into cap from public.households where id = new.household_id;
    select count(*) into n from public.profiles where household_id = new.household_id;
    if n >= cap then
      raise exception 'This household already has the maximum of % profiles', cap using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_before_write before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

-- Parent PIN: hashed with bcrypt, never readable by any client.
create table public.household_pins (
  household_id uuid primary key references public.households(id) on delete cascade,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.set_household_pin(new_pin text)
returns void language plpgsql security definer set search_path = '' as $$
declare hid uuid := public.my_household_id();
begin
  if hid is null then raise exception 'No household for this account' using errcode = 'insufficient_privilege'; end if;
  if new_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN must be 4 to 6 digits' using errcode = 'check_violation'; end if;
  insert into public.household_pins (household_id, pin_hash)
  values (hid, extensions.crypt(new_pin, extensions.gen_salt('bf', 10)))
  on conflict (household_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_at = now();
end;
$$;

-- Returns true/false; locks for 15 minutes after 5 wrong attempts.
create or replace function public.verify_household_pin(pin text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  hid uuid := public.my_household_id();
  rec public.household_pins%rowtype;
begin
  if hid is null then return false; end if;
  select * into rec from public.household_pins where household_id = hid for update;
  if not found then return false; end if;
  if rec.locked_until is not null and rec.locked_until > now() then
    raise exception 'Too many attempts. Try again after %', to_char(rec.locked_until at time zone 'Australia/Sydney', 'HH24:MI')
      using errcode = 'insufficient_privilege';
  end if;
  if rec.pin_hash = extensions.crypt(pin, rec.pin_hash) then
    update public.household_pins set failed_attempts = 0, locked_until = null where household_id = hid;
    return true;
  end if;
  update public.household_pins
    set failed_attempts = rec.failed_attempts + 1,
        locked_until = case when rec.failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
    where household_id = hid;
  return false;
end;
$$;

-- ---------- Creators & instructors ----------------------------------
create table public.creators (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  legal_name text not null,
  country text not null default 'AU',
  is_minor boolean not null default false,
  guardian_managed boolean not null default false,
  status text not null default 'active' check (status in ('active','paused','ended')),
  referral_code text unique check (referral_code ~ '^[A-Z0-9]{3,20}$'),
  created_at timestamptz not null default now(),
  constraint minor_needs_guardian check (not is_minor or guardian_managed)
);

-- Which login(s) may see a creator's portal (for minors: the guardian).
create table public.creator_users (
  creator_id uuid not null references public.creators(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (creator_id, user_id)
);

create or replace function public.is_creator_user(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.creator_users cu where cu.creator_id = cid and cu.user_id = (select auth.uid()));
$$;

create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id),
  display_name text not null,
  bio text not null default '',
  is_minor boolean not null default false,
  specialties text[] not null default '{}',
  accent text not null default '#FF5A36'
);

-- Versioned contracts: never edited, a change is a new version.
create table public.creator_contracts (
  contract_id text not null,
  version int not null check (version >= 1),
  creator_id uuid not null references public.creators(id),
  terms jsonb not null,
  effective_from date not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (contract_id, version)
);

-- ---------- Catalogue ------------------------------------------------
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  instructor_id uuid not null references public.instructors(id),
  creator_id uuid not null references public.creators(id),
  category text not null,
  duration_sec int not null check (duration_sec > 0),
  intensity public.intensity not null,
  equipment text[] not null default '{}',
  age_bands public.age_band[] not null check (cardinality(age_bands) > 0),
  captions boolean not null default false,
  accessibility_notes text,
  state public.content_state not null default 'draft',
  published_at timestamptz,
  rights_creator_licence_signed boolean not null default false,
  rights_music_cleared boolean not null default false,
  rights_safety_reviewed boolean not null default false,
  rights_guardian_consent boolean,          -- null = not applicable
  territories text[] not null default '{AU}',
  mux_asset_id text,
  mux_playback_id text,
  thumbnail jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Publishing gate, enforced in the database as well as the admin UI.
create or replace function public.workouts_publish_gate()
returns trigger language plpgsql set search_path = '' as $$
declare minor boolean;
begin
  if new.state in ('published','scheduled') then
    select i.is_minor into minor from public.instructors i where i.id = new.instructor_id;
    if not new.rights_creator_licence_signed then raise exception 'Cannot publish: creator licence not signed'; end if;
    if not new.rights_music_cleared then raise exception 'Cannot publish: music rights not cleared'; end if;
    if not new.rights_safety_reviewed then raise exception 'Cannot publish: safety review not completed'; end if;
    if minor and coalesce(new.rights_guardian_consent, false) = false then
      raise exception 'Cannot publish: guardian consent missing for a minor instructor';
    end if;
    if cardinality(new.territories) = 0 then raise exception 'Cannot publish: no licensed territories'; end if;
    if new.state = 'published' and new.published_at is null then new.published_at := now(); end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger workouts_publish_gate before insert or update on public.workouts
  for each row execute function public.workouts_publish_gate();

-- ---------- Member activity -----------------------------------------
create table public.favourites (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, workout_id)
);

create table public.watch_progress (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  position_sec int not null default 0 check (position_sec >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, workout_id)
);

create table public.completions (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  completed_on date not null default (now() at time zone 'Australia/Sydney')::date,
  created_at timestamptz not null default now()
);
create index completions_profile_idx on public.completions(profile_id, completed_on);

create or replace function public.owns_profile(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join public.households h on h.id = p.household_id
    where p.id = pid and h.owner_user_id = (select auth.uid())
  );
$$;

-- ---------- Billing (written by the server only) ---------------------
create table public.entitlements (
  household_id uuid primary key references public.households(id) on delete cascade,
  provider public.billing_provider not null,
  provider_customer_id text,
  provider_subscription_id text not null,
  status public.subscription_status not null,
  current_period_end timestamptz not null,
  grace_days int not null default 3,
  updated_at timestamptz not null default now()
);

create table public.billing_events (
  event_id text primary key,               -- provider event ID: makes webhooks idempotent
  provider public.billing_provider not null,
  type text not null,
  received_at timestamptz not null default now()
);

-- ---------- Creator ledger (append-only) -----------------------------
create table public.ledger_entries (
  id text primary key,
  creator_id uuid not null references public.creators(id),
  kind public.ledger_kind not null,
  amount_minor bigint not null,
  currency text not null default 'AUD',
  earning_month text not null check (earning_month ~ '^[0-9]{4}-[0-9]{2}$'),
  run_id text not null,
  run_status public.run_status not null,
  source_refs text[] not null default '{}',
  contract_ref text not null,
  memo text not null default '',
  reverses_entry_id text references public.ledger_entries(id),
  created_at timestamptz not null default now()
);
create index ledger_creator_idx on public.ledger_entries(creator_id, earning_month);

-- ---------- Audit log (append-only) ----------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_user_id uuid default auth.uid(),
  area text not null,
  action text not null,
  detail jsonb not null default '{}'
);

create or replace function public.forbid_modification()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only: % is not allowed (add an adjusting entry instead)', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;
create trigger ledger_append_only before update or delete on public.ledger_entries
  for each row execute function public.forbid_modification();
create trigger audit_append_only before update or delete on public.audit_log
  for each row execute function public.forbid_modification();
create trigger contracts_append_only before update or delete on public.creator_contracts
  for each row execute function public.forbid_modification();

-- ---------- Row-Level Security ---------------------------------------
alter table public.staff_members enable row level security;
alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.household_pins enable row level security;
alter table public.creators enable row level security;
alter table public.creator_users enable row level security;
alter table public.instructors enable row level security;
alter table public.creator_contracts enable row level security;
alter table public.workouts enable row level security;
alter table public.favourites enable row level security;
alter table public.watch_progress enable row level security;
alter table public.completions enable row level security;
alter table public.entitlements enable row level security;
alter table public.billing_events enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.audit_log enable row level security;

-- Staff: see own roles; admins manage roles.
create policy staff_read_own on public.staff_members for select to authenticated
  using (user_id = (select auth.uid()) or public.has_staff_role('{admin}'));
create policy staff_admin_write on public.staff_members for all to authenticated
  using (public.has_staff_role('{admin}')) with check (public.has_staff_role('{admin}'));

-- Households: owner only.
create policy household_owner_select on public.households for select to authenticated
  using (owner_user_id = (select auth.uid()));
create policy household_owner_insert on public.households for insert to authenticated
  with check (owner_user_id = (select auth.uid()));
create policy household_owner_update on public.households for update to authenticated
  using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy household_owner_delete on public.households for delete to authenticated
  using (owner_user_id = (select auth.uid()));
-- Owners may change country/currency only; max_profiles is a business setting.
revoke update on public.households from authenticated;
grant update (country, currency) on public.households to authenticated;

-- Profiles: household owner only (staff deliberately excluded).
create policy profiles_owner_all on public.profiles for all to authenticated
  using (household_id = public.my_household_id())
  with check (household_id = public.my_household_id());

-- PINs: no direct access at all; use set_household_pin / verify_household_pin.

-- Activity: through owned profiles only.
create policy favourites_owner on public.favourites for all to authenticated
  using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy progress_owner on public.watch_progress for all to authenticated
  using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy completions_owner on public.completions for all to authenticated
  using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));

-- Catalogue: members see published workouts; content staff manage everything.
create policy workouts_member_read on public.workouts for select to authenticated
  using (state = 'published' or public.has_staff_role('{admin,content_editor}'));
create policy workouts_staff_write on public.workouts for all to authenticated
  using (public.has_staff_role('{admin,content_editor}'))
  with check (public.has_staff_role('{admin,content_editor}'));
create policy instructors_read on public.instructors for select to authenticated using (true);
create policy instructors_staff_write on public.instructors for all to authenticated
  using (public.has_staff_role('{admin,content_editor}'))
  with check (public.has_staff_role('{admin,content_editor}'));

-- Creators: staff (admin/finance/content) and the creator's own login(s).
create policy creators_read on public.creators for select to authenticated
  using (public.has_staff_role('{admin,finance,content_editor}') or public.is_creator_user(id));
create policy creators_admin_write on public.creators for all to authenticated
  using (public.has_staff_role('{admin}')) with check (public.has_staff_role('{admin}'));
create policy creator_users_read on public.creator_users for select to authenticated
  using (user_id = (select auth.uid()) or public.has_staff_role('{admin}'));
create policy creator_users_admin on public.creator_users for all to authenticated
  using (public.has_staff_role('{admin}')) with check (public.has_staff_role('{admin}'));
create policy contracts_read on public.creator_contracts for select to authenticated
  using (public.has_staff_role('{admin,finance}') or public.is_creator_user(creator_id));
create policy contracts_admin_insert on public.creator_contracts for insert to authenticated
  with check (public.has_staff_role('{admin}'));

-- Entitlements: owner reads own; only the server writes.
create policy entitlements_owner_read on public.entitlements for select to authenticated
  using (household_id = public.my_household_id() or public.has_staff_role('{admin,support,finance}'));

-- Billing events: server only (no policies).

-- Ledger: creators read their own; finance/admin read all; server writes.
create policy ledger_read on public.ledger_entries for select to authenticated
  using (public.has_staff_role('{admin,finance}') or public.is_creator_user(creator_id));

-- Audit: admins read; writes via log_audit().
create policy audit_admin_read on public.audit_log for select to authenticated
  using (public.has_staff_role('{admin}'));

create or replace function public.log_audit(area text, action text, detail jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_user_id, area, action, detail) values ((select auth.uid()), area, action, detail);
$$;

-- ---------- Data export ----------------------------------------------
create or replace function public.export_my_household()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exported_at', now(),
    'household', to_jsonb(h) - 'owner_user_id',
    'profiles', coalesce((select jsonb_agg(to_jsonb(p)) from public.profiles p where p.household_id = h.id), '[]'),
    'favourites', coalesce((select jsonb_agg(to_jsonb(f)) from public.favourites f join public.profiles p on p.id = f.profile_id where p.household_id = h.id), '[]'),
    'watch_progress', coalesce((select jsonb_agg(to_jsonb(w)) from public.watch_progress w join public.profiles p on p.id = w.profile_id where p.household_id = h.id), '[]'),
    'completions', coalesce((select jsonb_agg(to_jsonb(c)) from public.completions c join public.profiles p on p.id = c.profile_id where p.household_id = h.id), '[]'),
    'membership', (select to_jsonb(e) - 'provider_customer_id' from public.entitlements e where e.household_id = h.id)
  )
  from public.households h where h.owner_user_id = (select auth.uid());
$$;

-- ---------- Function permissions --------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function public.set_household_pin(text) to authenticated;
grant execute on function public.verify_household_pin(text) to authenticated;
grant execute on function public.export_my_household() to authenticated;
grant execute on function public.my_household_id() to authenticated;
grant execute on function public.has_staff_role(public.staff_role[]) to authenticated;
grant execute on function public.owns_profile(uuid) to authenticated;
grant execute on function public.is_creator_user(uuid) to authenticated;
grant execute on function public.log_audit(text, text, jsonb) to authenticated;
-- Anonymous visitors get nothing from this schema.
revoke all on all tables in schema public from anon;
