-- Re-runnable test of the exact database calls the web app makes for a new
-- family, run as that signed-in parent (Row-Level Security applies).
-- Run with:  select tests.run_app_journey();   Always rolls back.
create or replace function tests.run_app_journey()
returns void language plpgsql set search_path = '' as $fn$
declare
  me text := current_user;
  u uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  hid uuid; adult uuid; kid uuid; wk uuid; wk_teen uuid;
  n int; ok boolean; j jsonb; passed int := 0; failed text := '';
begin
  insert into auth.users (id, email, aud, role) values
    (u, 'parent@test.invalid', 'authenticated', 'authenticated'),
    (other, 'other@test.invalid', 'authenticated', 'authenticated');
  select id into wk from public.workouts where slug = 'jungle-animal-moves';
  select id into wk_teen from public.workouts where slug = 'core-strength-for-young-athletes';

  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- First sign-in: no household yet, app creates it.
  select count(*) into n from public.households;            if n = 0 then passed := passed + 1; else failed := failed || ' [new user starts with no household]'; end if;
  insert into public.households (owner_user_id) values (u) returning id into hid;
  passed := passed + 1;
  begin insert into public.households (owner_user_id) values (other);
        failed := failed || ' [cannot create a household for someone else]';
  exception when others then passed := passed + 1; end;

  -- PIN step.
  ok := public.household_pin_is_set();                      if not ok then passed := passed + 1; else failed := failed || ' [PIN not set yet]'; end if;
  perform public.set_household_pin('4826');
  ok := public.household_pin_is_set();                      if ok then passed := passed + 1; else failed := failed || ' [PIN now set]'; end if;
  ok := public.verify_household_pin('4826');                if ok then passed := passed + 1; else failed := failed || ' [PIN verifies]'; end if;

  -- Profiles step.
  insert into public.profiles (household_id, nickname, avatar_emoji, avatar_colour, age_band, interests, pin_protected)
    values (hid, 'Mum', '🦉', '#2E6BFF', 'adult', '{pilates}', true) returning id into adult;
  insert into public.profiles (household_id, nickname, avatar_emoji, avatar_colour, age_band, interests, pin_protected, max_intensity)
    values (hid, 'Leo', '🐣', '#FFC23D', 'under-6', '{move-and-play}', false, 'gentle') returning id into kid;
  select count(*) into n from public.profiles;              if n = 2 then passed := passed + 1; else failed := failed || ' [profiles saved]'; end if;

  -- Catalogue lookups the app uses to map workouts.
  select count(*) into n from public.workouts where slug in ('jungle-animal-moves','core-strength-for-young-athletes');
                                                            if n = 2 and wk is not null then passed := passed + 1; else failed := failed || ' [published catalogue readable]'; end if;

  -- Activity: progress upsert twice, favourite add/remove, completion.
  insert into public.watch_progress (profile_id, workout_id, position_sec) values (kid, wk, 120)
    on conflict (profile_id, workout_id) do update set position_sec = excluded.position_sec, updated_at = now();
  insert into public.watch_progress (profile_id, workout_id, position_sec) values (kid, wk, 240)
    on conflict (profile_id, workout_id) do update set position_sec = excluded.position_sec, updated_at = now();
  select position_sec into n from public.watch_progress where profile_id = kid and workout_id = wk;
                                                            if n = 240 then passed := passed + 1; else failed := failed || ' [progress saves and updates]'; end if;
  insert into public.favourites (profile_id, workout_id) values (kid, wk);
  delete from public.favourites where profile_id = kid and workout_id = wk;
  select count(*) into n from public.favourites;            if n = 0 then passed := passed + 1; else failed := failed || ' [favourite toggles]'; end if;
  insert into public.completions (profile_id, workout_id) values (kid, wk);
  select count(*) into n from public.completions where completed_on = (now() at time zone 'Australia/Sydney')::date;
                                                            if n = 1 then passed := passed + 1; else failed := failed || ' [completion dated in Sydney time]'; end if;

  -- No membership yet: entitlement empty and can't be self-granted.
  select count(*) into n from public.entitlements;          if n = 0 then passed := passed + 1; else failed := failed || ' [no membership until paid]'; end if;

  -- Export contains this family's data only.
  j := public.export_my_household();
  if jsonb_array_length(j->'profiles') = 2 and jsonb_array_length(j->'completions') = 1 and not (j->'household') ? 'owner_user_id'
    then passed := passed + 1; else failed := failed || ' [export complete and minimal]'; end if;

  -- Another parent sees none of it.
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  select count(*) into n from public.profiles;              if n = 0 then passed := passed + 1; else failed := failed || ' [other parent sees nothing]'; end if;
  select count(*) into n from public.watch_progress;        if n = 0 then passed := passed + 1; else failed := failed || ' [other parent sees no activity]'; end if;
  delete from public.profiles where id = kid;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  select count(*) into n from public.profiles where id = kid; if n = 1 then passed := passed + 1; else failed := failed || ' [other parent cannot delete our child]'; end if;

  -- Remove a child profile: its activity goes too.
  delete from public.profiles where id = kid;
  perform set_config('role', me, true);
  select count(*) into n from public.watch_progress where profile_id = kid;
  select n + count(*) into n from public.completions where profile_id = kid;
                                                            if n = 0 then passed := passed + 1; else failed := failed || ' [child activity deleted with profile]'; end if;

  -- Delete household data: everything goes.
  perform set_config('role', 'authenticated', true);
  delete from public.households where id = hid;
  perform set_config('role', me, true);
  select count(*) into n from public.profiles where household_id = hid;
  select n + count(*) into n from public.household_pins where household_id = hid;
                                                            if n = 0 then passed := passed + 1; else failed := failed || ' [household delete removes everything]'; end if;

  if failed <> '' then raise exception 'ROLLBACK — % passed, FAILED:%', passed, failed; end if;
  raise exception 'ROLLBACK OK — ALL % JOURNEY CHECKS PASSED', passed;
end;
$fn$;
revoke execute on function tests.run_app_journey() from public, anon, authenticated;
