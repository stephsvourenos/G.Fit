-- Phase 2: video. Mux holds the files; we keep IDs and status.
alter table public.workouts
  add column if not exists mux_upload_id text,
  add column if not exists video_status text not null default 'none'
    check (video_status in ('none','waiting','processing','ready','errored')),
  add column if not exists video_duration_sec numeric,
  add column if not exists video_error text;

-- Every Mux webhook delivery is recorded once, so a repeat delivery is ignored.
create table if not exists public.mux_events (
  event_id text primary key,
  type text not null,
  object_id text,
  received_at timestamptz not null default now()
);
alter table public.mux_events enable row level security; -- server only, no policies

-- Parent PIN unlock is remembered on the server for 10 minutes, so the server
-- (not just the app) can require it before playing videos on adult profiles.
alter table public.household_pins add column if not exists unlocked_until timestamptz;

create or replace function public.verify_household_pin(pin text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  hid uuid := private.my_household_id();
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
    update public.household_pins
      set failed_attempts = 0, locked_until = null, unlocked_until = now() + interval '10 minutes'
      where household_id = hid;
    return true;
  end if;
  update public.household_pins
    set failed_attempts = rec.failed_attempts + 1,
        locked_until = case when rec.failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end,
        unlocked_until = null
    where household_id = hid;
  return false;
end;
$$;

-- Switching to a child profile (or "Lock & exit") ends the parent unlock early.
create or replace function public.lock_household_pin()
returns void language sql security definer set search_path = '' as $$
  update public.household_pins set unlocked_until = null where household_id = private.my_household_id();
$$;
revoke execute on function public.lock_household_pin() from public, anon;
grant execute on function public.lock_household_pin() to authenticated;

-- Setting a new PIN also counts as unlocking.
create or replace function public.set_household_pin(new_pin text)
returns void language plpgsql security definer set search_path = '' as $$
declare hid uuid := private.my_household_id();
begin
  if hid is null then raise exception 'No household for this account' using errcode = 'insufficient_privilege'; end if;
  if new_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN must be 4 to 6 digits' using errcode = 'check_violation'; end if;
  insert into public.household_pins (household_id, pin_hash, unlocked_until)
  values (hid, extensions.crypt(new_pin, extensions.gen_salt('bf', 10)), now() + interval '10 minutes')
  on conflict (household_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null,
        unlocked_until = now() + interval '10 minutes', updated_at = now();
end;
$$;
