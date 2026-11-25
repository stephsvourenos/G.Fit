-- Programmes (22 Nov 2026): an ordered series of workouts around a style or goal.
-- Every programme is included in the membership (owner's decision: nothing on G.Fit is ever sold separately),
-- so programmes add no new payment, refund or royalty rules. Viewing still counts per workout, exactly as before.

create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (btrim(title) <> ''),
  description text not null default '',
  instructor_id uuid references public.instructors(id),
  state text not null default 'draft' check (state in ('draft', 'published', 'archived')),
  published_at timestamptz,
  thumbnail jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.programme_workouts (
  programme_id uuid not null references public.programmes(id) on delete cascade,
  position int not null check (position >= 1),
  workout_id uuid not null references public.workouts(id),
  primary key (programme_id, position),
  unique (programme_id, workout_id)
);
create index programme_workouts_workout_idx on public.programme_workouts (workout_id);

alter table public.programmes enable row level security;
alter table public.programme_workouts enable row level security;

-- Members see published programmes (and their steps); content staff manage everything.
create policy programmes_member_read on public.programmes for select to authenticated
  using (state = 'published' or private.has_staff_role('{admin,content_editor}'));
create policy programmes_staff_write on public.programmes for all to authenticated
  using (private.has_staff_role('{admin,content_editor}')) with check (private.has_staff_role('{admin,content_editor}'));
create policy programme_workouts_member_read on public.programme_workouts for select to authenticated
  using (exists (select 1 from public.programmes p where p.id = programme_id
                 and (p.state = 'published' or private.has_staff_role('{admin,content_editor}'))));
create policy programme_workouts_staff_write on public.programme_workouts for all to authenticated
  using (private.has_staff_role('{admin,content_editor}')) with check (private.has_staff_role('{admin,content_editor}'));

-- Publishing rule, enforced in the database as well as the admin screen:
-- a programme can only go live with at least one published workout in it.
create or replace function public.programmes_publish_gate() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.state = 'published' and (tg_op = 'INSERT' or old.state <> 'published') then
    if tg_op = 'INSERT' then raise exception 'New programmes start as drafts'; end if;
    if not exists (select 1 from public.programme_workouts pw join public.workouts w on w.id = pw.workout_id
                   where pw.programme_id = new.id and w.state = 'published') then
      raise exception 'Cannot publish: add at least one published workout first';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger programmes_publish_gate before insert or update on public.programmes
  for each row execute function public.programmes_publish_gate();

-- Replace a programme's workouts in one go (keeps the order gap-free). Runs with the caller's rights,
-- so only content staff can use it.
create or replace function public.set_programme_workouts(p_programme uuid, p_workouts uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.has_staff_role('{admin,content_editor}') then raise exception 'Only content staff can change programmes'; end if;
  if (select count(distinct x) from unnest(p_workouts) x) <> cardinality(p_workouts) then
    raise exception 'A workout can only appear once in a programme';
  end if;
  delete from public.programme_workouts where programme_id = p_programme;
  insert into public.programme_workouts (programme_id, position, workout_id)
    select p_programme, o.n, o.id from unnest(p_workouts) with ordinality as o(id, n);
  update public.programmes set updated_at = now() where id = p_programme;
end $$;
revoke all on function public.set_programme_workouts(uuid, uuid[]) from public, anon;
grant execute on function public.set_programme_workouts(uuid, uuid[]) to authenticated;

-- Audit: status changes are recorded with who made them.
create or replace function private.audit_programme_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state is distinct from old.state then
    insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
    values ((select auth.uid()), coalesce((select auth.jwt()) ->> 'email', 'system'), 'content',
            format('Programme %s: %s → %s', new.title, old.state, new.state),
            jsonb_build_object('programme_id', new.id, 'slug', new.slug, 'state', jsonb_build_array(old.state, new.state)));
  end if;
  return new;
end $$;
revoke execute on function private.audit_programme_change() from public, anon, authenticated;
create trigger programmes_audit after update on public.programmes
  for each row execute function private.audit_programme_change();

-- Public website views (same approach as public_workouts): published programmes with at least one published AU
-- workout; only published AU workouts are listed; junior coaches are never named.
create view public.public_programmes with (security_barrier = true) as
select
  p.slug,
  p.title,
  p.description,
  p.thumbnail,
  p.published_at,
  case when i.is_minor then null else i.slug end as instructor_slug,
  case when i.is_minor then null else i.display_name end as instructor_name,
  s.workout_count,
  s.total_duration_sec,
  s.age_bands,
  s.categories
from public.programmes p
left join public.instructors i on i.id = p.instructor_id
cross join lateral (
  select count(*)::int as workout_count,
         coalesce(sum(w.duration_sec), 0)::int as total_duration_sec,
         coalesce((select array_agg(distinct b order by b) from public.programme_workouts pw2
                   join public.workouts w2 on w2.id = pw2.workout_id, unnest(w2.age_bands) b
                   where pw2.programme_id = p.id and w2.state = 'published' and 'AU' = any (w2.territories)), '{}') as age_bands,
         coalesce(array_agg(distinct w.category), '{}') as categories
  from public.programme_workouts pw join public.workouts w on w.id = pw.workout_id
  where pw.programme_id = p.id and w.state = 'published' and 'AU' = any (w.territories)
) s
where p.state = 'published' and s.workout_count > 0;

create view public.public_programme_workouts with (security_barrier = true) as
select p.slug as programme_slug,
       row_number() over (partition by p.id order by pw.position)::int as step,
       w.slug as workout_slug
from public.programmes p
join public.programme_workouts pw on pw.programme_id = p.id
join public.workouts w on w.id = pw.workout_id
where p.state = 'published' and w.state = 'published' and 'AU' = any (w.territories);

revoke all on public.public_programmes, public.public_programme_workouts from public;
grant select on public.public_programmes, public.public_programme_workouts to anon, authenticated;
comment on view public.public_programmes is 'Public website: published programmes with at least one published AU workout.';
comment on view public.public_programme_workouts is 'Public website: the published workouts in each published programme, in order.';

-- Test suite: select tests.run_programme_checks();
create or replace function tests.run_programme_checks()
returns void language plpgsql set search_path = '' as $fn$
declare
  me text := current_user;
  u uuid := gen_random_uuid(); hid uuid;
  cid uuid; ins uuid; jr uuid; w_live uuid; w_draft uuid; w_jr uuid; p1 uuid; p2 uuid; n int; s text;
  passed int := 0; failed text := '';
begin
  insert into public.creators (display_name, legal_name) values ('Prog Test Co', 'Prog Test Co Pty Ltd') returning id into cid;
  insert into public.instructors (creator_id, display_name) values (cid, 'Prog Test Coach') returning id into ins;
  insert into public.instructors (creator_id, display_name, is_minor) values (cid, 'Prog Test Junior', true) returning id into jr;
  insert into public.workouts (slug, title, instructor_id, creator_id, category, duration_sec, intensity, age_bands, state,
    rights_creator_licence_signed, rights_music_cleared, rights_safety_reviewed, rights_guardian_consent, mux_playback_id, captions)
    values ('prt-live', 'Live', ins, cid, 'pilates', 600, 'gentle', '{adult}', 'published', true, true, true, null, 'SECRETPB', true)
    returning id into w_live;
  insert into public.workouts (slug, title, instructor_id, creator_id, category, duration_sec, intensity, age_bands, state)
    values ('prt-draft', 'Draft', ins, cid, 'pilates', 300, 'gentle', '{adult}', 'draft') returning id into w_draft;
  insert into public.workouts (slug, title, instructor_id, creator_id, category, duration_sec, intensity, age_bands, state,
    rights_creator_licence_signed, rights_music_cleared, rights_safety_reviewed, rights_guardian_consent, mux_playback_id, captions)
    values ('prt-junior', 'Junior', jr, cid, 'dance', 300, 'gentle', '{6-8}', 'published', true, true, true, true, 'SECRETPB2', true)
    returning id into w_jr;

  -- Publishing rules
  begin insert into public.programmes (slug, title, state) values ('prt-bad', 'Bad', 'published'); failed := failed || ' [new programmes start as drafts]';
  exception when raise_exception then passed := passed + 1; end;
  insert into public.programmes (slug, title, instructor_id) values ('prt-one', 'Prog One', ins) returning id into p1;
  begin update public.programmes set state = 'published' where id = p1; failed := failed || ' [empty programme cannot publish]';
  exception when raise_exception then passed := passed + 1; end;
  insert into public.programme_workouts (programme_id, position, workout_id) values (p1, 1, w_draft);
  begin update public.programmes set state = 'published' where id = p1; failed := failed || ' [drafts-only programme cannot publish]';
  exception when raise_exception then passed := passed + 1; end;
  insert into public.programme_workouts (programme_id, position, workout_id) values (p1, 2, w_live);
  update public.programmes set state = 'published' where id = p1;
  select count(*) into n from public.programmes where id = p1 and published_at is not null;
  if n = 1 then passed := passed + 1; else failed := failed || ' [publishes with a live workout]'; end if;
  select count(*) into n from public.audit_log where detail->>'programme_id' = p1::text;
  if n = 1 then passed := passed + 1; else failed := failed || ' [publishing audited]'; end if;
  insert into public.programmes (slug, title, instructor_id) values ('prt-jr', 'Junior prog', jr) returning id into p2;
  insert into public.programme_workouts (programme_id, position, workout_id) values (p2, 1, w_jr);
  update public.programmes set state = 'published' where id = p2;

  -- Anonymous visitor
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
  select count(*) into n from public.public_programmes where slug = 'prt-one' and workout_count = 1 and total_duration_sec = 600;
  if n = 1 then passed := passed + 1; else failed := failed || ' [public programme counts only published workouts]'; end if;
  select string_agg(workout_slug, ',' order by step) into s from public.public_programme_workouts where programme_slug = 'prt-one';
  if s = 'prt-live' then passed := passed + 1; else failed := failed || ' [draft workout hidden from steps]'; end if;
  select count(*) into n from public.public_programmes where slug = 'prt-jr' and instructor_name is null and instructor_slug is null;
  if n = 1 then passed := passed + 1; else failed := failed || ' [junior coach never named]'; end if;
  begin select count(*) into n from public.programmes;
    if n = 0 then passed := passed + 1; else failed := failed || ' [anon reads no programme rows]'; end if;
  exception when insufficient_privilege then passed := passed + 1; end;
  perform set_config('role', me, true);

  -- A family member: reads published programmes, cannot change them
  insert into auth.users (id, email, aud, role) values (u, 'progtest@test.invalid', 'authenticated', 'authenticated');
  insert into public.households (owner_user_id) values (u) returning id into hid;
  update public.programmes set state = 'archived' where id = p2;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.programmes where id in (p1, p2);
  if n = 1 then passed := passed + 1; else failed := failed || ' [members see published only]'; end if;
  begin perform public.set_programme_workouts(p1, array[w_live]); failed := failed || ' [members cannot reorder]';
  exception when raise_exception then passed := passed + 1; end;
  update public.programmes set title = 'Hacked' where id = p1;
  perform set_config('role', me, true);
  select count(*) into n from public.programmes where id = p1 and title = 'Prog One';
  if n = 1 then passed := passed + 1; else failed := failed || ' [members cannot edit]'; end if;

  -- Staff reorder (as the table owner here; the function's own role check is covered above)
  delete from public.programme_workouts where programme_id = p1;
  insert into public.programme_workouts (programme_id, position, workout_id)
    select p1, o.n, o.id from unnest(array[w_live, w_draft]) with ordinality as o(id, n);
  select string_agg(w.slug, ',' order by pw.position) into s from public.programme_workouts pw join public.workouts w on w.id = pw.workout_id where pw.programme_id = p1;
  if s = 'prt-live,prt-draft' then passed := passed + 1; else failed := failed || ' [order saved]'; end if;
  begin insert into public.programme_workouts (programme_id, position, workout_id) values (p1, 3, w_live); failed := failed || ' [no duplicate workout]';
  exception when unique_violation then passed := passed + 1; end;

  if failed <> '' then raise exception 'ROLLBACK — % passed, FAILED:%', passed, failed; end if;
  raise exception 'ROLLBACK OK — ALL % PROGRAMME CHECKS PASSED', passed;
end $fn$;
revoke all on function tests.run_programme_checks() from public, anon, authenticated;
