-- Move internal helper functions out of the public API schema so they
-- can't be called directly over the web API. Policies refer to functions
-- by internal ID, so they keep working unchanged.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.has_staff_role(public.staff_role[]) set schema private;
alter function public.my_household_id() set schema private;
alter function public.owns_profile(uuid) set schema private;
alter function public.is_creator_user(uuid) set schema private;
alter function public.profiles_before_write() set schema private;
alter function public.workouts_publish_gate() set schema private;
alter function public.forbid_modification() set schema private;

-- Functions that call the helpers by name need the new location.
create or replace function public.set_household_pin(new_pin text)
returns void language plpgsql security definer set search_path = '' as $$
declare hid uuid := private.my_household_id();
begin
  if hid is null then raise exception 'No household for this account' using errcode = 'insufficient_privilege'; end if;
  if new_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN must be 4 to 6 digits' using errcode = 'check_violation'; end if;
  insert into public.household_pins (household_id, pin_hash)
  values (hid, extensions.crypt(new_pin, extensions.gen_salt('bf', 10)))
  on conflict (household_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_at = now();
end;
$$;

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

-- Lock everything down, then grant only what's needed.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_staff_role(public.staff_role[]) to authenticated;
grant execute on function private.my_household_id() to authenticated;
grant execute on function private.owns_profile(uuid) to authenticated;
grant execute on function private.is_creator_user(uuid) to authenticated;

-- Audit entries are written by the server, not by members.
revoke execute on function public.log_audit(text, text, jsonb) from public, anon, authenticated;

-- Member-facing API functions (intentional): set/verify PIN, export own data.
revoke execute on function public.set_household_pin(text) from public, anon;
revoke execute on function public.verify_household_pin(text) from public, anon;
revoke execute on function public.export_my_household() from public, anon;
grant execute on function public.set_household_pin(text) to authenticated;
grant execute on function public.verify_household_pin(text) to authenticated;
grant execute on function public.export_my_household() to authenticated;

-- Future functions are not callable by default.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;
