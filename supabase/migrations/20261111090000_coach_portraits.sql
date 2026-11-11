-- Coach portraits as profile pictures.
-- A coach's photo can be offered as a profile picture only with their written consent (creator agreement clause),
-- only for adult coaches, and it disappears from every profile the moment consent is withdrawn.

alter table public.instructors
  add column if not exists portrait_path text,
  add column if not exists portrait_consent_at timestamptz,
  add column if not exists portrait_consent_ref text;
alter table public.instructors drop constraint if exists instructors_portrait_consent_valid;
alter table public.instructors add constraint instructors_portrait_consent_valid check (
  portrait_consent_at is null
  or (not is_minor and portrait_path is not null and coalesce(btrim(portrait_consent_ref), '') <> '')
);
comment on column public.instructors.portrait_consent_ref is
  'Where the coach''s written consent is recorded, e.g. "Creator agreement v1 clause 10, signed 11 Nov 2026".';

alter table public.profiles add column if not exists avatar_instructor_id uuid references public.instructors(id) on delete set null;
comment on column public.profiles.avatar_instructor_id is
  'Optional coach portrait chosen as the picture. avatar_emoji stays as the fallback if the coach withdraws consent.';

-- Coaches families can choose from.
create or replace view public.coach_pictures with (security_invoker = true) as
  select id, display_name, portrait_path
  from public.instructors
  where portrait_consent_at is not null and portrait_path is not null and not is_minor;
grant select on public.coach_pictures to authenticated;

-- A profile can only pick a coach who has consented.
create or replace function private.profiles_coach_picture_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.avatar_instructor_id is not null
     and (tg_op = 'INSERT' or new.avatar_instructor_id is distinct from old.avatar_instructor_id) then
    if not exists (select 1 from public.coach_pictures c where c.id = new.avatar_instructor_id) then
      raise exception 'That coach picture isn''t available' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_coach_picture_check on public.profiles;
create trigger profiles_coach_picture_check before insert or update of avatar_instructor_id on public.profiles
  for each row execute function private.profiles_coach_picture_check();

-- Consent given / withdrawn: audit it, and on withdrawal remove the picture from every profile at once.
create or replace function private.instructors_portrait_consent_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.portrait_consent_at is distinct from old.portrait_consent_at or new.portrait_path is distinct from old.portrait_path then
    insert into public.audit_log (actor_user_id, area, action, detail)
    values ((select auth.uid()), 'creators',
            case when new.portrait_consent_at is null then 'coach_portrait_withdrawn' else 'coach_portrait_consented' end,
            jsonb_build_object('instructor_id', new.id, 'display_name', new.display_name, 'consent_ref', new.portrait_consent_ref));
    if new.portrait_consent_at is null or new.portrait_path is null then
      update public.profiles set avatar_instructor_id = null where avatar_instructor_id = new.id;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists instructors_portrait_consent_changed on public.instructors;
create trigger instructors_portrait_consent_changed after update on public.instructors
  for each row execute function private.instructors_portrait_consent_changed();

-- Photo storage: public to view (they're shown on profiles), only content staff can add or remove.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coach-portraits', 'coach-portraits', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists coach_portraits_staff_insert on storage.objects;
drop policy if exists coach_portraits_staff_update on storage.objects;
drop policy if exists coach_portraits_staff_delete on storage.objects;
create policy coach_portraits_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-portraits' and private.has_staff_role('{admin,content_editor}'));
create policy coach_portraits_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'coach-portraits' and private.has_staff_role('{admin,content_editor}'))
  with check (bucket_id = 'coach-portraits' and private.has_staff_role('{admin,content_editor}'));
create policy coach_portraits_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'coach-portraits' and private.has_staff_role('{admin,content_editor}'));

-- Tests (always rolled back): select tests.run_coach_portrait_checks();
create or replace function tests.run_coach_portrait_checks()
returns void language plpgsql set search_path = '' as $fn$
declare
  me text := current_user;
  u uuid := gen_random_uuid();
  hid uuid; pid uuid; cid uuid; ins_ok uuid; ins_no uuid; ins_minor uuid; n int; passed int := 0; failed text := '';
begin
  insert into auth.users (id, email, aud, role) values (u, 'coachpic@test.invalid', 'authenticated', 'authenticated');
  insert into public.households (owner_user_id) values (u) returning id into hid;
  insert into public.profiles (household_id, nickname, avatar_emoji, avatar_colour, age_band) values (hid, 'Sam', '@run1', '#E0177A', 'adult') returning id into pid;
  insert into public.creators (display_name, legal_name) values ('Test Coach Co', 'Test Coach Co Pty Ltd') returning id into cid;
  insert into public.instructors (creator_id, display_name, portrait_path, portrait_consent_at, portrait_consent_ref)
    values (cid, 'Consenting Coach', 'test/ok.jpg', now(), 'Creator agreement test') returning id into ins_ok;
  insert into public.instructors (creator_id, display_name) values (cid, 'No Consent Coach') returning id into ins_no;
  insert into public.instructors (creator_id, display_name, is_minor) values (cid, 'Junior Coach', true) returning id into ins_minor;

  -- Consent rules on the coach record.
  begin update public.instructors set portrait_path = 'x.jpg', portrait_consent_at = now(), portrait_consent_ref = 'x' where id = ins_minor;
        failed := failed || ' [junior coach portrait refused]';
  exception when check_violation then passed := passed + 1; end;
  begin update public.instructors set portrait_path = 'x.jpg', portrait_consent_at = now() where id = ins_no;
        failed := failed || ' [consent needs a recorded reference]';
  exception when check_violation then passed := passed + 1; end;

  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.coach_pictures where id = ins_ok;  if n = 1 then passed := passed + 1; else failed := failed || ' [consenting coach listed]'; end if;
  select count(*) into n from public.coach_pictures where id in (ins_no, ins_minor);
                                                                        if n = 0 then passed := passed + 1; else failed := failed || ' [others not listed]'; end if;
  begin update public.profiles set avatar_instructor_id = ins_no where id = pid; failed := failed || ' [non-consenting coach refused]';
  exception when check_violation then passed := passed + 1; end;
  update public.profiles set avatar_instructor_id = ins_ok where id = pid;
  select count(*) into n from public.profiles where id = pid and avatar_instructor_id = ins_ok;
                                                                        if n = 1 then passed := passed + 1; else failed := failed || ' [family can pick consenting coach]'; end if;
  begin update public.instructors set portrait_consent_at = null where id = ins_ok; failed := failed || ' [members cannot change coach consent]';
  exception when others then passed := passed + 1; end;
  perform set_config('role', me, true);

  -- Withdrawal removes the picture everywhere, keeps the fallback, and is audited.
  update public.instructors set portrait_consent_at = null, portrait_consent_ref = null where id = ins_ok;
  select count(*) into n from public.profiles where id = pid and avatar_instructor_id is null and avatar_emoji = '@run1';
                                                                        if n = 1 then passed := passed + 1; else failed := failed || ' [withdrawal resets profile to fallback]'; end if;
  select count(*) into n from public.audit_log where action = 'coach_portrait_withdrawn' and detail->>'instructor_id' = ins_ok::text;
                                                                        if n = 1 then passed := passed + 1; else failed := failed || ' [withdrawal audited]'; end if;

  if failed <> '' then raise exception 'ROLLBACK — % passed, FAILED:%', passed, failed; end if;
  raise exception 'ROLLBACK OK — ALL % COACH-PORTRAIT CHECKS PASSED', passed;
end $fn$;
revoke all on function tests.run_coach_portrait_checks() from public, anon, authenticated;
